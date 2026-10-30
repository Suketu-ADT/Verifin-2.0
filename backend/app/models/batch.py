"""A batch: several statements submitted together, each verified as its own background job."""

from datetime import datetime, timezone
from typing import List, Optional

from pydantic import BaseModel, Field


class BatchItemModel(BaseModel):
    index: int
    document_id: str
    session_id: str
    reference: Optional[str] = None  # the caller's own identifier for the item, echoed back


class BatchModel(BaseModel):
    id: str
    tenant_id: str
    user_id: Optional[str] = None
    items: List[BatchItemModel] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
