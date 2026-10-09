"""
User model representing system users stored in MongoDB.
"""

from datetime import datetime, timezone
from typing import Optional
from pydantic import BaseModel, Field


class UserModel(BaseModel):
    id: str = Field(..., description="Unique string identifier for the user")
    email: str
    name: Optional[str] = None
    google_id: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
