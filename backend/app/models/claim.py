"""
Claim and evidence models for verification results stored in MongoDB.
"""

from datetime import datetime, timezone
from typing import Optional
from pydantic import BaseModel, Field


class EvidenceModel(BaseModel):
    text: str
    page_number: int
    similarity_score: float


class NLIModel(BaseModel):
    entailment: float
    contradiction: float
    neutral: float
    label: str


class NumericalFindingModel(BaseModel):
    finding_type: str
    formula: Optional[str] = None
    operands: dict = Field(default_factory=dict)
    computed_result: Optional[float] = None
    reported_result: Optional[float] = None
    tolerance: Optional[float] = None
    comparison_outcome: str
    explanation: str


class TemporalAnchorModel(BaseModel):
    claim_period: Optional[str] = None
    evidence_period: Optional[str] = None
    document_period: Optional[str] = None
    period_match: str
    explanation: str


class ClaimModel(BaseModel):
    id: str = Field(..., description="Unique claim ID")
    session_id: str
    claim_text: str
    claim_type: str
    status: str
    confidence: Optional[float] = None
    risk_level: Optional[str] = None
    source_sentence: Optional[str] = None
    evidence: Optional[EvidenceModel] = None
    nli: Optional[NLIModel] = None
    numerical_finding: Optional[NumericalFindingModel] = None
    temporal_anchor: Optional[TemporalAnchorModel] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
