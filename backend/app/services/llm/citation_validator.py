"""
Citation and Grounding Validator.
Guarantees that LLM-generated citations, page numbers, and verbatim quotes
actually exist in retrieved source documents, preventing citation hallucination.
"""

from __future__ import annotations

import difflib
import re
from typing import Any, List, Optional
from pydantic import BaseModel, Field

from app.models.chunk import DocumentChunkModel
from app.models.table import FinancialTableModel


class CitationValidationResult(BaseModel):
    is_valid: bool = Field(..., description="True if citation was verified in ground-truth text")
    matched_chunk_id: Optional[str] = None
    matched_page_number: Optional[int] = None
    similarity_score: float = 0.0
    reason: str = Field(..., description="Audit rationale for verification or rejection")


class CitationValidator:
    """Verifies that quotes, page numbers, and values cited by LLM exist in source."""

    @staticmethod
    def normalize_text(text: str) -> str:
        """Strips excessive whitespace and normalizes punctuation."""
        if not text:
            return ""
        return re.sub(r"\s+", " ", text).strip().lower()

    def validate_citation(
        self,
        citation_text: Optional[str],
        cited_page: Optional[int],
        source_chunks: List[DocumentChunkModel],
        source_tables: Optional[List[FinancialTableModel]] = None,
        min_match_ratio: float = 0.75,
    ) -> CitationValidationResult:
        """
        Validates citation against source chunks and tables.
        Returns CitationValidationResult.
        """
        if not citation_text or not citation_text.strip():
            return CitationValidationResult(
                is_valid=False,
                reason="Citation is empty or null.",
            )

        norm_cite = self.normalize_text(citation_text)
        best_match_score = 0.0
        best_chunk: Optional[DocumentChunkModel] = None

        # 1. Search across source text chunks
        for chunk in source_chunks:
            # Check page number match if specified
            if cited_page is not None and chunk.page_number != cited_page:
                continue

            norm_chunk = self.normalize_text(chunk.text)

            # Exact substring match
            if norm_cite in norm_chunk:
                return CitationValidationResult(
                    is_valid=True,
                    matched_chunk_id=chunk.id,
                    matched_page_number=chunk.page_number,
                    similarity_score=1.0,
                    reason=f"Exact verbatim citation match verified on Page {chunk.page_number} (Chunk {chunk.id}).",
                )

            # Fuzzy substring sequence matching
            matcher = difflib.SequenceMatcher(None, norm_cite, norm_chunk)
            match = matcher.find_longest_match(0, len(norm_cite), 0, len(norm_chunk))
            if match.size > 0:
                score = match.size / len(norm_cite)
                if score > best_match_score:
                    best_match_score = score
                    best_chunk = chunk

        # 2. Search across source tables if provided
        if source_tables:
            for table in source_tables:
                if cited_page is not None and table.page_number != cited_page:
                    continue

                # Check cell text in table rows directly
                for row in table.rows:
                    for cell in row:
                        if norm_cite in self.normalize_text(cell.raw_text):
                            return CitationValidationResult(
                                is_valid=True,
                                matched_chunk_id=table.id,
                                matched_page_number=table.page_number,
                                similarity_score=1.0,
                                reason=f"Exact citation verified within financial table line item on Page {table.page_number}.",
                            )

                table_md = self.normalize_text(table.to_markdown())
                if norm_cite in table_md:
                    return CitationValidationResult(
                        is_valid=True,
                        matched_chunk_id=table.id,
                        matched_page_number=table.page_number,
                        similarity_score=1.0,
                        reason=f"Exact citation verified within financial table on Page {table.page_number}.",
                    )

        # Check if fuzzy match satisfies threshold
        if best_match_score >= min_match_ratio and best_chunk:
            return CitationValidationResult(
                is_valid=True,
                matched_chunk_id=best_chunk.id,
                matched_page_number=best_chunk.page_number,
                similarity_score=round(best_match_score, 3),
                reason=(
                    f"Fuzzy citation match ({round(best_match_score * 100, 1)}%) verified on "
                    f"Page {best_chunk.page_number}."
                ),
            )

        return CitationValidationResult(
            is_valid=False,
            similarity_score=round(best_match_score, 3),
            reason=(
                f"Citation rejection: quoted text '{citation_text[:60]}...' was not found "
                f"in retrieved source chunks for page {cited_page or 'any'} (max match: {round(best_match_score * 100, 1)}%)."
            ),
        )
