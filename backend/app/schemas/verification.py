"""
Verification API schemas matching frontend VerificationResultResponse contract.
Enhanced with Hybrid RAG scores, Hallucination Diagnostics, and Multi-Hop synthesis traces.
"""

from datetime import datetime
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
    decided_by: Optional[str] = None


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
    provenance: Dict[str, Any] = Field(default_factory=dict)
    created_at: Optional[datetime] = None


class VerificationJobResponse(BaseModel):
    """Returned with 202 when a verification is queued; poll ``status_url`` until it is completed or failed."""

    id: str
    status: str
    status_url: str
    results_url: str


class VerificationStatusResponse(BaseModel):
    id: str
    document_id: str
    status: str  # queued, running, completed, failed
    error: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class BatchItemRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")

    document_id: str = Field(..., min_length=1)
    llm_output: str = Field(..., min_length=1)
    reference: Optional[str] = Field(None, max_length=120, description="Your own identifier, echoed back")


class BatchRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")

    items: List[BatchItemRequest] = Field(..., min_length=1)


class BatchItemStatus(BaseModel):
    index: int
    reference: Optional[str] = None
    document_id: str
    session_id: str
    status: str
    error: Optional[str] = None
    overall_score: Optional[float] = None
    risk_level: Optional[str] = None
    results_url: str


class BatchResponse(BaseModel):
    id: str
    status: str  # queued, running, completed, completed_with_failures
    total: int
    counts: Dict[str, int]
    status_url: str
    items: List[BatchItemStatus]
    created_at: datetime


class VerificationSummary(BaseModel):
    """One row of the verification history."""

    id: str
    document_id: str
    document_name: Optional[str] = None
    statement_preview: str
    status: str
    risk_level: str
    overall_score: float
    claim_counts: Dict[str, int] = Field(default_factory=dict)
    created_at: datetime
