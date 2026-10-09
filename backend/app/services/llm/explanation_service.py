"""
Evidence-Grounded Explanation Service for VERIFIN 2.0.
Generates structured, grounding-audited explanations for claim verification outcomes.
Treats NLI verdicts and deterministic numerical checks as strictly authoritative.
Validates all cited source references against retrieved chunks to prevent hallucination.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional
from app.models.chunk import DocumentChunkModel
from app.schemas.llm import LLMExplanationResponse
from app.services.llm.base import LLMProvider
from app.services.llm.citation_validator import CitationValidator
from app.services.llm.factory import get_llm_provider
from app.services.llm.mock_provider import MockLLMProvider
from app.utils.logging import logger


class GroundedExplanationService:
    """
    Connects LLM to retrieved evidence and verification results.
    Never alters NLI/numerical verdicts and ensures all citations exist in source text.
    """

    SYSTEM_PROMPT = (
        "You are an interpretable financial verification explainer. "
        "Your task is to provide a concise explanation for an EXISTING verification verdict. "
        "The verification verdict (SUPPORTED, CONTRADICTED, or UNVERIFIED) and numerical check results "
        "are FIXED authoritative facts determined by the system. You must NOT alter or disagree with them. "
        "Ground your explanation entirely in the provided retrieved evidence passages. "
        "Separate direct source facts, logical inferences, and missing evidence. "
        "Do NOT invent quotations, page numbers, numbers, or external facts. "
        "If evidence is insufficient or contradictory, recommend human review."
    )

    def __init__(
        self,
        llm_provider: Optional[LLMProvider] = None,
        citation_validator: Optional[CitationValidator] = None,
    ):
        self.llm = llm_provider or get_llm_provider()
        self.validator = citation_validator or CitationValidator()

    @staticmethod
    def _detect_verdict_conflict(summary: str, authoritative_verdict: str) -> bool:
        """
        Detects if LLM-generated explanation conflicts with authoritative NLI/numerical verdict.
        """
        if not summary:
            return False
        s_lower = summary.lower()
        verdict = authoritative_verdict.upper()

        if verdict == "CONTRADICTED":
            positive_indicators = [
                "claim is supported",
                "claim is true",
                "fully verified",
                "confirmed by evidence",
                "claim is accurate",
                "claim is correct",
                "verdict is supported",
            ]
            contradiction_indicators = [
                "contradicted",
                "false",
                "discrepancy",
                "inconsistent",
                "incorrect",
                "mismatch",
                "exceeds",
                "differs",
                "unsupported",
            ]
            if any(pos in s_lower for pos in positive_indicators) and not any(neg in s_lower for neg in contradiction_indicators):
                return True

        elif verdict == "SUPPORTED":
            negative_indicators = [
                "claim is contradicted",
                "claim is false",
                "refuted",
                "claim is incorrect",
                "unsupported",
                "claim is refuted",
                "verdict is contradicted",
            ]
            support_indicators = [
                "supported",
                "consistent",
                "verified",
                "confirms",
                "matches",
                "accurate",
            ]
            if any(neg in s_lower for neg in negative_indicators) and not any(pos in s_lower for pos in support_indicators):
                return True

        return False

    async def generate_explanation(
        self,
        claim_text: str,
        retrieved_chunks: List[DocumentChunkModel],
        nli_verdict: str,
        nli_confidence: float,
        numerical_summary: Optional[str] = None,
        claim_id: Optional[str] = None,
    ) -> LLMExplanationResponse:
        """
        Generates an evidence-grounded explanation of a verification outcome.
        Validates all quotations and evidence references against real stored chunks.
        """
        # Format evidence context
        evidence_snippets = []
        for idx, chk in enumerate(retrieved_chunks):
            evidence_snippets.append(
                f"[Evidence Chunk {chk.id} | Page {chk.page_number}]:\n\"{chk.text}\""
            )
        evidence_text = "\n\n".join(evidence_snippets) if evidence_snippets else "No matching evidence passages retrieved."

        # Baseline deterministic explanation fallback
        default_summary = (
            f"The claim was evaluated as {nli_verdict.upper()} (confidence: {nli_confidence:.1%}). "
            + (f"Numerical verification check: {numerical_summary}. " if numerical_summary else "")
            + (f"Supported by evidence on Page {retrieved_chunks[0].page_number}." if retrieved_chunks and nli_verdict == "SUPPORTED" else "")
        ).strip()

        # Check if LLM provider is available
        is_mock_empty = isinstance(self.llm, MockLLMProvider) and self.llm._canned_response is None
        if not self.llm or not self.llm.is_configured or is_mock_empty:
            return LLMExplanationResponse(
                summary=default_summary,
                claim_id=claim_id,
                source_facts=[c.text[:120] for c in retrieved_chunks[:2]],
                inferred_relationships=[],
                missing_evidence=[] if retrieved_chunks else ["No evidence chunks retrieved."],
                uncertainty_note=None if nli_verdict == "SUPPORTED" else "Verification inconclusive or contested.",
                recommend_review=nli_verdict in ("UNVERIFIED", "CONTRADICTED"),
                evidence_references=[
                    {"chunk_id": c.id, "page_number": c.page_number}
                    for c in retrieved_chunks
                ],
            )

        prompt = (
            f"CLAIM TO EXPLAIN:\n\"{claim_text}\"\n\n"
            f"AUTHORITATIVE SYSTEM VERDICT: {nli_verdict.upper()} (Confidence: {nli_confidence:.1%})\n"
            f"NUMERICAL VERIFICATION STATUS: {numerical_summary or 'No numerical calculation required'}\n\n"
            f"RETRIEVED SOURCE EVIDENCE PASSAGES:\n{evidence_text}\n\n"
            f"Provide a structured explanation conforming to the schema. "
            f"Do not invent facts not present in the evidence."
        )

        try:
            explanation_res: LLMExplanationResponse = await self.llm.generate_structured(
                prompt=prompt,
                response_model=LLMExplanationResponse,
                system_instruction=self.SYSTEM_PROMPT,
            )

            # Post-generation Grounding Audit:
            # Validate every source_fact or quoted citation against retrieved chunks
            audited_facts: List[str] = []
            audit_checks: List[Dict[str, Any]] = []
            has_hallucination = False

            for fact in explanation_res.source_facts:
                val = self.validator.validate_citation(
                    citation_text=fact,
                    cited_page=None,
                    source_chunks=retrieved_chunks,
                )
                audit_checks.append({
                    "fact": fact[:80],
                    "is_grounded": val.is_valid,
                    "matched_page": val.matched_page_number,
                    "matched_chunk_id": val.matched_chunk_id,
                    "reason": val.reason,
                })
                if val.is_valid:
                    audited_facts.append(fact)
                else:
                    has_hallucination = True
                    logger.warning(
                        f"Explanation grounding rejection: Fact '{fact[:50]}' was not verifiable in retrieved chunks."
                    )

            explanation_res.source_facts = audited_facts
            explanation_res.citation_validations = audit_checks
            explanation_res.claim_id = claim_id

            # 1. Reject fabricated or unauthorized evidence references
            valid_chunk_ids = {c.id for c in retrieved_chunks}
            valid_page_numbers = {c.page_number for c in retrieved_chunks}
            rejected_refs = False

            if explanation_res.evidence_references:
                sanitized_refs = []
                for ref in explanation_res.evidence_references:
                    c_id = ref.get("chunk_id")
                    p_num = ref.get("page_number")
                    if c_id in valid_chunk_ids and (p_num is None or p_num in valid_page_numbers):
                        sanitized_refs.append(ref)
                    else:
                        rejected_refs = True
                        logger.warning(
                            f"Rejected unauthorized evidence reference: chunk_id={c_id}, page={p_num}"
                        )
                if not sanitized_refs and retrieved_chunks:
                    sanitized_refs = [
                        {"chunk_id": c.id, "page_number": c.page_number}
                        for c in retrieved_chunks
                    ]
                explanation_res.evidence_references = sanitized_refs
            else:
                # Attach actual stored chunk references
                explanation_res.evidence_references = [
                    {"chunk_id": c.id, "page_number": c.page_number}
                    for c in retrieved_chunks
                ]

            if rejected_refs:
                explanation_res.recommend_review = True
                explanation_res.uncertainty_note = (
                    (explanation_res.uncertainty_note or "")
                    + " Unauthorized or fabricated evidence references were rejected."
                ).strip()

            # 2. Check for verdict conflict between LLM explanation and authoritative system verdict
            if self._detect_verdict_conflict(explanation_res.summary, nli_verdict):
                explanation_res.recommend_review = True
                conflict_note = (
                    f"Discrepancy detected: LLM explanation appears to conflict with authoritative "
                    f"verdict ({nli_verdict.upper()}). Authoritative verdict remains immutable."
                )
                explanation_res.uncertainty_note = (
                    f"{explanation_res.uncertainty_note} {conflict_note}".strip()
                    if explanation_res.uncertainty_note
                    else conflict_note
                )
                logger.warning(
                    f"LLM explanation conflicted with authoritative verdict {nli_verdict}; discrepancy flagged for review."
                )

            return explanation_res

        except Exception as exc:
            logger.warning(f"LLM explanation generation failed ({exc}); using deterministic fallback.")
            return LLMExplanationResponse(
                summary=default_summary,
                claim_id=claim_id,
                source_facts=[c.text[:120] for c in retrieved_chunks[:2]],
                inferred_relationships=[],
                missing_evidence=[] if retrieved_chunks else ["No evidence chunks retrieved."],
                recommend_review=nli_verdict in ("UNVERIFIED", "CONTRADICTED"),
                evidence_references=[
                    {"chunk_id": c.id, "page_number": c.page_number}
                    for c in retrieved_chunks
                ],
            )
