"""
Document model representing uploaded financial documents in MongoDB.
"""

from datetime import datetime, timezone
from typing import Optional
from pydantic import BaseModel, Field


class DocumentModel(BaseModel):
    id: str = Field(..., description="Unique string document ID")
    user_id: Optional[str] = None
    filename: str
    file_type: str = "pdf"
    size: int
    page_count: int = 1
    file_path: str
    status: str = "uploaded"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
