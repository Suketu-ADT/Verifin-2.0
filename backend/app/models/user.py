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
    tenant_id: str = Field(default="public", description="Organisation the user belongs to; data never crosses tenants")
    role: str = Field(default="analyst", description="viewer, analyst or admin")
    password_hash: Optional[str] = None
    is_active: bool = True
    last_login_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
