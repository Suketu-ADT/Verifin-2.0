"""
Verification service handling claim extraction, hybrid evidence retrieval,
Cross-Encoder NLI verification, numerical auditing, multi-hop reasoning,
and session persistence in MongoDB Atlas.
"""

from __future__ import annotations

import asyncio
import uuid
from typing import Any, Dict, List, Optional
from fastapi import HTTPException, status

from app.config import settings
from app.observability import metrics
from app.models.claim import (
    ClaimModel,
    EvidenceModel,
    NLIModel,
    NumericalFindingModel,
    TemporalAnchorModel,
)
from app.models.chunk import DocumentChunkModel
from app.models.verification import VerificationSessionModel
from app.repositories.chunk_repository import ChunkRepository
from app.repositories.document_repository import DocumentRepository
from app.repositories.table_repository import TableRepository
from app.repositories.verification_repository import VerificationRepository
from app.schemas.verification import (
    ClaimResponse,
    Evidence,
    NLIResult,
    NumericalFindingResponse,
    StartVerificationRequest,
    TemporalAnchorResponse,
    VerificationResultResponse,
)
from app.services.claim_extractor import ClaimExtractor
from app.services.multi_hop_reasoner import MultiHopReasonerService
from app.services.nli_service import (
    ClaimNLIResult,
    NLIService,
    get_nli_service,
)
from app.services.numeric_grounding import (
    CONFLICT,
    GROUNDED,
    NO_FIGURES,
    UNGROUNDED,
    GroundingResult,
    check_period,
    document_vocabulary,
    ground_figures,
    novel_entities,
)
from app.services.numerical_reasoner import NumericalFinding, NumericalReasonerService
from app.services.verdict_policy import synthesize_verdict
from app.services.retrieval_service import RetrievalService
from app.utils.logging import logger


class VerificationService:
    def __init__(
        self,
        verification_repo: Optional[VerificationRepository] = None,
        document_repo: Optional[DocumentRepository] = None,
        retrieval_service: Optional[RetrievalService] = None,
        nli_service: Optional[NLIService] = None,
        claim_extractor: Optional[ClaimExtractor] = None,
        numerical_reasoner: Optional[NumericalReasonerService] = None,
        table_repo: Optional[TableRepository] = None,
        multi_hop_reasoner: Optional[MultiHopReasonerService] = None,
        chunk_repo: Optional[ChunkRepository] = None,
    ):
        self.verification_repo = verification_repo or VerificationRepository()
        self.document_repo = document_repo or DocumentRepository()
        self.retrieval_service = retrieval_service or RetrievalService()
        self.nli_service = nli_service or get_nli_service()
        self.claim_extractor = claim_extractor or ClaimExtractor()
        self.numerical_reasoner = numerical_reasoner or NumericalReasonerService()
        self.table_repo = table_repo or TableRepository()
        self.multi_hop_reasoner = multi_hop_reasoner or MultiHopReasonerService(
            numerical_reasoner=self.numerical_reasoner
        )
        self.chunk_repo = chunk_repo or ChunkRepository()

    @staticmethod
    def _passages_with_neighbours(evidence_chunks, doc_chunks) -> List[str]:
        """Evidence text, each chunk joined to its neighbours so a sentence split by chunking stays whole."""
        position = {c.id: i for i, c in enumerate(doc_chunks or [])}
        passages: List[str] = []
        for ev in evidence_chunks:
            i = position.get(ev.chunk_id)
            if i is None:
                passages.append(ev.chunk_text)
                continue
            lo, hi = max(0, i - 1), min(len(doc_chunks), i + 2)
            passages.append(" ".join(c.text for c in doc_chunks[lo:hi]))
        return passages

    @staticmethod
    def _grounding_as_finding(grounding: GroundingResult) -> NumericalFinding:
        """Express a figure-grounding result in the existing numerical-finding shape."""
        if grounding.status == NO_FIGURES:
            return NumericalFinding(finding_type="NO_CALCULATION", comparison_outcome="NO_CALCULATION")
        outcome = {GROUNDED: "VALIDATED", CONFLICT: "MISMATCH", UNGROUNDED: "INSUFFICIENT_INPUTS"}[grounding.status]
        return NumericalFinding(
            finding_type="FIGURE_GROUNDING",
            formula="claim figure found in evidence",
            operands={
                "claim_figures": grounding.claim_figures,
                "matched": grounding.matched,
                "unmatched": grounding.unmatched,
                "conflicts": [{"claim": c, "evidence": e} for c, e in grounding.conflicts],
            },
            comparison_outcome=outcome,
            explanation=grounding.explanation,
        )

    async def start_verification_session(
        self,
        request: StartVerificationRequest,
        user_id: Optional[str] = None,
        tenant_id: str = "public",
        session_id: Optional[str] = None,
    ) -> VerificationResultResponse:
        """
        Validates request, extracts claims, retrieves hybrid document evidence,
        executes Cross-Encoder NLI verification, numerical reasoning, temporal checks,
        multi-hop provenance, and stores results in MongoDB Atlas.
        """
        doc_id = request.document_id.strip()
        llm_text = request.llm_output.strip()

        if not doc_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="document_id cannot be empty.",
            )

        if not llm_text:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="llm_output cannot be empty.",
            )

        # 1. Confirm document exists in database
        try:
            document = await self.document_repo.get_document_by_id(doc_id)
        except Exception as exc:
            logger.error(f"Error querying document repository: {exc}")
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Database error while verifying document existence.",
            )

        if not document:
            logger.warning(f"Verification rejected: document '{doc_id}' not found.")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Document with ID '{doc_id}' not found.",
            )

        queued = session_id is not None  # a background job already stored this session as 'queued'
        session_id = session_id or str(uuid.uuid4())

        # 2. Extract discrete financial claims from LLM output
        extracted_claims = self.claim_extractor.extract_claims(llm_text)
        if not extracted_claims:
            extracted_claims = [{
                "claim_text": llm_text,
                "claim_type": "factual",
                "source_sentence": llm_text,
                "target_metric": None,
            }]

        claim_models: List[ClaimModel] = []
        claim_responses: List[ClaimResponse] = []

        # Retrieve structured tables and chunks if available for this document
        try:
            doc_tables = await self.table_repo.get_tables_by_document_id(doc_id)
        except Exception as exc:
            logger.warning(f"Failed to query structured tables for doc {doc_id}: {exc}")
            doc_tables = []

        try:
            doc_chunks = await self.chunk_repo.get_chunks_by_document(doc_id)
        except Exception as exc:
            logger.warning(f"Failed to query chunks for doc {doc_id}: {exc}")
            doc_chunks = []

        vocabulary = (
            document_vocabulary(doc_id, (c.text for c in doc_chunks), len(doc_chunks))
            if doc_chunks
            else set()
        )

        # 3. Process each claim through BM25 Hybrid Retrieval, NLI, Numerical, and Multi-Hop
        for idx, ec in enumerate(extracted_claims):
            claim_id = f"{session_id}_c{idx}"
            c_text = ec["claim_text"]
            c_type = ec["claim_type"]

            # 3a. Retrieve evidence chunks for this claim using BM25 Hybrid RAG
            try:
                evidence_chunks = await self.retrieval_service.retrieve_evidence(
                    query=c_text,
                    document_id=doc_id,
                    mode=getattr(request, "retrieval_mode", None),
                )
            except Exception as exc:
                logger.warning(f"Evidence retrieval failed for claim '{c_text[:40]}': {exc}")
                evidence_chunks = []

            # 3b. Evaluate claim against retrieved evidence using CrossEncoder NLI
            try:
                nli_result = await asyncio.to_thread(
                    self.nli_service.evaluate_claim_against_evidence,
                    claim_text=c_text,
                    evidence_chunks=evidence_chunks,
                    claim_type=c_type,
                )
            except Exception as exc:
                logger.warning(f"NLI evaluation failed for claim '{c_text[:40]}': {exc}")
                nli_result = ClaimNLIResult(
                    claim_text=c_text,
                    claim_type=c_type,
                    verdict="UNVERIFIED",
                    confidence=0.0,
                    risk_level="MEDIUM",
                    risk_score=0.50,
                    explanation=f"Inference error: {exc}",
                )

            # 3c. Multi-Passage Sliding Context Expansion
            # If top single passage was neutral/unverified and we have multiple retrieved chunks,
            # evaluate a concatenated premise to verify cross-sentence propositions
            dp = nli_result.deciding_passage
            if (
                settings.nli_aggregation == "legacy"
                and nli_result.verdict == "UNVERIFIED"
                and len(evidence_chunks) >= 2
            ):
                try:
                    fused_evidence_text = "\n\n".join([c.chunk_text for c in evidence_chunks[:2]])
                    fused_probs = await asyncio.to_thread(
                        self.nli_service.predict_probabilities, [(fused_evidence_text, c_text)]
                    )
                    if fused_probs:
                        p_supp = fused_probs[0].get("SUPPORTED", 0.0)
                        p_contra = fused_probs[0].get("CONTRADICTED", 0.0)
                        if p_supp > 0.60 and p_supp > p_contra:
                            nli_result.verdict = "SUPPORTED"
                            nli_result.confidence = round(p_supp, 4)
                            nli_result.risk_level = "LOW"
                            nli_result.risk_score = round(max(0.05, 1.0 - p_supp), 4)
                            nli_result.explanation = (
                                f"Supported by multi-passage context across pages "
                                f"{', '.join(str(c.page_number) for c in evidence_chunks[:2])}."
                            )
                except Exception as exc:
                    logger.debug(f"Multi-passage expansion bypassed: {exc}")

            # Evidence model with hybrid RAG traceability
            evidence_model = None
            evidence_resp = None
            if dp:
                top_chunk = next((c for c in evidence_chunks if c.chunk_id == dp.chunk_id), None)
                dense_score = top_chunk.dense_score if top_chunk else None
                bm25_score = top_chunk.bm25_score if top_chunk else None
                retrieval_method = top_chunk.retrieval_method if top_chunk else "hybrid"
                matched_kw = top_chunk.matched_keywords if top_chunk else []

                evidence_model = EvidenceModel(
                    text=dp.evidence_text,
                    page_number=dp.page_number,
                    similarity_score=dp.retrieval_score,
                    dense_score=dense_score,
                    bm25_score=bm25_score,
                    retrieval_method=retrieval_method,
                    matched_keywords=matched_kw,
                )
                evidence_resp = Evidence(
                    text=dp.evidence_text,
                    page_number=dp.page_number,
                    similarity_score=dp.retrieval_score,
                    dense_score=dense_score,
                    bm25_score=bm25_score,
                    retrieval_method=retrieval_method,
                    matched_keywords=matched_kw,
                )
            elif evidence_chunks:
                # Top retrieved chunk when no deciding passage
                c0 = evidence_chunks[0]
                evidence_model = EvidenceModel(
                    text=c0.chunk_text,
                    page_number=c0.page_number,
                    similarity_score=c0.retrieval_score,
                    dense_score=c0.dense_score,
                    bm25_score=c0.bm25_score,
                    retrieval_method=c0.retrieval_method,
                    matched_keywords=c0.matched_keywords,
                )
                evidence_resp = Evidence(
                    text=c0.chunk_text,
                    page_number=c0.page_number,
                    similarity_score=c0.retrieval_score,
                    dense_score=c0.dense_score,
                    bm25_score=c0.bm25_score,
                    retrieval_method=c0.retrieval_method,
                    matched_keywords=c0.matched_keywords,
                )

            # NLI model
            nli_model = None
            nli_resp = None
            if dp:
                nli_model = NLIModel(
                    entailment=dp.p_supported,
                    contradiction=dp.p_contradicted,
                    neutral=dp.p_unverified,
                    label=dp.verdict,
                )
                nli_resp = NLIResult(
                    entailment=dp.p_supported,
                    contradiction=dp.p_contradicted,
                    neutral=dp.p_unverified,
                    label=dp.verdict,
                )

            # 3d. Deterministic checks: table arithmetic, figure grounding, temporal anchoring
            ev_text = (
                dp.evidence_text
                if dp
                else (evidence_chunks[0].chunk_text if evidence_chunks else "")
            )
            table_finding = None
            if doc_tables and c_type == "numerical":
                table_finding = self.numerical_reasoner.verify_claim_with_tables(c_text, doc_tables)

            disabled = {x.strip() for x in settings.disabled_checks.split(",") if x.strip()}
            grounding_passages = (
                [c.chunk_text for c in evidence_chunks]
                if "neighbours" in disabled
                else self._passages_with_neighbours(evidence_chunks, doc_chunks)
            )
            grounding = ground_figures(c_text, grounding_passages)
            if table_finding is None and grounding.status == UNGROUNDED and "derived_values" not in disabled:
                # The figure is not stated in the evidence: it may be a derived value
                # (growth rate, margin), so recompute it from the evidence figures.
                derived = self.numerical_reasoner.verify_numerical_claim(c_text, ev_text)
                if (
                    derived.finding_type in ("PERCENTAGE_CHANGE", "MARGIN_RATIO", "ABSOLUTE_DIFFERENCE")
                    and derived.comparison_outcome == "MISMATCH"
                    and derived.computed_result is not None
                ):
                    table_finding = derived
            novel = novel_entities(c_text, vocabulary)
            num_finding = table_finding or self._grounding_as_finding(grounding)
            temp_anchor = check_period(c_text, grounding.anchor_sentence)

            # 3e. Multi-Hop Reasoning for compound financial metrics
            multi_hop_finding_dict = None
            if "net debt" in c_text.lower() and (doc_chunks or doc_tables):
                try:
                    # Extract reported net debt figure from claim
                    num_entities = self.numerical_reasoner.extract_numeric_entities(c_text)
                    reported_val = (
                        num_entities[0].normalized_value
                        if num_entities and not num_entities[0].is_percentage
                        else None
                    )
                    mh_periods = self.numerical_reasoner.extract_temporal_periods(c_text)
                    target_yr = str(mh_periods[0].year) if mh_periods and mh_periods[0].year else None

                    mh_result = self.multi_hop_reasoner.compute_net_debt(
                        claim_reported_net_debt=reported_val,
                        target_period=target_yr,
                        chunks=doc_chunks or ([
                            DocumentChunkModel(
                                id=c.chunk_id,
                                document_id=c.document_id,
                                page_number=c.page_number,
                                chunk_index=i,
                                text=c.chunk_text,
                            )
                            for i, c in enumerate(evidence_chunks)
                        ]),
                        tables=doc_tables,
                    )
                    multi_hop_finding_dict = mh_result.model_dump()
                except Exception as exc:
                    logger.warning(f"Multi-hop synthesis skipped: {exc}")

            num_model = None
            num_resp = None
            if num_finding.finding_type != "NO_CALCULATION" or num_finding.comparison_outcome != "NO_CALCULATION":
                num_model = NumericalFindingModel(
                    finding_type=num_finding.finding_type,
                    formula=num_finding.formula,
                    operands=num_finding.operands,
                    computed_result=num_finding.computed_result,
                    reported_result=num_finding.reported_result,
                    tolerance=num_finding.tolerance,
                    comparison_outcome=num_finding.comparison_outcome,
                    explanation=num_finding.explanation,
                )
                num_resp = NumericalFindingResponse(
                    finding_type=num_finding.finding_type,
                    formula=num_finding.formula,
                    operands=num_finding.operands,
                    computed_result=num_finding.computed_result,
                    reported_result=num_finding.reported_result,
                    tolerance=num_finding.tolerance,
                    comparison_outcome=num_finding.comparison_outcome,
                    explanation=num_finding.explanation,
                )

            temp_model = None
            temp_resp = None
            if temp_anchor.claim_period or temp_anchor.evidence_period or temp_anchor.document_period:
                temp_model = TemporalAnchorModel(
                    claim_period=temp_anchor.claim_period,
                    evidence_period=temp_anchor.evidence_period,
                    document_period=temp_anchor.document_period,
                    period_match=temp_anchor.period_match,
                    explanation=temp_anchor.explanation,
                )
                temp_resp = TemporalAnchorResponse(
                    claim_period=temp_anchor.claim_period,
                    evidence_period=temp_anchor.evidence_period,
                    document_period=temp_anchor.document_period,
                    period_match=temp_anchor.period_match,
                    explanation=temp_anchor.explanation,
                )

            # 3f. Final verdict: NLI combined with the deterministic checks (see verdict_policy)
            verdict = synthesize_verdict(
                nli=nli_result,
                grounding=grounding,
                novel_entities=novel,
                table_finding=table_finding,
                temporal=temp_anchor,
                multi_hop=multi_hop_finding_dict,
                disabled=disabled,
            )
            claim_status = verdict.status
            claim_risk_level = verdict.risk_level
            hallucination_type = verdict.hallucination_type
            hallucination_risk_score = verdict.risk_score
            reasoning_summary = verdict.reasoning

            cm = ClaimModel(
                id=claim_id,
                session_id=session_id,
                claim_text=nli_result.claim_text,
                claim_type=nli_result.claim_type,
                status=claim_status,
                confidence=verdict.confidence,
                risk_level=claim_risk_level,
                source_sentence=nli_result.source_sentence,
                evidence=evidence_model,
                nli=nli_model,
                numerical_finding=num_model,
                temporal_anchor=temp_model,
                hallucination_type=hallucination_type,
                hallucination_risk_score=hallucination_risk_score,
                reasoning_summary=reasoning_summary,
                multi_hop_finding=multi_hop_finding_dict,
            )
            claim_models.append(cm)

            claim_responses.append(
                ClaimResponse(
                    id=cm.id,
                    claim_text=cm.claim_text,
                    claim_type=cm.claim_type,
                    status=cm.status,
                    confidence=cm.confidence,
                    risk_level=cm.risk_level,
                    source_sentence=cm.source_sentence,
                    evidence=evidence_resp,
                    nli=nli_resp,
                    numerical_finding=num_resp,
                    temporal_anchor=temp_resp,
                    hallucination_type=cm.hallucination_type,
                    hallucination_risk_score=cm.hallucination_risk_score,
                    reasoning_summary=cm.reasoning_summary,
                    multi_hop_finding=cm.multi_hop_finding,
                )
            )

        # 4. Compute overall verification metrics
        total_claims = len(claim_models)
        # A claim only counts as clean when NLI supports it AND the numerical,
        # temporal and multi-hop checks raised no hallucination flag; otherwise a
        # wrong figure in an NLI-"supported" sentence would inflate the score.
        clean_supported_count = sum(
            1 for c in claim_models
            if c.status == "SUPPORTED" and c.hallucination_type == "NONE"
        )

        overall_score = round((clean_supported_count / total_claims) * 100, 1) if total_claims > 0 else 0.0

        # HIGH risk is set per claim for contradictions, numerical mismatches,
        # temporal misalignment and multi-hop calculation conflicts.
        if any(c.risk_level == "HIGH" for c in claim_models):
            overall_risk = "HIGH"
        elif any(c.status == "UNVERIFIED" for c in claim_models):
            overall_risk = "MEDIUM"
        else:
            overall_risk = "LOW"

        # 5. Persist verification session in MongoDB
        session = VerificationSessionModel(
            id=session_id,
            user_id=user_id,
            tenant_id=tenant_id,
            document_id=doc_id,
            llm_output=llm_text,
            status="completed",
            overall_score=overall_score,
            risk_level=overall_risk,
        )

        try:
            if queued:
                await self.verification_repo.update_session(session)
            else:
                await self.verification_repo.create_session(session)
            if claim_models:
                await self.verification_repo.save_claims(claim_models)
        except Exception as exc:
            logger.error(f"Error saving verification session or claims: {exc}")
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Database error while saving verification results.",
            )

        metrics.VERIFICATIONS.labels(overall_risk).inc()
        for cm in claim_models:
            metrics.CLAIMS.labels(cm.status).inc()
        logger.info(
            f"Verification session completed: ID={session_id}, score={overall_score}%, risk={overall_risk}, claims={len(claim_models)}"
        )

        return VerificationResultResponse(
            id=session.id,
            document_id=session.document_id,
            overall_score=session.overall_score,
            risk_level=session.risk_level,
            status=session.status,
            claims=claim_responses,
        )

    async def create_queued_session(
        self, request: StartVerificationRequest, user_id: Optional[str], tenant_id: str
    ) -> VerificationSessionModel:
        """Validates the request and stores a session in 'queued' state for a background worker."""
        doc_id = request.document_id.strip()
        if not doc_id or not request.llm_output.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="document_id and llm_output cannot be empty.",
            )
        try:
            document = await self.document_repo.get_document_by_id(doc_id)
            if not document:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Document with ID '{doc_id}' not found.")
            session = VerificationSessionModel(
                id=str(uuid.uuid4()), user_id=user_id, tenant_id=tenant_id,
                document_id=doc_id, llm_output=request.llm_output.strip(), status="queued",
            )
            await self.verification_repo.create_session(session)
        except HTTPException:
            raise
        except Exception as exc:
            logger.error(f"Could not queue verification: {exc}")
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Database error while queueing verification."
            )
        return session

    async def get_session_status(self, session_id: str, tenant_id: Optional[str] = None) -> VerificationSessionModel:
        try:
            session = await self.verification_repo.get_session_by_id(session_id)
        except Exception as exc:
            logger.error(f"Error retrieving verification session: {exc}")
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Database error while retrieving verification session."
            )
        if session and tenant_id is not None and session.tenant_id != tenant_id:
            session = None
        if not session:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Verification session '{session_id}' not found.")
        return session

    async def get_results(self, session_id: str, tenant_id: Optional[str] = None) -> VerificationResultResponse:
        """
        Retrieves verification session and associated claims from MongoDB Atlas.
        """
        try:
            session = await self.verification_repo.get_session_by_id(session_id)
        except Exception as exc:
            logger.error(f"Error retrieving verification session: {exc}")
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Database error while retrieving verification session.",
            )

        if session and tenant_id is not None and session.tenant_id != tenant_id:
            session = None  # another tenant's session is reported as missing

        if not session:
            logger.warning(f"Verification session not found: '{session_id}'")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Verification session '{session_id}' not found.",
            )

        # Retrieve claims from MongoDB
        try:
            stored_claims = await self.verification_repo.get_claims_by_session_id(session_id)
        except Exception as exc:
            logger.error(f"Error retrieving claims for session '{session_id}': {exc}")
            stored_claims = []

        claim_responses = []
        for c in stored_claims:
            evidence_resp = (
                Evidence(
                    text=c.evidence.text,
                    page_number=c.evidence.page_number,
                    similarity_score=c.evidence.similarity_score,
                    dense_score=getattr(c.evidence, "dense_score", None),
                    bm25_score=getattr(c.evidence, "bm25_score", None),
                    retrieval_method=getattr(c.evidence, "retrieval_method", "hybrid"),
                    matched_keywords=getattr(c.evidence, "matched_keywords", []),
                )
                if c.evidence
                else None
            )
            nli_resp = (
                NLIResult(
                    entailment=c.nli.entailment,
                    contradiction=c.nli.contradiction,
                    neutral=c.nli.neutral,
                    label=c.nli.label,
                )
                if c.nli
                else None
            )
            num_resp = (
                NumericalFindingResponse(
                    finding_type=c.numerical_finding.finding_type,
                    formula=c.numerical_finding.formula,
                    operands=c.numerical_finding.operands,
                    computed_result=c.numerical_finding.computed_result,
                    reported_result=c.numerical_finding.reported_result,
                    tolerance=c.numerical_finding.tolerance,
                    comparison_outcome=c.numerical_finding.comparison_outcome,
                    explanation=c.numerical_finding.explanation,
                )
                if c.numerical_finding
                else None
            )
            temp_resp = (
                TemporalAnchorResponse(
                    claim_period=c.temporal_anchor.claim_period,
                    evidence_period=c.temporal_anchor.evidence_period,
                    document_period=c.temporal_anchor.document_period,
                    period_match=c.temporal_anchor.period_match,
                    explanation=c.temporal_anchor.explanation,
                )
                if c.temporal_anchor
                else None
            )
            claim_responses.append(
                ClaimResponse(
                    id=c.id,
                    claim_text=c.claim_text,
                    claim_type=c.claim_type,
                    status=c.status,
                    confidence=c.confidence,
                    risk_level=c.risk_level,
                    source_sentence=c.source_sentence,
                    evidence=evidence_resp,
                    nli=nli_resp,
                    numerical_finding=num_resp,
                    temporal_anchor=temp_resp,
                    hallucination_type=getattr(c, "hallucination_type", None),
                    hallucination_risk_score=getattr(c, "hallucination_risk_score", None),
                    reasoning_summary=getattr(c, "reasoning_summary", None),
                    multi_hop_finding=getattr(c, "multi_hop_finding", None),
                )
            )

        return VerificationResultResponse(
            id=session.id,
            document_id=session.document_id,
            overall_score=session.overall_score,
            risk_level=session.risk_level,
            status=session.status,
            claims=claim_responses,
        )
