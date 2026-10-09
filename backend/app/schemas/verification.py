"""
Verification API schemas matching frontend VerificationResultResponse contract.
"""

from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field


class Evidence(BaseModel):
    model_config = ConfigDict(extra="forbid")

    text: str
    page_number: int
    similarity_score: float


class NLIResult(BaseModel):
    model_config = ConfigDict(extra="forbid")

    entailment: float
    contradiction: float
    neutral: float
    label: str


class NumericalFindingResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    finding_type: str
    formula: Optional[str] = None
    operands: dict = Field(default_factory=dict)
    computed_result: Optional[float] = None
    reported_result: Optional[float] = None
    tolerance: Optional[float] = None
    comparison_outcome: str
    explanation: str


class TemporalAnchorResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    claim_period: Optional[str] = None
    evidence_period: Optional[str] = None
    document_period: Optional[str] = None
    period_match: str
    explanation: str


class ClaimResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    claim_text: str
    claim_type: str
    status: str
    confidence: Optional[float] = None
    risk_level: Optional[str] = None
    source_sentence: Optional[str] = None
    evidence: Optional[Evidence] = None
    nli: Optional[NLIResult] = None
    numerical_finding: Optional[NumericalFindingResponse] = None
    temporal_anchor: Optional[TemporalAnchorResponse] = None


class StartVerificationRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    document_id: str = Field(..., min_length=1, description="ID of previously uploaded document")
    llm_output: str = Field(..., min_length=1, description="LLM output text to verify")


class VerificationResultResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    document_id: str
    overall_score: float
    risk_level: str
    status: str
    claims: List[ClaimResponse] = Field(default_factory=list)
