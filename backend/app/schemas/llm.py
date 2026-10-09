"""
Pydantic v2 schemas for LLM structured outputs, atomic claim extraction,
grounded explanation generation, and citation verification.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field


class LLMExtractedClaim(BaseModel):
    """An atomic financial claim extracted from financial documents."""
    model_config = ConfigDict(extra="ignore")

    claim_id: Optional[str] = Field(default=None, description="Application-assigned stable identifier")
    claim_text: str = Field(..., description="One atomic, verifiable statement")
    claim_type: str = Field(default="factual", description="'numerical' or 'factual'")
    entity: Optional[str] = Field(default=None, description="Primary company or financial entity")
    entities: List[str] = Field(default_factory=list, description="All extracted corporate entities or metrics")
    metric: Optional[str] = Field(default=None, description="Reported financial metric e.g. Revenue, Net Income")
    value: Optional[float] = Field(default=None, description="Extracted quantitative value")
    unit: Optional[str] = Field(default=None, description="Unit e.g. million, billion, percent, shares")
    currency: Optional[str] = Field(default=None, description="Currency e.g. USD, EUR")
    reporting_period: Optional[str] = Field(default=None, description="Reporting period e.g. FY2024, Q3 2023")
    source_document_id: Optional[str] = Field(default=None, description="Application-attached document ID")
    source_page: Optional[int] = Field(default=None, description="Grounded page number in source document")
    source_chunk_id: Optional[str] = Field(default=None, description="Application-attached chunk identifier")
    source_citation: Optional[str] = Field(default=None, description="Verbatim quote cited from input text")
    cited_page_number: Optional[int] = Field(default=None, description="Page number cited in text")
    needs_review: bool = Field(default=False, description="Flagged for human review if ambiguous or incomplete")


class LLMClaimExtractionResponse(BaseModel):
    """Structured response container for atomic claim extraction."""
    model_config = ConfigDict(extra="ignore")

    claims: List[LLMExtractedClaim] = Field(default_factory=list)
    total_claims: int = Field(default=0)


class LLMEvidenceItem(BaseModel):
    """A referenced supporting evidence element with provenance."""
    model_config = ConfigDict(extra="ignore")

    source_id: str = Field(..., description="Foreign key to chunk ID or table ID")
    page_number: int = Field(..., description="Page number of evidence")
    verbatim_quote: str = Field(..., description="Direct quote from document")
    fact_type: str = Field(default="direct_fact", description="'direct_fact', 'table_row', or 'footnote'")


class LLMMultiHopSynthesis(BaseModel):
    """Multi-hop reasoning synthesizing multiple distinct source passages."""
    model_config = ConfigDict(extra="ignore")

    target_metric: str = Field(..., description="The compound financial metric e.g. Net Debt")
    direct_evidence: List[LLMEvidenceItem] = Field(default_factory=list)
    derived_calculations: List[Dict[str, Any]] = Field(
        default_factory=list,
        description="Explicit formulas e.g. Net Debt = Gross Debt - Cash",
    )
    unresolved_assumptions: List[str] = Field(
        default_factory=list,
        description="Missing operands or ambiguous definitions that prevent conclusion",
    )
    is_conclusive: bool = Field(default=False, description="True if all operands are grounded without guessing")
    explanation: str = Field(..., description="Detailed audit explanation of derivation")


class LLMExplanationResponse(BaseModel):
    """Grounding-audited explanation of an existing claim verification outcome."""
    model_config = ConfigDict(extra="ignore")

    summary: str = Field(..., description="Concise explanation grounded in retrieved evidence")
    claim_id: Optional[str] = Field(default=None, description="Associated claim ID")
    source_facts: List[str] = Field(default_factory=list, description="Facts directly verifiable from source text")
    inferred_relationships: List[str] = Field(default_factory=list, description="Logical inferences made")
    missing_evidence: List[str] = Field(default_factory=list, description="Required information not found in text")
    uncertainty_note: Optional[str] = Field(default=None, description="Limitation or ambiguity note")
    recommend_review: bool = Field(default=False, description="True if human review is advised due to conflicts")
    evidence_references: List[Dict[str, Any]] = Field(default_factory=list, description="References to retrieved evidence")
    citation_validations: List[Dict[str, Any]] = Field(
        default_factory=list,
        description="Audit checks verifying each quotation actually exists in source text",
    )
