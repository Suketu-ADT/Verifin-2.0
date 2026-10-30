"""
Unit and integration tests for BM25 Hybrid RAG and Enhanced Claim Verification.
"""

from unittest.mock import AsyncMock, MagicMock
import pytest

from app.models.chunk import DocumentChunkModel
from app.models.document import DocumentModel
from app.schemas.verification import StartVerificationRequest
from app.services.bm25_service import (
    BM25DocumentIndex,
    FinancialTokenizer,
    NativeBM25Okapi,
)
from app.services.claim_extractor import ClaimExtractor
from app.services.retrieval_service import RetrievalService
from app.services.verification_service import VerificationService


# ─────────────────────────────────────────────────────────────────────────────
# 1. Financial Tokenizer Tests
# ─────────────────────────────────────────────────────────────────────────────

def test_financial_tokenizer_preserves_currencies_and_figures():
    tokenizer = FinancialTokenizer()
    text = "Alphabet reported consolidated revenue of $350.0 billion and 15.2% operating margin in FY2024."
    tokens = tokenizer.tokenize(text)

    # Must preserve financial entities
    assert any("$350.0" in t or "350.0" in t for t in tokens)
    assert any("15.2%" in t or "15.2" in t for t in tokens)
    assert any("fy2024" in t or "2024" in t for t in tokens)
    # Must preserve core financial keywords
    assert "revenue" in tokens
    assert "operating" in tokens
    assert "margin" in tokens
    # Low-value stop words should be stripped
    assert "of" not in tokens
    assert "in" not in tokens


def test_financial_tokenizer_directionals_preserved():
    tokenizer = FinancialTokenizer()
    text = "Net income rose while operating loss decreased significantly."
    tokens = tokenizer.tokenize(text)

    assert "income" in tokens
    assert "rose" in tokens
    assert "loss" in tokens
    assert "decreased" in tokens


# ─────────────────────────────────────────────────────────────────────────────
# 2. Native BM25 Okapi Algorithm Tests
# ─────────────────────────────────────────────────────────────────────────────

def test_native_bm25_exact_match_ranking():
    tokenizer = FinancialTokenizer()
    corpus = [
        tokenizer.tokenize("Total debt amounted to $95 billion on the consolidated balance sheet."),
        tokenizer.tokenize("Cash and cash equivalents were $30 billion in marketable securities."),
        tokenizer.tokenize("Employee headcount grew to 180,000 workers worldwide across all regions."),
    ]
    bm25 = NativeBM25Okapi(corpus, k1=1.5, b=0.75)

    # Query for debt
    q_tokens = tokenizer.tokenize("What was the total debt of the company?")
    scores = bm25.get_scores(q_tokens)

    assert len(scores) == 3
    # First doc has highest debt relevance
    assert scores[0] > scores[1]
    assert scores[0] > scores[2]
    # Doc 2 has zero debt relevance
    assert scores[2] == 0.0 or scores[0] > scores[2]


def test_bm25_document_index_returns_matched_keywords():
    chunks = [
        DocumentChunkModel(
            id="c_1",
            document_id="doc_1",
            page_number=1,
            chunk_index=0,
            text="EBITDA margin reached 28.4% driven by Cloud subscription revenue growth.",
        ),
        DocumentChunkModel(
            id="c_2",
            document_id="doc_1",
            page_number=2,
            chunk_index=1,
            text="Operating expenses rose due to data center server depreciation and energy costs.",
        ),
    ]
    index = BM25DocumentIndex(chunks)
    results = index.query("Cloud revenue and EBITDA margin", top_k=2)

    assert len(results) == 2
    top_chunk, top_score, matched_kw = results[0]
    assert top_chunk.id == "c_1"
    assert top_score > 0.0
    assert "ebitda" in matched_kw or "revenue" in matched_kw or "margin" in matched_kw


# ─────────────────────────────────────────────────────────────────────────────
# 3. RetrievalService Hybrid RAG Tests (RRF & Weighted)
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_retrieval_hybrid_rrf_fusion():
    mock_doc_repo = AsyncMock()
    mock_doc = DocumentModel(
        id="doc_hybrid",
        filename="10k_report.pdf",
        file_type="pdf",
        size=1024,
        file_path="/tmp/10k.pdf",
    )
    mock_doc_repo.get_document_by_id.return_value = mock_doc

    mock_emb = MagicMock()
    mock_emb.is_healthy.return_value = True
    # Dense vector favors chunk 1 slightly
    mock_emb.generate_embedding.return_value = [1.0, 0.0]
    mock_emb.compute_cosine_similarity.side_effect = lambda a, b: 0.95 if b == [1.0, 0.0] else 0.40

    chunk_dense_favored = DocumentChunkModel(
        id="c_dense",
        document_id="doc_hybrid",
        page_number=1,
        chunk_index=0,
        text="The general corporate governance policy emphasizes long-term shareholder value.",
        embedding=[1.0, 0.0],
    )
    chunk_bm25_favored = DocumentChunkModel(
        id="c_bm25",
        document_id="doc_hybrid",
        page_number=14,
        chunk_index=1,
        text="Net sales for Q4 2024 totaled $94.8 billion, representing 10% YoY growth.",
        embedding=[0.0, 1.0],
    )

    mock_chunk_repo = AsyncMock()
    mock_chunk_repo.collection = None
    mock_chunk_repo.get_chunks_by_document.return_value = [chunk_dense_favored, chunk_bm25_favored]

    service = RetrievalService(
        embedding_service=mock_emb,
        chunk_repository=mock_chunk_repo,
        document_repository=mock_doc_repo,
    )

    # Query with exact numbers that BM25 will catch strongly
    results = await service.retrieve_evidence(
        query="What were the net sales in Q4 2024?",
        document_id="doc_hybrid",
        mode="hybrid",
        fusion_method="rrf",
        top_k=2,
    )

    assert len(results) == 2
    # Verify hybrid output fields
    for r in results:
        assert r.retrieval_method == "hybrid"
        assert r.retrieval_score >= 0.0
        assert r.dense_score is not None
        assert r.bm25_score is not None

    # BM25 favored chunk should have matched keywords
    bm25_res = next(r for r in results if r.chunk_id == "c_bm25")
    assert len(bm25_res.matched_keywords) > 0


@pytest.mark.asyncio
async def test_retrieval_bm25_only_mode():
    mock_doc_repo = AsyncMock()
    mock_doc = DocumentModel(
        id="doc_sparse", filename="sparse.pdf", file_type="pdf", size=1024, file_path="/tmp/1"
    )
    mock_doc_repo.get_document_by_id.return_value = mock_doc

    chunk_a = DocumentChunkModel(
        id="c_a", document_id="doc_sparse", page_number=1, chunk_index=0,
        text="Free cash flow was $15.2 billion.", embedding=[],
    )
    chunk_b = DocumentChunkModel(
        id="c_b", document_id="doc_sparse", page_number=2, chunk_index=1,
        text="Employee headcount was 10,000.", embedding=[],
    )

    mock_chunk_repo = AsyncMock()
    mock_chunk_repo.collection = None
    mock_chunk_repo.get_chunks_by_document.return_value = [chunk_a, chunk_b]

    # Even if embedding service is down, BM25 mode works!
    mock_emb = MagicMock()
    mock_emb.is_healthy.return_value = False

    service = RetrievalService(
        embedding_service=mock_emb,
        chunk_repository=mock_chunk_repo,
        document_repository=mock_doc_repo,
    )

    results = await service.retrieve_evidence(
        query="Free cash flow in billions",
        document_id="doc_sparse",
        mode="bm25",
        top_k=1,
    )

    assert len(results) == 1
    assert results[0].chunk_id == "c_a"
    assert results[0].retrieval_method == "bm25"
    assert "cash" in results[0].matched_keywords or "flow" in results[0].matched_keywords


# ─────────────────────────────────────────────────────────────────────────────
# 4. Enhanced Claim Extractor Tests
# ─────────────────────────────────────────────────────────────────────────────

def test_claim_extractor_decomposes_compound_sentence():
    extractor = ClaimExtractor()
    compound_text = (
        "Alphabet reported total revenues of $350.0 billion in 2024, and operating margin rose to 28.5%."
    )
    claims = extractor.extract_claims(compound_text)

    # Should be decomposed into 2 atomic claims
    assert len(claims) == 2
    assert "$350.0 billion" in claims[0]["claim_text"]
    assert "28.5%" in claims[1]["claim_text"]
    assert claims[0]["source_sentence"] == compound_text
    assert claims[1]["source_sentence"] == compound_text
    assert claims[0]["target_metric"] == "revenue"
    assert claims[1]["target_metric"] == "margin"


def test_claim_extractor_semicolon_decomposition():
    extractor = ClaimExtractor()
    text = "Total debt was $95,000 million; cash and cash equivalents were $30,000 million."
    claims = extractor.extract_claims(text)

    assert len(claims) == 2
    assert "95,000" in claims[0]["claim_text"]
    assert "30,000" in claims[1]["claim_text"]


# ─────────────────────────────────────────────────────────────────────────────
# 5. Improved Verification System Integration Tests
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_verification_detects_numerical_discrepancy_hallucination():
    """
    Verify that when numerical reasoning identifies a MISMATCH,
    the verification pipeline flags hallucination_type='NUMERICAL_DISCREPANCY'
    and sets overall session risk to HIGH.
    """
    mock_doc_repo = AsyncMock()
    mock_doc = MagicMock()
    mock_doc.filename = "earnings_q4.pdf"
    mock_doc_repo.get_document_by_id.return_value = mock_doc

    mock_verif_repo = AsyncMock()
    mock_verif_repo.create_session.side_effect = lambda s: s
    mock_verif_repo.save_claims.side_effect = lambda c: c

    # Evidence says revenue was $350M vs $307.4M (13.86% growth)
    evidence_text = "Total revenue was $350 million compared to $307.4 million."

    mock_retrieval = AsyncMock()
    from app.schemas.retrieval import EvidenceChunkResponse
    mock_retrieval.retrieve_evidence.return_value = [
        EvidenceChunkResponse(
            document_id="doc_num",
            source_filename="earnings_q4.pdf",
            page_number=4,
            chunk_id="c_4",
            chunk_text=evidence_text,
            retrieval_score=0.92,
            dense_score=0.91,
            bm25_score=4.5,
            retrieval_method="hybrid",
            matched_keywords=["revenue", "grew"],
        )
    ]

    mock_nli = MagicMock()
    mock_dp = MagicMock()
    mock_dp.chunk_id = "c_4"
    mock_dp.evidence_text = evidence_text
    mock_dp.page_number = 4
    mock_dp.retrieval_score = 0.92
    mock_dp.p_supported = 0.90
    mock_dp.p_contradicted = 0.05
    mock_dp.p_unverified = 0.05
    mock_dp.verdict = "SUPPORTED"

    mock_nli_res = MagicMock()
    mock_nli_res.claim_text = "Revenue grew by 45%."
    mock_nli_res.claim_type = "numerical"
    mock_nli_res.verdict = "SUPPORTED"
    mock_nli_res.confidence = 0.90
    mock_nli_res.risk_level = "LOW"
    mock_nli_res.risk_score = 0.10
    mock_nli_res.source_sentence = "Revenue grew by 45%."
    mock_nli_res.deciding_passage = mock_dp
    mock_nli_res.explanation = "Entailment detected in text wording."

    mock_nli.evaluate_claim_against_evidence.return_value = mock_nli_res

    svc = VerificationService(
        verification_repo=mock_verif_repo,
        document_repo=mock_doc_repo,
        retrieval_service=mock_retrieval,
        nli_service=mock_nli,
    )

    req = StartVerificationRequest(
        document_id="doc_num",
        llm_output="Revenue grew by 45%.",
    )
    result = await svc.start_verification_session(req)

    assert len(result.claims) == 1
    c = result.claims[0]

    # Hallucination diagnostics correctly flag numerical discrepancy
    assert c.hallucination_type == "NUMERICAL_DISCREPANCY"
    assert c.risk_level == "HIGH"
    assert c.hallucination_risk_score > 0.80
    assert result.risk_level == "HIGH"
    assert "Reported 45.0 vs computed" in c.reasoning_summary

    # Hybrid evidence provenance
    assert c.evidence.retrieval_method == "hybrid"
    assert c.evidence.dense_score == 0.91
    assert c.evidence.bm25_score == 4.5
