"""
API endpoints for Human-in-the-Loop Review Queue and Audit Trails.
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field

from app.models.review import ReviewAuditRecord, ReviewItem
from app.services.review_service import ReviewService

router = APIRouter(prefix="/api/review", tags=["Review Queue"])


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
    user_id: Optional[str] = Query(None, description="Filter by user ID"),
    service: ReviewService = Depends(get_review_service),
) -> List[ReviewItem]:
    """Retrieves all pending low-confidence OCR numerical items awaiting review."""
    return await service.get_queue(document_id=document_id, user_id=user_id)


@router.post("/{item_id}/decide", response_model=ReviewItem)
async def submit_review_decision(
    item_id: str,
    request: ReviewDecisionRequest,
    user_id: Optional[str] = Query(None, description="Scoped user ID"),
    service: ReviewService = Depends(get_review_service),
) -> ReviewItem:
    """
    Submits an analyst decision ('accept', 'correct', 'reject') on an uncertain figure.
    Generates an immutable audit record without overwriting original OCR data.
    """
    return await service.submit_decision(
        item_id=item_id,
        reviewer_id=request.reviewer_id,
        action=request.action,
        reason=request.reason,
        corrected_value=request.corrected_value,
        corrected_text=request.corrected_text,
        user_id=user_id,
    )


@router.get("/{item_id}/audit", response_model=List[ReviewAuditRecord])
async def get_review_audit_trail(
    item_id: str,
    service: ReviewService = Depends(get_review_service),
) -> List[ReviewAuditRecord]:
    """Retrieves the complete audit history for a review item."""
    item = await service.review_repo.get_review_by_id(item_id)
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Review item '{item_id}' not found.",
        )
    return item.audit_trail
