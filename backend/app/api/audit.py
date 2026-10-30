"""Audit trail: read it, and check that it has not been altered. Administrators only, scoped to their tenant."""

from typing import List, Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel

from app.models.audit import AuditEventModel
from app.security import Principal, require_role
from app.services.audit_service import audit

router = APIRouter(prefix="/audit", tags=["Audit"])


class ChainStatus(BaseModel):
    valid: bool
    events: int
    head_hash: str
    first_broken_seq: Optional[int] = None
    reason: Optional[str] = None


@router.get("/events", response_model=List[AuditEventModel])
async def list_audit_events(
    action: Optional[str] = Query(None, description="Exact action, e.g. 'document.upload'"),
    actor_id: Optional[str] = None,
    resource_id: Optional[str] = None,
    limit: int = Query(100, ge=1, le=500),
    before_seq: Optional[int] = Query(None, description="Return events older than this sequence number"),
    principal: Principal = Depends(require_role("admin")),
) -> List[AuditEventModel]:
    return await audit.repo.list_events(
        principal.tenant_id, action=action, actor_id=actor_id, resource_id=resource_id,
        limit=limit, before_seq=before_seq,
    )


@router.get("/verify", response_model=ChainStatus)
async def verify_audit_chain(principal: Principal = Depends(require_role("admin"))) -> ChainStatus:
    """Recomputes the hash chain. ``head_hash`` is the value to keep in external storage."""
    report = await audit.verify_chain(principal.tenant_id)
    return ChainStatus(valid=report.valid, events=report.events, head_hash=report.head_hash,
                       first_broken_seq=report.first_broken_seq, reason=report.reason)
