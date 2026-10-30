"""API keys for programmatic access. Only a SHA-256 hash of the key is stored."""

from datetime import datetime, timezone
from typing import Optional
from pydantic import BaseModel, Field


class ApiKeyModel(BaseModel):
    id: str
    tenant_id: str
    user_id: str = Field(..., description="User who created the key")
    name: str
    prefix: str = Field(..., description="First characters of the key, shown so keys can be told apart")
    key_hash: str
    role: str = "analyst"
    is_active: bool = True
    expires_at: Optional[datetime] = None
    last_used_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
