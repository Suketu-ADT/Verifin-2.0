"""
Financial Extractor Service utilizing LLM with fallback to deterministic algorithms.
Handles atomic claim extraction, entity/period parsing, and citation validation.
Ensures source metadata (document ID, page number, chunk ID) is attached exclusively
from trusted application metadata, never invented by the LLM.
"""

from __future__ import annotations

import re
from typing import List, Optional, Set
from app.config import settings
from app.models.chunk import DocumentChunkModel
from app.models.table import FinancialTableModel
from app.schemas.llm import (
    LLMClaimExtractionResponse,
    LLMExtractedClaim,
)
from app.services.claim_extractor import ClaimExtractor
from app.services.llm.base import LLMProvider
from app.services.llm.citation_validator import CitationValidator
from app.services.llm.factory import get_llm_provider
from app.services.llm.mock_provider import MockLLMProvider
from app.utils.logging import logger


class FinancialExtractorService:
    """Extracts atomic financial claims and validates citations against ground truth."""

    CLAIM_EXTRACTION_SYSTEM_PROMPT = (
        "You are a financial information extraction specialist. "
        "Extract all atomic financial claims from the input text into discrete, testable propositions. "
        "For each claim, extract the atomic claim_text, and if supported by the text: "
        "entity (e.g. Apple Inc.), metric (e.g. Revenue, Operating Expenses), value (as number), "
        "unit (e.g. billion, million, percent), and reporting_period (e.g. FY2024, Q3 2023). "
        "If an attribute is not explicitly mentioned, leave it null. Do NOT invent values or quotations. "
        "Distinguish direct facts from inferred relationships. Do NOT output source IDs or page numbers."
    )

    def __init__(
        self,
        llm_provider: Optional[LLMProvider] = None,
        citation_validator: Optional[CitationValidator] = None,
    ):
        self.llm = llm_provider or get_llm_provider()
        self.validator = citation_validator or CitationValidator()
        self.fallback_extractor = ClaimExtractor()

    def _deduplicate_claims(self, claims: List[LLMExtractedClaim]) -> List[LLMExtractedClaim]:
        """Deduplicates claims based on normalized claim text."""
        seen: Set[str] = set()
        unique: List[LLMExtractedClaim] = []
        for c in claims:
            norm = re.sub(r"\s+", " ", c.claim_text).strip().lower()
            if norm and norm not in seen:
                seen.add(norm)
                unique.append(c)
        return unique

    async def extract_claims(
        self,
        text: str,
        document_id: Optional[str] = None,
        source_chunks: Optional[List[DocumentChunkModel]] = None,
        source_tables: Optional[List[FinancialTableModel]] = None,
        user_id: Optional[str] = None,
    ) -> List[LLMExtractedClaim]:
        """
        Extracts atomic financial claims using configured LLM with fallback to deterministic rule parser.
        Grounds citations and metadata strictly against trusted application chunks and tables.
        Applies batch size boundaries and deterministic deduplication.
        """
        if not text or not text.strip():
            return []

        doc_prefix = document_id or "doc"

        # Check if LLM provider is available
        is_mock_empty = (
            isinstance(self.llm, MockLLMProvider) and self.llm._canned_response is None
        )

        extracted: List[LLMExtractedClaim] = []

        if self.llm and self.llm.is_configured and not is_mock_empty:
            try:
                # Enforce input limit; process in batches if text exceeds max_input_chars
                max_chars = settings.llm_max_input_chars - 1000  # reserve buffer for prompt
                text_batches = (
                    [text[i : i + max_chars] for i in range(0, len(text), max_chars)]
                    if len(text) > max_chars
                    else [text]
                )

                for batch_idx, batch_text in enumerate(text_batches):
                    prompt = (
                        f"Extract all atomic financial claims from the following source text:\n\n"
                        f"{batch_text}"
                    )
                    structured_res: LLMClaimExtractionResponse = await self.llm.generate_structured(
                        prompt=prompt,
                        response_model=LLMClaimExtractionResponse,
                        system_instruction=self.CLAIM_EXTRACTION_SYSTEM_PROMPT,
                    )
                    extracted.extend(structured_res.claims)

            except Exception as exc:
                logger.warning(
                    f"LLM claim extraction failed ({exc}); falling back to deterministic ClaimExtractor."
                )
                extracted = []

        # If LLM returned no claims or failed/unconfigured, run deterministic fallback
        if not extracted:
            raw_claims = self.fallback_extractor.extract_claims(text)
            for rc in raw_claims:
                extracted.append(
                    LLMExtractedClaim(
                        claim_text=rc["claim_text"],
                        claim_type=rc["claim_type"],
                        source_citation=rc["source_sentence"],
                    )
                )

        # Deduplicate claims
        unique_claims = self._deduplicate_claims(extracted)

        # Application-level Metadata Grounding and Stable IDs:
        # The LLM is never trusted to invent source IDs or page numbers.
        # We attach trusted application metadata by verifying against source chunks/tables.
        for idx, claim in enumerate(unique_claims):
            claim.claim_id = f"{doc_prefix}_claim_{idx + 1}"
            claim.source_document_id = document_id

            if source_chunks and claim.source_citation:
                val = self.validator.validate_citation(
                    citation_text=claim.source_citation,
                    cited_page=claim.cited_page_number,
                    source_chunks=source_chunks,
                    source_tables=source_tables,
                )
                if val.is_valid:
                    claim.source_chunk_id = val.matched_chunk_id
                    claim.source_page = val.matched_page_number
                else:
                    # Grounding rejection: reset ungrounded citations and flag for review
                    logger.warning(
                        f"Grounding rejection: Citation '{claim.source_citation[:40]}' not verified in source. Resetting."
                    )
                    claim.source_citation = None
                    claim.cited_page_number = None
                    claim.needs_review = True
            elif source_chunks and not claim.source_page:
                # If no explicit citation provided, attempt fuzzy match of claim_text
                val = self.validator.validate_citation(
                    citation_text=claim.claim_text,
                    cited_page=None,
                    source_chunks=source_chunks,
                    source_tables=source_tables,
                    min_match_ratio=0.70,
                )
                if val.is_valid:
                    claim.source_chunk_id = val.matched_chunk_id
                    claim.source_page = val.matched_page_number

        return unique_claims
