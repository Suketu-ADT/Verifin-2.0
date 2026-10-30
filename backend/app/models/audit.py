"""
Audit event: one append-only record per security- or governance-relevant action.

Events of a tenant form a hash chain (each hash covers the previous one), so editing, deleting or reordering a
stored event is detectable by recomputing the chain. The chain proves integrity against accidental or casual
tampering; it does not stop someone with full database control from rewriting every later event, so the latest
hash should also be exported to storage that the database administrator cannot write.
"""

import hashlib
import json
from typing import Any, Dict, Optional

from pydantic import BaseModel, Field

GENESIS_HASH = "0" * 64


class AuditEventModel(BaseModel):
    id: str
    seq: int  # position in the tenant's chain, starting at 1
    tenant_id: str
    timestamp: str  # ISO 8601 UTC, stored as text so the hashed bytes never change on a round trip
    actor_id: str
    actor_email: Optional[str] = None
    actor_role: Optional[str] = None
    auth_method: Optional[str] = None
    action: str  # e.g. "auth.login", "document.upload", "verification.start"
    resource_type: Optional[str] = None
    resource_id: Optional[str] = None
    outcome: str = "success"  # success | denied | failure
    request_id: Optional[str] = None
    details: Dict[str, Any] = Field(default_factory=dict)
    prev_hash: str = GENESIS_HASH
    hash: str = ""

    def compute_hash(self) -> str:
        body = self.model_dump(exclude={"hash"})
        canonical = json.dumps(body, sort_keys=True, separators=(",", ":"), ensure_ascii=False, default=str)
        return hashlib.sha256(canonical.encode("utf-8")).hexdigest()
