"""
API endpoints for Human-in-the-Loop Review Queue and Audit Trails.
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field

from app.models.review import ReviewAuditRecord, ReviewItem
from app.config import settings
from app.repositories.document_repository import DocumentRepository
from app.security import Principal, require_role
from app.security.access import authorize_document
from app.services.audit_service import audit
from app.services.review_service import ReviewService

router = APIRouter(prefix="/review", tags=["Review Queue"])


def get_review_service() -> ReviewService:
    return ReviewService()


class ReviewDecisionRequest(BaseModel):
    reviewer_id: str = Field(..., description="ID of the reviewing analyst")
    action: str = Field(..., description="'accept', 'correct', or 'reject'")
    reason: str = Field(..., description="Audit rationale for decision")
    corrected_value: Optional[float] = Field(default=None, description="New value if action is 'correct'")
    corrected_text: Optional[str] = Field(default=None, description="New text if action is 'correct'")


@router.get("/queue", response_model=List[ReviewItem])
async def get_review_queue(
    document_id: Optional[str] = Query(None, description="Filter by document ID"),
    principal: Principal = Depends(require_role("analyst")),
    service: ReviewService = Depends(get_review_service),
) -> List[ReviewItem]:
    """Retrieves pending low-confidence OCR numerical items of the caller's organisation awaiting review."""
    if not settings.auth_enabled:
        return await service.get_queue(document_id=document_id)  # single shared tenant: nothing to isolate
    if document_id:
        await authorize_document(document_id, principal)
        return await service.get_queue(document_id=document_id)
    tenant_docs = {d.id for d in await DocumentRepository().list_documents(tenant_id=principal.tenant_id, limit=1000)}
    return [item for item in await service.get_queue() if item.document_id in tenant_docs]


@router.post("/{item_id}/decide", response_model=ReviewItem)
async def submit_review_decision(
    item_id: str,
    request: ReviewDecisionRequest,
    principal: Principal = Depends(require_role("analyst")),
    service: ReviewService = Depends(get_review_service),
) -> ReviewItem:
    """
    Submits an analyst decision ('accept', 'correct', 'reject') on an uncertain figure.
    Generates an immutable audit record without overwriting original OCR data.
    """
    item = await service.review_repo.get_review_by_id(item_id)
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Review item '{item_id}' not found.")
    if settings.auth_enabled:
        await authorize_document(item.document_id, principal)
    # the audit trail records the authenticated reviewer, whatever the request body claims
    reviewer = principal.user_id if principal.auth_method != "none" else request.reviewer_id
    result = await service.submit_decision(
        item_id=item_id,
        reviewer_id=reviewer,
        action=request.action,
        reason=request.reason,
        corrected_value=request.corrected_value,
        corrected_text=request.corrected_text,
    )
    await audit.record_for(principal, "review.decide", resource_type="review_item", resource_id=item_id,
                           details={"action": request.action, "document_id": item.document_id, "reason": request.reason})
    return result


@router.get("/{item_id}/audit", response_model=List[ReviewAuditRecord])
async def get_review_audit_trail(
    item_id: str,
    principal: Principal = Depends(require_role("analyst")),
    service: ReviewService = Depends(get_review_service),
) -> List[ReviewAuditRecord]:
    """Retrieves the complete audit history for a review item."""
    item = await service.review_repo.get_review_by_id(item_id)
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Review item '{item_id}' not found.",
        )
    if settings.auth_enabled:
        await authorize_document(item.document_id, principal)
    return item.audit_trail
