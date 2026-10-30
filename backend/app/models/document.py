"""
Document model representing uploaded financial documents in MongoDB.
"""

from datetime import datetime, timezone
from typing import Optional
from pydantic import BaseModel, Field


class DocumentModel(BaseModel):
    id: str = Field(..., description="Unique string document ID")
    user_id: Optional[str] = None
    tenant_id: str = "public"
    filename: str
    file_type: str = "pdf"
    size: int
    sha256: Optional[str] = None  # SHA-256 of the uploaded file, so a result names the exact bytes it checked
    page_count: int = 1
    file_path: str
    status: str = "uploaded"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
