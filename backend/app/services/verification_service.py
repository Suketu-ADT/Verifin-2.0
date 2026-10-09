"""
Verification service handling claim extraction, evidence retrieval,
Cross-Encoder NLI verification, and session persistence in MongoDB Atlas.
"""

from __future__ import annotations

import uuid
from typing import List, Optional
from fastapi import HTTPException, status

from app.models.claim import (
    ClaimModel,
    EvidenceModel,
    NLIModel,
    NumericalFindingModel,
    TemporalAnchorModel,
)
from app.models.verification import VerificationSessionModel
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
from app.services.nli_service import (
    ClaimNLIResult,
    NLIService,
    get_nli_service,
)
from app.services.numerical_reasoner import NumericalReasonerService
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
    ):
        self.verification_repo = verification_repo or VerificationRepository()
        self.document_repo = document_repo or DocumentRepository()
        self.retrieval_service = retrieval_service or RetrievalService()
        self.nli_service = nli_service or get_nli_service()
        self.claim_extractor = claim_extractor or ClaimExtractor()
        self.numerical_reasoner = numerical_reasoner or NumericalReasonerService()
        self.table_repo = table_repo or TableRepository()

    async def start_verification_session(
        self, request: StartVerificationRequest, user_id: Optional[str] = None
    ) -> VerificationResultResponse:
        """
        Validates request, extracts claims, retrieves document evidence,
        executes Cross-Encoder NLI verification, and stores results in MongoDB Atlas.
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

        session_id = str(uuid.uuid4())

        # 2. Extract discrete financial claims from LLM output
        extracted_claims = self.claim_extractor.extract_claims(llm_text)
        if not extracted_claims:
            extracted_claims = [{
                "claim_text": llm_text,
                "claim_type": "factual",
                "source_sentence": llm_text,
            }]

        claim_models: List[ClaimModel] = []
        claim_responses: List[ClaimResponse] = []

        # Retrieve structured tables if available for this document
        try:
            doc_tables = await self.table_repo.get_tables_by_document_id(doc_id)
        except Exception as exc:
            logger.warning(f"Failed to query structured tables for doc {doc_id}: {exc}")
            doc_tables = []

        # 3. Process each claim through Evidence Retrieval & CrossEncoder NLI
        for idx, ec in enumerate(extracted_claims):
            claim_id = f"{session_id}_c{idx}"
            c_text = ec["claim_text"]
            c_type = ec["claim_type"]

            # 3a. Retrieve evidence chunks for this claim
            try:
                evidence_chunks = await self.retrieval_service.retrieve_evidence(
                    query=c_text,
                    document_id=doc_id,
                )
            except Exception as exc:
                logger.warning(f"Evidence retrieval failed for claim '{c_text[:40]}': {exc}")
                evidence_chunks = []

            # 3b. Evaluate claim against retrieved evidence using NLI
            try:
                nli_result = self.nli_service.evaluate_claim_against_evidence(
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

            evidence_model = None
            evidence_resp = None
            if nli_result.deciding_passage:
                dp = nli_result.deciding_passage
                evidence_model = EvidenceModel(
                    text=dp.evidence_text,
                    page_number=dp.page_number,
                    similarity_score=dp.retrieval_score,
                )
                evidence_resp = Evidence(
                    text=dp.evidence_text,
                    page_number=dp.page_number,
                    similarity_score=dp.retrieval_score,
                )

            nli_model = None
            nli_resp = None
            if nli_result.deciding_passage:
                dp = nli_result.deciding_passage
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

            # 3c. Evaluate deterministic numerical reasoning and temporal anchoring
            ev_text = (
                dp.evidence_text
                if nli_result.deciding_passage
                else (evidence_chunks[0].text if evidence_chunks else "")
            )
            table_finding = None
            if doc_tables and c_type == "numerical":
                table_finding = self.numerical_reasoner.verify_claim_with_tables(c_text, doc_tables)

            num_finding = table_finding or self.numerical_reasoner.verify_numerical_claim(
                claim_text=c_text,
                evidence_text=ev_text,
            )
            temp_anchor = self.numerical_reasoner.verify_temporal_alignment(
                claim_text=c_text,
                evidence_text=ev_text,
                doc_metadata={"filename": document.filename} if document else None,
            )

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

            cm = ClaimModel(
                id=claim_id,
                session_id=session_id,
                claim_text=nli_result.claim_text,
                claim_type=nli_result.claim_type,
                status=nli_result.verdict,
                confidence=nli_result.confidence,
                risk_level=nli_result.risk_level,
                source_sentence=nli_result.source_sentence,
                evidence=evidence_model,
                nli=nli_model,
                numerical_finding=num_model,
                temporal_anchor=temp_model,
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
                )
            )

        # 4. Compute overall verification metrics
        total_claims = len(claim_models)
        supported_count = sum(1 for c in claim_models if c.status == "SUPPORTED")
        contradicted_count = sum(1 for c in claim_models if c.status == "CONTRADICTED")

        overall_score = round((supported_count / total_claims) * 100, 1) if total_claims > 0 else 0.0

        if contradicted_count > 0:
            overall_risk = "HIGH"
        elif any(c.status == "UNVERIFIED" for c in claim_models):
            overall_risk = "MEDIUM"
        else:
            overall_risk = "LOW"

        # 5. Persist verification session in MongoDB
        session = VerificationSessionModel(
            id=session_id,
            user_id=user_id,
            document_id=doc_id,
            llm_output=llm_text,
            status="completed",
            overall_score=overall_score,
            risk_level=overall_risk,
        )

        try:
            await self.verification_repo.create_session(session)
            if claim_models:
                await self.verification_repo.save_claims(claim_models)
        except Exception as exc:
            logger.error(f"Error saving verification session or claims: {exc}")
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Database error while saving verification results.",
            )

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

    async def get_results(self, session_id: str) -> VerificationResultResponse:
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
