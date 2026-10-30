"""Administration overview for an organisation's admins: usage, people, keys, audit integrity, instance state."""

from collections import Counter
from datetime import datetime, timedelta, timezone
from typing import Dict, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.config import settings
from app.repositories.api_key_repository import ApiKeyRepository
from app.repositories.document_repository import DocumentRepository
from app.repositories.user_repository import UserRepository
from app.repositories.verification_repository import VerificationRepository
from app.security import Principal, require_role
from app.services.audit_service import audit
from app.services.job_runner import job_runner
from app.services.provenance import APP_VERSION, PIPELINE_VERSION

router = APIRouter(prefix="/admin", tags=["Admin"])

WINDOW_DAYS = 30


class UsageSummary(BaseModel):
    window_days: int
    verifications: int
    by_status: Dict[str, int]
    by_risk: Dict[str, int]
    average_score: Optional[float] = None
    documents: int


class PeopleSummary(BaseModel):
    users: int
    active_users: int
    by_role: Dict[str, int]
    api_keys_active: int
    api_keys_total: int
    last_login_at: Optional[datetime] = None


class AuditSummary(BaseModel):
    events: int
    chain_valid: bool
    head_hash: str
    first_broken_seq: Optional[int] = None


class InstanceSummary(BaseModel):
    """About this server process (shared by every organisation on it), so it shows load, not anyone's data."""

    app_version: str
    pipeline_version: str
    environment: str
    auth_enabled: bool
    jobs_running: int
    jobs_waiting: int
    max_concurrent_jobs: int
    job_queue_limit: int
    models: Dict[str, Optional[str]]


class AdminOverview(BaseModel):
    usage: UsageSummary
    people: PeopleSummary
    audit: AuditSummary
    instance: InstanceSummary


@router.get("/overview", response_model=AdminOverview)
async def admin_overview(principal: Principal = Depends(require_role("admin"))) -> AdminOverview:
    tenant = principal.tenant_id
    since = datetime.now(timezone.utc) - timedelta(days=WINDOW_DAYS)

    sessions = [
        s for s in await VerificationRepository().list_for_tenant(tenant, limit=2000)
        if _aware(s.created_at) >= since
    ]
    finished = [s for s in sessions if s.status == "completed"]
    documents = await DocumentRepository().list_documents(tenant_id=tenant, limit=5000)

    users = await UserRepository().list_users_by_tenant(tenant)
    keys = await ApiKeyRepository().list_for_tenant(tenant)
    logins = [_aware(u.last_login_at) for u in users if u.last_login_at]

    chain = await audit.verify_chain(tenant)

    return AdminOverview(
        usage=UsageSummary(
            window_days=WINDOW_DAYS,
            verifications=len(sessions),
            by_status=dict(Counter(s.status for s in sessions)),
            by_risk=dict(Counter(s.risk_level for s in finished)),
            average_score=round(sum(s.overall_score for s in finished) / len(finished), 1) if finished else None,
            documents=len(documents),
        ),
        people=PeopleSummary(
            users=len(users),
            active_users=sum(1 for u in users if u.is_active),
            by_role=dict(Counter(u.role for u in users)),
            api_keys_active=sum(1 for k in keys if k.is_active),
            api_keys_total=len(keys),
            last_login_at=max(logins) if logins else None,
        ),
        audit=AuditSummary(
            events=chain.events, chain_valid=chain.valid, head_hash=chain.head_hash,
            first_broken_seq=chain.first_broken_seq,
        ),
        instance=InstanceSummary(
            app_version=APP_VERSION,
            pipeline_version=PIPELINE_VERSION,
            environment=settings.environment,
            auth_enabled=settings.auth_enabled,
            jobs_running=job_runner.running,
            jobs_waiting=job_runner.waiting,
            max_concurrent_jobs=settings.max_concurrent_jobs,
            job_queue_limit=settings.job_queue_limit,
            models={
                "embedding": settings.embedding_model_name,
                "nli": settings.nli_model_name,
                "reranker": settings.reranker_model if settings.reranker_enabled else None,
            },
        ),
    )


def _aware(moment: datetime) -> datetime:
    return moment if moment.tzinfo else moment.replace(tzinfo=timezone.utc)
