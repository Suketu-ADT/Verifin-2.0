"""Batch verification with API keys: all-or-nothing validation, limits, progress, tenant isolation."""

import asyncio

import pytest
from httpx import ASGITransport, AsyncClient

from app.config import settings
from app.database import fallback_db, mongodb
from app.main import app
from app.models.document import DocumentModel
from app.models.verification import VerificationSessionModel
from app.repositories.document_repository import DocumentRepository
from app.repositories.verification_repository import VerificationRepository
from app.services import job_runner as job_module
from app.services.job_runner import JobRunner

V1 = "/api/v1"


@pytest.fixture(autouse=True)
def secured_app(monkeypatch):
    monkeypatch.setattr(fallback_db, "_load_persisted_store", lambda: {})
    monkeypatch.setattr(fallback_db, "_save_persisted_store", lambda store: None)
    monkeypatch.setattr(mongodb.manager, "database", fallback_db.FallbackDatabase())
    monkeypatch.setattr(settings, "auth_enabled", True)
    monkeypatch.setattr(settings, "allow_registration", True)
    monkeypatch.setattr(settings, "jwt_secret", "test-secret-" + "x" * 32)
    monkeypatch.setattr(settings, "rate_limit_enabled", False)


def finishing_service(release=None, fail=False):
    async def run(request, user_id=None, tenant_id="public", session_id=None):
        if release is not None:
            await release.wait()
        if fail:
            raise RuntimeError("boom")
        await VerificationRepository().update_session(VerificationSessionModel(
            id=session_id, tenant_id=tenant_id, document_id=request.document_id, llm_output=request.llm_output,
            status="completed", overall_score=80.0, risk_level="LOW"))

    from unittest.mock import MagicMock

    service = MagicMock()
    service.start_verification_session = run
    return lambda: service


@pytest.fixture
def runner(monkeypatch):
    fresh = JobRunner(finishing_service())
    import app.api.verification as api

    monkeypatch.setattr(job_module, "job_runner", fresh)
    monkeypatch.setattr(api, "job_runner", fresh)
    return fresh


@pytest.fixture
async def client():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c


async def register(client, email):
    r = await client.post(f"{V1}/auth/register", json={"email": email, "password": "correct-horse-battery"})
    body = r.json()
    return body["user"], {"Authorization": f"Bearer {body['access_token']}"}


async def add_document(tenant, doc_id):
    await DocumentRepository().create_document(DocumentModel(id=doc_id, tenant_id=tenant, filename=f"{doc_id}.pdf", size=1, file_path="x"))


async def wait_for_batch(client, url, headers, status, timeout=3.0):
    for _ in range(int(timeout / 0.02)):
        body = (await client.get(url, headers=headers)).json()
        if body["status"] == status:
            return body
        await asyncio.sleep(0.02)
    raise AssertionError(f"batch never reached {status}: {body}")


def items(*docs):
    return {"items": [{"document_id": d, "llm_output": f"Revenue was ${i} billion.", "reference": f"row-{i}"}
                      for i, d in enumerate(docs)]}


@pytest.mark.asyncio
async def test_api_key_can_run_a_batch_end_to_end(client, runner):
    user, jwt_headers = await register(client, "a@example.com")
    await add_document(user["tenant_id"], "d1")
    await add_document(user["tenant_id"], "d2")
    key = (await client.post(f"{V1}/auth/api-keys", headers=jwt_headers, json={"name": "ci", "role": "analyst"})).json()["key"]
    key_headers = {"X-API-Key": key}

    r = await client.post(f"{V1}/verification/batches", headers=key_headers, json=items("d1", "d2", "d1"))
    assert r.status_code == 202
    body = r.json()
    assert body["total"] == 3 and [i["reference"] for i in body["items"]] == ["row-0", "row-1", "row-2"]
    assert r.headers["location"].endswith(f"/batches/{body['id']}")

    done = await wait_for_batch(client, body["status_url"].replace("http://test", ""), key_headers, "completed")
    assert done["counts"]["completed"] == 3
    assert all(i["overall_score"] == 80.0 and i["risk_level"] == "LOW" for i in done["items"])
    events = (await client.get(f"{V1}/audit/events?action=verification.batch", headers=jwt_headers)).json()
    assert events and events[0]["actor_id"] == user["id"] and events[0]["auth_method"] == "api_key"


@pytest.mark.asyncio
async def test_one_bad_item_rejects_the_whole_batch_and_queues_nothing(client, runner):
    user, headers = await register(client, "a@example.com")
    await add_document(user["tenant_id"], "d1")
    r = await client.post(f"{V1}/verification/batches", headers=headers, json=items("d1", "missing"))
    assert r.status_code == 404
    empty = {"items": [{"document_id": "d1", "llm_output": "   "}]}
    assert (await client.post(f"{V1}/verification/batches", headers=headers, json=empty)).status_code == 422
    assert runner.waiting == 0 and runner.running == 0
    assert await VerificationRepository().sessions_collection.count_documents({}) == 0


@pytest.mark.asyncio
async def test_batch_size_and_queue_capacity_are_limited(client, runner, monkeypatch):
    user, headers = await register(client, "a@example.com")
    await add_document(user["tenant_id"], "d1")
    monkeypatch.setattr(settings, "batch_max_items", 2)
    assert (await client.post(f"{V1}/verification/batches", headers=headers, json=items("d1", "d1", "d1"))).status_code == 413
    monkeypatch.setattr(settings, "batch_max_items", 25)
    monkeypatch.setattr(settings, "job_queue_limit", 2)
    full = await client.post(f"{V1}/verification/batches", headers=headers, json=items("d1", "d1", "d1"))
    assert full.status_code == 503 and full.headers["retry-after"] == "30"


@pytest.mark.asyncio
async def test_failed_items_are_reported_per_item(client, runner):
    user, headers = await register(client, "a@example.com")
    await add_document(user["tenant_id"], "d1")
    runner._service_factory = finishing_service(fail=True)
    body = (await client.post(f"{V1}/verification/batches", headers=headers, json=items("d1", "d1"))).json()
    done = await wait_for_batch(client, f"{V1}/verification/batches/{body['id']}", headers, "completed_with_failures")
    assert done["counts"]["failed"] == 2 and "boom" in done["items"][0]["error"]


@pytest.mark.asyncio
async def test_batches_are_tenant_scoped_and_need_analyst_role(client, runner):
    a, a_headers = await register(client, "a@example.com")
    _, b_headers = await register(client, "b@example.com")
    await add_document(a["tenant_id"], "d1")
    body = (await client.post(f"{V1}/verification/batches", headers=a_headers, json=items("d1"))).json()

    assert (await client.get(f"{V1}/verification/batches/{body['id']}", headers=b_headers)).status_code == 404
    assert (await client.post(f"{V1}/verification/batches", headers=b_headers, json=items("d1"))).status_code == 404

    await client.post(f"{V1}/auth/users", headers=a_headers,
                      json={"email": "v@example.com", "password": "correct-horse-battery", "role": "viewer"})
    login = await client.post(f"{V1}/auth/login", json={"email": "v@example.com", "password": "correct-horse-battery"})
    viewer = {"Authorization": f"Bearer {login.json()['access_token']}"}
    assert (await client.post(f"{V1}/verification/batches", headers=viewer, json=items("d1"))).status_code == 403
    assert (await client.get(f"{V1}/verification/batches/{body['id']}", headers=viewer)).status_code == 200
