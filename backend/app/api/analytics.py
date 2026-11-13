"""
Analytics: aggregate numbers over the caller's organisation's finished verifications (the page behind the charts).
"""

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel

from app.repositories.document_repository import DocumentRepository
from app.repositories.verification_repository import VerificationRepository
from app.security import Principal, require_role
from app.services.analytics_service import build_overview

router = APIRouter(prefix="/analytics", tags=["Analytics"])

MAX_SESSIONS = 1000  # newest finished verifications considered (this window and the one before it)


class Totals(BaseModel):
    verifications: int
    claims: int
    supported: int
    contradicted: int
    unverified: int
    hallucination_rate: float
    unverified_rate: float
    support_rate: float
    average_score: float


class TrendPoint(BaseModel):
    date: str
    verifications: int
    claims: int
    supported: int
    contradicted: int
    unverified: int
    hallucination_rate: float


class DocumentRow(BaseModel):
    document_id: str
    document_name: str
    verifications: int
    claims: int
    supported: int
    contradicted: int
    unverified: int
    hallucination_rate: float
    unverified_rate: float


class ClaimTypeRow(BaseModel):
    claim_type: str
    claims: int
    supported: int
    contradicted: int
    unverified: int
    hallucination_rate: float
    unverified_rate: float


class NamedCount(BaseModel):
    name: str
    claims: int


class RiskCount(BaseModel):
    name: str
    verifications: int


class ScoreBin(BaseModel):
    lower: int
    upper: int
    verifications: int


class TopClaim(BaseModel):
    session_id: str
    claim_id: str
    claim_text: str
    verdict: str
    claim_type: str
    hallucination_type: str
    risk_score: float
    document_name: str


class AnalyticsOverview(BaseModel):
    days: int
    since: str
    totals: Totals
    previous: Totals
    trend: List[TrendPoint]
    documents: List[DocumentRow]
    claim_types: List[ClaimTypeRow]
    hallucination_types: List[NamedCount]
    rules: List[NamedCount]
    risk_levels: List[RiskCount]
    score_bins: List[ScoreBin]
    top_claims: List[TopClaim]


@router.get("/overview", response_model=AnalyticsOverview)
async def overview(
    days: int = Query(30, ge=1, le=365, description="Length of the window in days, ending now"),
    principal: Principal = Depends(require_role("viewer")),
) -> Dict[str, Any]:
    """Totals, a daily trend and breakdowns for the last ``days`` days, with the previous window's totals for comparison."""
    repo = VerificationRepository()
    sessions = await repo.list_for_tenant(principal.tenant_id, limit=MAX_SESSIONS, status="completed")
    claims = await repo.list_claims_for_sessions([s.id for s in sessions])
    names: Dict[str, Optional[str]] = {}
    documents = DocumentRepository()
    for doc_id in {s.document_id for s in sessions}:
        document = await documents.get_document_by_id(doc_id)
        names[doc_id] = document.filename if document else None
    return build_overview(sessions, claims, names, days)
