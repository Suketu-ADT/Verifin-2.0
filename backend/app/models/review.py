"""
Models for Human-in-the-Loop Review Queue and Immutable Audit Trail.
Tracks OCR numerical cells flagged for human verification.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class ReviewAuditRecord(BaseModel):
    """An immutable record of a reviewer's decision on an uncertain financial figure."""
    reviewer_id: str = Field(..., description="ID of the reviewing analyst")
    action: str = Field(..., description="'accept', 'correct', or 'reject'")
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    previous_value: Optional[float] = None
    new_value: Optional[float] = None
    previous_text: str
    new_text: str
    reason: str = Field(..., description="Justification for acceptance, correction, or rejection")


class ReviewItem(BaseModel):
    """An item in the reviewer queue representing an uncertain OCR cell or passage."""
    id: str = Field(..., description="Unique review item ID")
    document_id: str
    user_id: Optional[str] = None
    table_id: Optional[str] = None
    page_number: int
    cell_row_idx: int = 0
    cell_col_idx: int = 0
    line_item_name: str
    original_text: str
    original_value: Optional[float] = None
    current_text: str
    current_value: Optional[float] = None
    ocr_confidence: float = Field(..., description="OCR confidence percentage")
    reason_for_review: str = Field(..., description="Why item was flagged e.g. 'Low OCR confidence'")
    status: str = Field(default="pending", description="'pending', 'accepted', 'corrected', 'rejected'")
    bbox: Optional[Dict[str, float]] = None
    audit_trail: List[ReviewAuditRecord] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
