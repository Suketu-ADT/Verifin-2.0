"""
Systems under test.

* ``verifin``       - the production VerificationService wired to in-memory repositories,
                      so the exact production retrieval / NLI / numerical code is measured.
* ``number_match``  - lexical heuristic baseline (no ML): claim numbers present in BM25 evidence.
* ``llm_judge``     - free local LLM (Ollama) asked for a verdict, with or without retrieved evidence.

Every system exposes ``async predict(item) -> dict`` with at least ``label`` and ``retrieved_pages``.
"""

from __future__ import annotations

import re
import time
from typing import Dict, List, Optional

from app.config import settings
from app.models.document import DocumentModel
from app.schemas.verification import StartVerificationRequest
from app.services.bm25_service import BM25Service
from app.services.claim_extractor import ClaimExtractor
from app.services.embedding_service import get_embedding_service
from app.services.nli_service import NLIService, get_nli_service
from app.services.numerical_reasoner import (
    NumericalFinding,
    NumericalReasonerService,
    TemporalAnchor,
)
from app.services.retrieval_service import RetrievalService
from app.services.verification_service import VerificationService
from eval.build_dataset import NUM_RE, ollama_generate
from eval.corpus import CorpusDoc

# ── In-memory repositories ───────────────────────────────────────────────────


class StubDocRepo:
    def __init__(self, corpus: Dict[str, CorpusDoc]):
        self.corpus = corpus

    async def get_document_by_id(self, doc_id: str) -> Optional[DocumentModel]:
        doc = self.corpus.get(doc_id)
        if doc is None:
            return None
        return DocumentModel(id=doc_id, filename=doc.meta["file"], file_type="pdf", size=1, file_path="")

    async def list_documents(self, *args, **kwargs):
        return [await self.get_document_by_id(k) for k in self.corpus]


class StubChunkRepo:
    collection = None  # forces the exact-cosine path (no Atlas $vectorSearch)

    def __init__(self, corpus: Dict[str, CorpusDoc]):
        self.corpus = corpus

    async def get_chunks_by_document(self, doc_id: str, *args, **kwargs):
        return self.corpus[doc_id].chunks

    async def get_all_chunks(self, limit: int = 1000):
        return [c for d in self.corpus.values() for c in d.chunks][:limit]


class StubTableRepo:
    async def get_tables_by_document_id(self, doc_id: str):
        return []


class StubVerifRepo:
    async def create_session(self, session):
        return session

    async def save_claims(self, claims):
        return claims


class PassthroughExtractor(ClaimExtractor):
    """Evaluate each dataset claim as-is (claim extraction is not under test here)."""

    def extract_claims(self, text: str):
        return [{
            "claim_text": text,
            "claim_type": self._classify_claim_type(text),
            "source_sentence": text,
            "target_metric": None,
        }]


class NoNumericalReasoner(NumericalReasonerService):
    """Ablation: disables arithmetic and temporal checks so only retrieval + NLI decide."""

    def verify_numerical_claim(self, *args, **kwargs) -> NumericalFinding:
        return NumericalFinding(finding_type="NO_CALCULATION")

    def verify_temporal_alignment(self, *args, **kwargs) -> TemporalAnchor:
        return TemporalAnchor()


class RecordingRetrieval(RetrievalService):
    """Remembers the last retrieval so page-level retrieval metrics can be computed."""

    last: list = []

    async def retrieve_evidence(self, *args, **kwargs):
        self.last = await super().retrieve_evidence(*args, **kwargs)
        return self.last


def _label_from_nli(status: str) -> str:
    return {"SUPPORTED": "SUPPORTED", "CONTRADICTED": "CONTRADICTED"}.get(status, "UNVERIFIABLE")


def _label_from_hallucination(h_type: Optional[str], status: str) -> str:
    if h_type in (None, "NONE"):
        return _label_from_nli(status)
    if h_type == "UNSUPPORTED_FABRICATION":
        return "UNVERIFIABLE"
    return "CONTRADICTED"


class VerifinSystem:
    def __init__(
        self,
        corpus: Dict[str, CorpusDoc],
        retrieval_mode: str = "hybrid",
        top_k: int = 3,
        numerical: bool = True,
        nli_model: Optional[str] = None,
        aggregation: Optional[str] = None,
        disabled: str = "",
        rerank: bool = False,
        end_to_end: bool = False,
    ):
        settings.retrieval_top_k = top_k
        self.disabled = disabled
        self.rerank = rerank
        self.aggregation = aggregation or settings.nli_aggregation
        self.retrieval_mode = retrieval_mode
        self.retrieval = RecordingRetrieval(
            embedding_service=get_embedding_service(),
            chunk_repository=StubChunkRepo(corpus),
            document_repository=StubDocRepo(corpus),
            bm25_service=BM25Service(),
        )
        nli = NLIService(model_name=nli_model) if nli_model else get_nli_service()
        self.service = VerificationService(
            verification_repo=StubVerifRepo(),
            document_repo=StubDocRepo(corpus),
            retrieval_service=self.retrieval,
            nli_service=nli,
            claim_extractor=ClaimExtractor() if end_to_end else PassthroughExtractor(),
            numerical_reasoner=NumericalReasonerService() if numerical else NoNumericalReasoner(),
            table_repo=StubTableRepo(),
            chunk_repo=StubChunkRepo(corpus),
        )

    async def predict(self, item: dict) -> dict:
        start = time.perf_counter()
        settings.nli_aggregation = self.aggregation
        settings.disabled_checks = self.disabled
        settings.reranker_enabled = self.rerank
        result = await self.service.start_verification_session(
            StartVerificationRequest(
                document_id=item["doc_key"],
                llm_output=item["claim"],
                retrieval_mode=self.retrieval_mode,
            )
        )
        latency = time.perf_counter() - start
        if not result.claims:  # nothing was extracted, so nothing was checked
            return {"label": "UNVERIFIABLE", "label_nli_only": "UNVERIFIABLE", "status": "NO_CLAIMS",
                    "retrieved_pages": [], "latency_s": round(latency, 4), "n_claims": 0}
        # the statement is as bad as its worst claim
        severity = {"CONTRADICTED": 2, "UNVERIFIABLE": 1, "SUPPORTED": 0}
        labels = [_label_from_hallucination(c.hallucination_type, c.status) for c in result.claims]
        nli_labels = [_label_from_nli(c.nli.label if c.nli else c.status) for c in result.claims]
        worst = max(range(len(labels)), key=lambda i: severity[labels[i]])
        claim = result.claims[worst]
        return {
            "label": labels[worst],
            "label_nli_only": max(nli_labels, key=lambda l: severity[l]),
            "n_claims": len(result.claims),
            "status": claim.status,
            "hallucination_type": claim.hallucination_type,
            "confidence": claim.confidence,
            "retrieved_pages": [c.page_number for c in self.retrieval.last],
            "latency_s": round(latency, 4),
        }


# ── Baselines ────────────────────────────────────────────────────────────────

_WORD = re.compile(r"[A-Za-z]{4,}")


def _norm_nums(text: str) -> set:
    out = set()
    for tok in NUM_RE.findall(text):
        try:
            out.add(round(float(tok.replace(",", "")), 6))
        except ValueError:
            pass
    return out


class NumberMatchBaseline:
    """No-ML floor: BM25 top-k, then compare claim numbers against the evidence text."""

    def __init__(self, corpus: Dict[str, CorpusDoc], top_k: int = 3):
        settings.retrieval_top_k = top_k
        self.retrieval = RecordingRetrieval(
            embedding_service=get_embedding_service(),
            chunk_repository=StubChunkRepo(corpus),
            document_repository=StubDocRepo(corpus),
            bm25_service=BM25Service(),
        )

    async def predict(self, item: dict) -> dict:
        start = time.perf_counter()
        evidence = await self.retrieval.retrieve_evidence(
            query=item["claim"], document_id=item["doc_key"], mode="bm25"
        )
        text = " ".join(c.chunk_text for c in evidence)
        claim_nums = _norm_nums(item["claim"])
        ev_nums = _norm_nums(text)
        claim_words = set(w.lower() for w in _WORD.findall(item["claim"]))
        ev_words = set(w.lower() for w in _WORD.findall(text))
        overlap = len(claim_words & ev_words) / max(len(claim_words), 1)
        if claim_nums and claim_nums <= ev_nums and overlap >= 0.5:
            label = "SUPPORTED"
        elif claim_nums and overlap >= 0.6:
            label = "CONTRADICTED"  # same topic, but the figures are not in the evidence
        else:
            label = "UNVERIFIABLE"
        return {
            "label": label,
            "retrieved_pages": [c.page_number for c in evidence],
            "latency_s": round(time.perf_counter() - start, 4),
        }


class LLMJudge:
    """Free local LLM as a fact-checker (the 'just ask an LLM' baseline)."""

    PROMPT = (
        "You are a strict fact-checker for financial reports.\n"
        "{context}"
        "Claim: {claim}\n\n"
        "Decide whether the claim is SUPPORTED, CONTRADICTED or UNVERIFIABLE{basis}. "
        "Answer with exactly one word: SUPPORTED, CONTRADICTED or UNVERIFIABLE."
    )

    def __init__(self, corpus: Dict[str, CorpusDoc], model: str, use_evidence: bool, top_k: int = 3):
        self.model = model
        self.use_evidence = use_evidence
        self.corpus = corpus
        settings.retrieval_top_k = top_k
        self.retrieval = RecordingRetrieval(
            embedding_service=get_embedding_service(),
            chunk_repository=StubChunkRepo(corpus),
            document_repository=StubDocRepo(corpus),
            bm25_service=BM25Service(),
        )

    async def predict(self, item: dict) -> dict:
        start = time.perf_counter()
        meta = self.corpus[item["doc_key"]].meta
        pages: List[int] = []
        if self.use_evidence:
            evidence = await self.retrieval.retrieve_evidence(query=item["claim"], document_id=item["doc_key"])
            pages = [c.page_number for c in evidence]
            context = "Evidence from the report:\n" + "\n".join(
                f"[p{c.page_number}] {c.chunk_text}" for c in evidence
            ) + "\n\n"
            basis = " using ONLY the evidence above"
        else:
            context = f"The claim concerns the {meta['identified_as']} of {meta['company']}.\n"
            basis = " based on what you know"
        raw = ollama_generate(
            self.PROMPT.format(context=context, claim=item["claim"], basis=basis),
            model=self.model,
            num_predict=6,
        ) or ""
        upper = raw.upper()
        label = next((l for l in ("CONTRADICTED", "UNVERIFIABLE", "SUPPORTED") if l in upper), "UNVERIFIABLE")
        return {
            "label": label,
            "raw": raw[:40],
            "retrieved_pages": pages,
            "latency_s": round(time.perf_counter() - start, 4),
        }


def build_system(name: str, corpus: Dict[str, CorpusDoc]):
    """
    System names:
      verifin[:mode[:kN]]         e.g. verifin, verifin:dense, verifin:bm25:k5
      verifin_nonum[:mode]        numerical/temporal reasoner disabled
      number_match
      llm_norag:<model>           e.g. llm_norag:qwen2.5:3b
      llm_rag:<model>
    """
    head, _, rest = name.partition(":")
    if head in ("verifin", "verifin_nonum"):
        parts = rest.split(":") if rest else []
        mode = next((p for p in parts if p in ("hybrid", "dense", "bm25")), "hybrid")
        k = next((int(p[1:]) for p in parts if re.fullmatch(r"k\d+", p)), 3)
        agg = next((p.split("=")[1] for p in parts if p.startswith("agg=")), None)
        disabled = next((p.split("=")[1].replace("+", ",") for p in parts if p.startswith("abl=")), "")
        rerank = "rerank" in parts
        end_to_end = "e2e" in parts
        nli_key = next((p.split("=")[1] for p in parts if p.startswith("nli=")), None)
        nli_model = {"small": None, "base": "cross-encoder/nli-deberta-v3-base",
                     "large": "cross-encoder/nli-deberta-v3-large"}.get(nli_key, nli_key)
        return VerifinSystem(corpus, retrieval_mode=mode, top_k=k, numerical=(head == "verifin"),
                             nli_model=nli_model, aggregation=agg, disabled=disabled, rerank=rerank, end_to_end=end_to_end)
    if head == "number_match":
        return NumberMatchBaseline(corpus)
    if head in ("llm_norag", "llm_rag"):
        return LLMJudge(corpus, model=rest or "qwen2.5:7b", use_evidence=(head == "llm_rag"))
    raise ValueError(f"unknown system '{name}'")
