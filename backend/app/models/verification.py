"""
Verification session model representing verification jobs in MongoDB.
"""

from datetime import datetime, timezone
from typing import Optional
from pydantic import BaseModel, Field


class VerificationSessionModel(BaseModel):
    id: str = Field(..., description="Unique string verification session ID")
    user_id: Optional[str] = None
    document_id: str
    llm_output: str
    status: str = "queued"
    overall_score: float = 0.0
    risk_level: str = "PENDING"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
