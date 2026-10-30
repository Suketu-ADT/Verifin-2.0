"""Background verification jobs: queueing, lifecycle, failure handling, backpressure, recovery."""

import asyncio
from unittest.mock import AsyncMock, MagicMock

import pytest
from httpx import ASGITransport, AsyncClient

from app.config import settings
from app.database import fallback_db, mongodb
from app.main import app
from app.models.document import DocumentModel
from app.models.verification import VerificationSessionModel
from app.repositories.document_repository import DocumentRepository
from app.repositories.verification_repository import VerificationRepository
from app.schemas.verification import StartVerificationRequest, VerificationResultResponse
from app.services import job_runner as job_module
from app.services.job_runner import JobRunner, QueueFull
from app.services.nli_service import ClaimNLIResult
from app.services.verification_service import VerificationService

V1 = "/api/v1"


@pytest.fixture(autouse=True)
def clean_database(monkeypatch):
    monkeypatch.setattr(fallback_db, "_load_persisted_store", lambda: {})
    monkeypatch.setattr(fallback_db, "_save_persisted_store", lambda store: None)
    monkeypatch.setattr(mongodb.manager, "database", fallback_db.FallbackDatabase())
    monkeypatch.setattr(settings, "auth_enabled", False)
    monkeypatch.setattr(settings, "rate_limit_enabled", False)


@pytest.fixture
def runner(monkeypatch):
    """A private runner, so tests never share a semaphore or task set with the app-wide one."""
    fresh = JobRunner()
    monkeypatch.setattr(job_module, "job_runner", fresh)
    import app.api.verification as api

    monkeypatch.setattr(api, "job_runner", fresh)
    return fresh


@pytest.fixture
async def client():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c


async def add_document(doc_id="doc-1", tenant_id="public"):
    await DocumentRepository().create_document(
        DocumentModel(id=doc_id, tenant_id=tenant_id, filename="r.pdf", size=1, file_path="x")
    )


def finishing_service(delay=0.0, fail_with=None, started=None, release=None):
    """A stand-in VerificationService whose run takes ``delay`` seconds or fails."""

    async def run(request, user_id=None, tenant_id="public", session_id=None):
        if started is not None:
            started.append(session_id)
        if release is not None:
            await release.wait()
        await asyncio.sleep(delay)
        if fail_with:
            raise fail_with
        repo = VerificationRepository()
        await repo.update_session(
            VerificationSessionModel(
                id=session_id, tenant_id=tenant_id, document_id=request.document_id,
                llm_output=request.llm_output, status="completed", overall_score=100.0, risk_level="LOW",
            )
        )
        return VerificationResultResponse(
            id=session_id, document_id=request.document_id, overall_score=100.0,
            risk_level="LOW", status="completed", claims=[],
        )

    service = MagicMock()
    service.start_verification_session = run
    return lambda: service


async def wait_for(session_id, status, timeout=3.0):
    repo = VerificationRepository()
    for _ in range(int(timeout / 0.02)):
        session = await repo.get_session_by_id(session_id)
        if session and session.status == status:
            return session
        await asyncio.sleep(0.02)
    raise AssertionError(f"{session_id} never reached '{status}' (last: {session and session.status})")


async def queue(session_id="s-1"):
    await VerificationRepository().create_session(
        VerificationSessionModel(id=session_id, document_id="doc-1", llm_output="x", status="queued")
    )
    return StartVerificationRequest(document_id="doc-1", llm_output="Revenue was $5 billion.")


# ── Runner ───────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_job_moves_from_queued_to_completed():
    runner = JobRunner(finishing_service())
    request = await queue()
    runner.submit("s-1", request, None, "public")
    await wait_for("s-1", "completed")
    await runner.shutdown()


@pytest.mark.asyncio
async def test_failed_job_records_the_reason_and_does_not_crash_the_runner():
    runner = JobRunner(finishing_service(fail_with=RuntimeError("model exploded")))
    request = await queue()
    runner.submit("s-1", request, None, "public")
    failed = await wait_for("s-1", "failed")
    assert "model exploded" in failed.error
    # the runner keeps working afterwards
    runner._service_factory = finishing_service()
    await VerificationRepository().create_session(
        VerificationSessionModel(id="s-2", document_id="doc-1", llm_output="x", status="queued")
    )
    runner.submit("s-2", request, None, "public")
    await wait_for("s-2", "completed")


@pytest.mark.asyncio
async def test_concurrency_is_bounded(monkeypatch):
    monkeypatch.setattr(settings, "max_concurrent_jobs", 1)
    started, release = [], asyncio.Event()
    runner = JobRunner(finishing_service(started=started, release=release))
    request = await queue("s-1")
    await queue("s-2")
    runner.submit("s-1", request, None, "public")
    runner.submit("s-2", request, None, "public")
    await asyncio.sleep(0.1)
    assert started == ["s-1"]  # the second waits for the single slot
    assert (runner.running, runner.waiting) == (1, 1)
    release.set()
    await wait_for("s-2", "completed")
    assert started == ["s-1", "s-2"]


@pytest.mark.asyncio
async def test_full_queue_is_refused(monkeypatch):
    monkeypatch.setattr(settings, "max_concurrent_jobs", 1)
    monkeypatch.setattr(settings, "job_queue_limit", 1)
    release = asyncio.Event()
    runner = JobRunner(finishing_service(release=release))
    request = await queue()
    runner.submit("s-1", request, None, "public")
    with pytest.raises(QueueFull):
        runner.submit("s-2", request, None, "public")
    release.set()
    await runner.shutdown()


@pytest.mark.asyncio
async def test_shutdown_cancels_stuck_jobs_and_marks_them_failed():
    runner = JobRunner(finishing_service(release=asyncio.Event()))  # never released
    request = await queue()
    runner.submit("s-1", request, None, "public")
    await asyncio.sleep(0.05)
    await runner.shutdown(grace_seconds=0.05)
    session = await wait_for("s-1", "failed")
    assert "shutting down" in session.error


@pytest.mark.asyncio
async def test_unfinished_sessions_are_failed_at_startup():
    repo = VerificationRepository()
    for sid, state in (("q", "queued"), ("r", "running"), ("c", "completed")):
        await repo.create_session(
            VerificationSessionModel(id=sid, document_id="d", llm_output="x", status=state)
        )
    assert await JobRunner().recover_orphans() == 2
    assert [(await repo.get_session_by_id(s)).status for s in ("q", "r", "c")] == ["failed", "failed", "completed"]


# ── API ──────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_job_endpoint_returns_202_and_a_pollable_status(client, runner):
    await add_document()
    runner._service_factory = finishing_service()
    r = await client.post(f"{V1}/verification/jobs", json={"document_id": "doc-1", "llm_output": "Revenue was $5 billion."})
    assert r.status_code == 202
    body = r.json()
    assert body["status"] == "queued" and r.headers["location"].endswith(f"/{body['id']}/status")

    await wait_for(body["id"], "completed")
    status = (await client.get(body["status_url"].replace("http://test", ""))).json()
    assert status["status"] == "completed" and status["error"] is None


@pytest.mark.asyncio
async def test_job_for_unknown_document_is_404_and_queues_nothing(client, runner):
    r = await client.post(f"{V1}/verification/jobs", json={"document_id": "missing", "llm_output": "x y z"})
    assert r.status_code == 404
    assert runner.waiting == 0


@pytest.mark.asyncio
async def test_queue_overflow_returns_503_with_retry_after(client, runner, monkeypatch):
    monkeypatch.setattr(settings, "max_concurrent_jobs", 1)
    monkeypatch.setattr(settings, "job_queue_limit", 1)
    release = asyncio.Event()
    runner._service_factory = finishing_service(release=release)
    await add_document()
    payload = {"document_id": "doc-1", "llm_output": "Revenue was $5 billion."}
    assert (await client.post(f"{V1}/verification/jobs", json=payload)).status_code == 202  # takes the slot
    assert (await client.post(f"{V1}/verification/jobs", json=payload)).status_code == 202  # waits in the queue
    overflow = await client.post(f"{V1}/verification/jobs", json=payload)
    assert overflow.status_code == 503 and overflow.headers["retry-after"] == "30"
    release.set()
    await runner.shutdown()


@pytest.mark.asyncio
async def test_status_of_another_tenants_job_is_404(client, monkeypatch):
    await VerificationRepository().create_session(
        VerificationSessionModel(id="theirs", tenant_id="other", document_id="d", llm_output="x", status="running")
    )
    monkeypatch.setattr(settings, "auth_enabled", True)
    monkeypatch.setattr(settings, "allow_registration", True)
    monkeypatch.setattr(settings, "jwt_secret", "test-secret-" + "x" * 32)
    reg = await client.post(f"{V1}/auth/register", json={"email": "t@example.com", "password": "correct-horse-battery", "name": "T"})
    headers = {"Authorization": f"Bearer {reg.json()['access_token']}"}
    assert (await client.get(f"{V1}/verification/theirs/status", headers=headers)).status_code == 404


@pytest.mark.asyncio
async def test_completed_session_keeps_the_time_it_was_queued():
    from datetime import datetime, timedelta, timezone

    queued_at = datetime.now(timezone.utc) - timedelta(minutes=5)
    await VerificationRepository().create_session(
        VerificationSessionModel(id="s-old", document_id="doc-1", llm_output="x", status="queued", created_at=queued_at)
    )
    await DocumentRepository().create_document(DocumentModel(id="doc-1", filename="r.pdf", size=1, file_path="x"))
    service = VerificationService()
    service.claim_extractor = MagicMock(extract_claims=MagicMock(return_value=[]))
    service.retrieval_service = MagicMock(retrieve_evidence=AsyncMock(return_value=[]))
    service.nli_service = MagicMock(evaluate_claim_against_evidence=MagicMock(return_value=ClaimNLIResult(
        claim_text="Revenue was $5 billion.", claim_type="numerical", verdict="UNVERIFIED", confidence=0.0,
        risk_level="MEDIUM", risk_score=0.5, explanation="no evidence")))
    await service.start_verification_session(
        StartVerificationRequest(document_id="doc-1", llm_output="Revenue was $5 billion."), session_id="s-old"
    )
    stored = await VerificationRepository().get_session_by_id("s-old")
    assert stored.status == "completed" and stored.created_at == queued_at
