"""
Review Service handling human-in-the-loop review queue and audit trails.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from fastapi import HTTPException, status

from app.models.review import ReviewAuditRecord, ReviewItem
from app.models.table import FinancialTableModel
from app.repositories.review_repository import ReviewRepository
from app.repositories.table_repository import TableRepository
from app.utils.logging import logger


class ReviewService:
    """Manages reviewer queue and decision auditing for uncertain financial figures."""

    def __init__(
        self,
        review_repository: Optional[ReviewRepository] = None,
        table_repository: Optional[TableRepository] = None,
    ):
        self.review_repo = review_repository or ReviewRepository()
        self.table_repo = table_repository or TableRepository()

    async def enqueue_uncertain_table_cells(
        self,
        table: FinancialTableModel,
        user_id: Optional[str] = None,
    ) -> int:
        """Scans extracted table for needs_review cells and adds them to the queue."""
        enqueued_count = 0
        for row in table.rows:
            if not row:
                continue
            line_item_name = row[0].raw_text.strip()
            for cell in row[1:]:
                if cell.is_numeric and cell.needs_review:
                    item_id = str(uuid.uuid4())
                    bbox_dict = None
                    if cell.bbox:
                        bbox_dict = {
                            "x0": cell.bbox.x0,
                            "top": cell.bbox.top,
                            "x1": cell.bbox.x1,
                            "bottom": cell.bbox.bottom,
                        }

                    review_item = ReviewItem(
                        id=item_id,
                        document_id=table.document_id,
                        user_id=user_id,
                        table_id=table.id,
                        page_number=table.page_number,
                        cell_row_idx=cell.row_idx,
                        cell_col_idx=cell.col_idx,
                        line_item_name=line_item_name,
                        original_text=cell.raw_text,
                        original_value=cell.normalized_value,
                        current_text=cell.raw_text,
                        current_value=cell.normalized_value,
                        ocr_confidence=cell.ocr_confidence or 0.0,
                        reason_for_review="Low OCR confidence in scanned numerical cell",
                        status="pending",
                        bbox=bbox_dict,
                    )
                    await self.review_repo.create_review_item(review_item)
                    enqueued_count += 1

        if enqueued_count > 0:
            logger.info(f"Enqueued {enqueued_count} uncertain cells for document {table.document_id}.")
        return enqueued_count

    async def get_queue(
        self,
        document_id: Optional[str] = None,
        user_id: Optional[str] = None,
    ) -> List[ReviewItem]:
        """Retrieves pending review items."""
        return await self.review_repo.get_pending_reviews(
            document_id=document_id, user_id=user_id
        )

    async def submit_decision(
        self,
        item_id: str,
        reviewer_id: str,
        action: str,
        reason: str,
        corrected_value: Optional[float] = None,
        corrected_text: Optional[str] = None,
        user_id: Optional[str] = None,
    ) -> ReviewItem:
        """
        Applies a reviewer's decision ('accept', 'correct', or 'reject').
        Appends an immutable audit record and preserves original OCR figures.
        """
        item = await self.review_repo.get_review_by_id(item_id)
        if not item:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Review item '{item_id}' not found.",
            )

        # Scoped access check: prevent cross-user document access if user_id specified
        if user_id and item.user_id and item.user_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Unauthorized access to review item belonging to another user.",
            )

        action_clean = action.lower().strip()
        if action_clean not in ("accept", "correct", "reject"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid action '{action}'. Must be 'accept', 'correct', or 'reject'.",
            )

        prev_val = item.current_value
        prev_txt = item.current_text

        if action_clean == "accept":
            item.status = "accepted"
            new_val = item.original_value
            new_txt = item.original_text
        elif action_clean == "correct":
            if corrected_value is None and not corrected_text:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Correction requires either corrected_value or corrected_text.",
                )
            item.status = "corrected"
            new_val = corrected_value if corrected_value is not None else item.original_value
            new_txt = corrected_text or item.original_text
            item.current_value = new_val
            item.current_text = new_txt
        else:  # reject
            item.status = "rejected"
            new_val = None
            new_txt = "[REJECTED BY REVIEWER]"
            item.current_value = None
            item.current_text = new_txt

        audit_record = ReviewAuditRecord(
            reviewer_id=reviewer_id,
            action=action_clean,
            timestamp=datetime.now(timezone.utc),
            previous_value=prev_val,
            new_value=new_val,
            previous_text=prev_txt,
            new_text=new_txt,
            reason=reason,
        )

        item.audit_trail.append(audit_record)
        item.updated_at = datetime.now(timezone.utc)
        await self.review_repo.update_review(item)

        logger.info(
            f"Review decision applied: Item={item.id}, Action={action_clean}, Reviewer={reviewer_id}"
        )
        return item
