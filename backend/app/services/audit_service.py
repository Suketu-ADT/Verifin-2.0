"""
Audit trail: appends hash-chained events and verifies the chain.

Recording is best effort for the request that triggers it (a database fault is logged and counted, never raised),
because losing an audit line must not turn a successful action into an error; the failure counter is the alert.
"""

from __future__ import annotations

import asyncio
import uuid
from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from app.models.audit import GENESIS_HASH, AuditEventModel
from app.observability import metrics
from app.observability.context import request_id_var
from app.repositories.audit_repository import AuditRepository
from app.utils.logging import logger

# Fields that must never be written into an audit record, whatever a caller passes.
_FORBIDDEN_DETAIL_KEYS = {"password", "password_hash", "token", "access_token", "key", "api_key", "secret", "authorization"}


@dataclass
class ChainReport:
    valid: bool
    events: int
    first_broken_seq: Optional[int] = None
    reason: Optional[str] = None
    head_hash: str = GENESIS_HASH


def _clean(details: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    return {k: v for k, v in (details or {}).items() if k.lower() not in _FORBIDDEN_DETAIL_KEYS}


class AuditService:
    def __init__(self, repo: Optional[AuditRepository] = None):
        self._repo = repo
        # one writer per tenant chain inside this process; several instances would need a database-side sequence
        self._locks: Dict[str, asyncio.Lock] = defaultdict(asyncio.Lock)

    @property
    def repo(self) -> AuditRepository:
        return self._repo or AuditRepository()

    async def record(
        self,
        action: str,
        *,
        tenant_id: str,
        actor_id: str = "anonymous",
        actor_email: Optional[str] = None,
        actor_role: Optional[str] = None,
        auth_method: Optional[str] = None,
        resource_type: Optional[str] = None,
        resource_id: Optional[str] = None,
        outcome: str = "success",
        details: Optional[Dict[str, Any]] = None,
    ) -> Optional[AuditEventModel]:
        try:
            async with self._locks[tenant_id]:
                last = await self.repo.last_event(tenant_id)
                event = AuditEventModel(
                    id=uuid.uuid4().hex,
                    seq=(last.seq + 1) if last else 1,
                    tenant_id=tenant_id,
                    timestamp=datetime.now(timezone.utc).isoformat(timespec="microseconds"),
                    actor_id=actor_id,
                    actor_email=actor_email,
                    actor_role=actor_role,
                    auth_method=auth_method,
                    action=action,
                    resource_type=resource_type,
                    resource_id=resource_id,
                    outcome=outcome,
                    request_id=request_id_var.get() if request_id_var.get() != "-" else None,
                    details=_clean(details),
                    prev_hash=last.hash if last else GENESIS_HASH,
                )
                event.hash = event.compute_hash()
                await self.repo.append(event)
            metrics.AUDIT_EVENTS.labels(action.split(".")[0], outcome).inc()
            return event
        except Exception as exc:  # see module docstring
            metrics.AUDIT_FAILURES.inc()
            logger.error(f"Audit write failed for '{action}': {exc}")
            return None

    async def record_for(self, principal: Any, action: str, **kwargs: Any) -> Optional[AuditEventModel]:
        """Convenience: take the actor from an authenticated ``Principal``."""
        return await self.record(
            action,
            tenant_id=principal.tenant_id,
            actor_id=principal.user_id,
            actor_email=principal.email,
            actor_role=principal.role,
            auth_method=principal.auth_method,
            **kwargs,
        )

    async def verify_chain(self, tenant_id: str) -> ChainReport:
        events: List[AuditEventModel] = await self.repo.all_in_order(tenant_id)
        previous_hash, expected_seq = GENESIS_HASH, 1
        for event in events:
            if event.seq != expected_seq:
                return ChainReport(False, len(events), event.seq, f"sequence gap: expected {expected_seq}, found {event.seq}")
            if event.prev_hash != previous_hash:
                return ChainReport(False, len(events), event.seq, "previous-hash link does not match")
            if event.compute_hash() != event.hash:
                return ChainReport(False, len(events), event.seq, "event content does not match its hash")
            previous_hash, expected_seq = event.hash, expected_seq + 1
        return ChainReport(True, len(events), head_hash=previous_hash)


audit = AuditService()
