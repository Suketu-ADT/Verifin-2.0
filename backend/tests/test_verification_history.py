"""Verification history: newest first, tenant-scoped, with claim counts."""

from datetime import datetime, timedelta, timezone

import pytest
from httpx import ASGITransport, AsyncClient

from app.config import settings
from app.database import fallback_db, mongodb
from app.main import app
from app.models.document import DocumentModel
from app.models.verification import VerificationSessionModel
from app.repositories.document_repository import DocumentRepository
from app.repositories.verification_repository import VerificationRepository

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


@pytest.fixture
async def client():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c


async def register(client, email):
    r = await client.post(f"{V1}/auth/register", json={"email": email, "password": "correct-horse-battery"})
    body = r.json()
    return body["user"], {"Authorization": f"Bearer {body['access_token']}"}


async def add_session(tenant, sid, minutes_ago, status="completed", counts=None, text="Revenue was $5 billion."):
    await VerificationRepository().create_session(VerificationSessionModel(
        id=sid, tenant_id=tenant, document_id="d1", llm_output=text, status=status, risk_level="HIGH",
        overall_score=40.0, claim_counts=counts or {}, created_at=datetime.now(timezone.utc) - timedelta(minutes=minutes_ago)))


@pytest.mark.asyncio
async def test_history_lists_newest_first_with_counts_and_document_name(client):
    user, headers = await register(client, "a@example.com")
    await DocumentRepository().create_document(DocumentModel(id="d1", tenant_id=user["tenant_id"], filename="annual.pdf", size=1, file_path="x"))
    await add_session(user["tenant_id"], "old", 30, counts={"SUPPORTED": 2})
    await add_session(user["tenant_id"], "new", 1, counts={"SUPPORTED": 1, "CONTRADICTED": 1}, text="x" * 300)

    rows = (await client.get(f"{V1}/verification", headers=headers)).json()
    assert [r["id"] for r in rows] == ["new", "old"]
    assert rows[0]["document_name"] == "annual.pdf" and rows[0]["claim_counts"] == {"SUPPORTED": 1, "CONTRADICTED": 1}
    assert len(rows[0]["statement_preview"]) == 160 and rows[0]["statement_preview"].endswith("...")


@pytest.mark.asyncio
async def test_history_is_tenant_scoped_filterable_and_limited(client):
    a, a_headers = await register(client, "a@example.com")
    b, b_headers = await register(client, "b@example.com")
    for i in range(3):
        await add_session(a["tenant_id"], f"a{i}", i)
    await add_session(a["tenant_id"], "failed-one", 10, status="failed")
    await add_session(b["tenant_id"], "b0", 0)

    assert {r["id"] for r in (await client.get(f"{V1}/verification", headers=b_headers)).json()} == {"b0"}
    assert [r["id"] for r in (await client.get(f"{V1}/verification?status=failed", headers=a_headers)).json()] == ["failed-one"]
    assert len((await client.get(f"{V1}/verification?limit=2", headers=a_headers)).json()) == 2
    assert (await client.get(f"{V1}/verification?limit=0", headers=a_headers)).status_code == 422
    assert (await client.get(f"{V1}/verification?status=bogus", headers=a_headers)).status_code == 422
    assert (await client.get(f"{V1}/verification")).status_code == 401


@pytest.mark.asyncio
async def test_new_empty_organisation_has_an_empty_history(client):
    _, headers = await register(client, "a@example.com")
    assert (await client.get(f"{V1}/verification", headers=headers)).json() == []
