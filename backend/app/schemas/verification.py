"""
Verification API schemas matching frontend VerificationResultResponse contract.
Enhanced with Hybrid RAG scores, Hallucination Diagnostics, and Multi-Hop synthesis traces.
"""

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field


class Evidence(BaseModel):
    model_config = ConfigDict(extra="ignore")

    text: str
    page_number: int
    similarity_score: float
    dense_score: Optional[float] = None
    bm25_score: Optional[float] = None
    retrieval_method: Optional[str] = None
    matched_keywords: List[str] = Field(default_factory=list)


class NLIResult(BaseModel):
    model_config = ConfigDict(extra="ignore")

    entailment: float
    contradiction: float
    neutral: float
    label: str


class NumericalFindingResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")

    finding_type: str
    formula: Optional[str] = None
    operands: Dict[str, Any] = Field(default_factory=dict)
    computed_result: Optional[float] = None
    reported_result: Optional[float] = None
    tolerance: Optional[float] = None
    comparison_outcome: str
    explanation: str


class TemporalAnchorResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")

    claim_period: Optional[str] = None
    evidence_period: Optional[str] = None
    document_period: Optional[str] = None
    period_match: str
    explanation: str


class ClaimResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")

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
    hallucination_type: Optional[str] = None
    hallucination_risk_score: Optional[float] = None
    reasoning_summary: Optional[str] = None
    multi_hop_finding: Optional[Dict[str, Any]] = None


class StartVerificationRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")

    document_id: str = Field(..., min_length=1, description="ID of previously uploaded document")
    llm_output: str = Field(..., min_length=1, description="LLM output text to verify")
    retrieval_mode: Optional[str] = Field(None, description="Retrieval mode: 'hybrid', 'dense', or 'bm25'")


class VerificationResultResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str
    document_id: str
    overall_score: float
    risk_level: str
    status: str
    claims: List[ClaimResponse] = Field(default_factory=list)
