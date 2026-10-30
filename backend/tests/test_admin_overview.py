"""Admin overview: numbers are the caller's own organisation's, and only admins see them."""

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
PASSWORD = "correct-horse-battery"


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
    r = await client.post(f"{V1}/auth/register", json={"email": email, "password": PASSWORD})
    body = r.json()
    return body["user"], {"Authorization": f"Bearer {body['access_token']}"}


async def session(tenant, sid, status, risk, score):
    await VerificationRepository().create_session(VerificationSessionModel(
        id=sid, tenant_id=tenant, document_id="d", llm_output="x", status=status, risk_level=risk, overall_score=score))


@pytest.mark.asyncio
async def test_overview_summarises_only_the_callers_organisation(client):
    a, a_headers = await register(client, "a@example.com")
    b, _ = await register(client, "b@example.com")
    await client.post(f"{V1}/auth/users", headers=a_headers, json={"email": "v@example.com", "password": PASSWORD, "role": "viewer"})
    await client.post(f"{V1}/auth/api-keys", headers=a_headers, json={"name": "k", "role": "analyst"})
    await DocumentRepository().create_document(DocumentModel(id="d1", tenant_id=a["tenant_id"], filename="a.pdf", size=1, file_path="x"))
    await DocumentRepository().create_document(DocumentModel(id="d2", tenant_id=b["tenant_id"], filename="b.pdf", size=1, file_path="x"))
    await session(a["tenant_id"], "s1", "completed", "LOW", 90.0)
    await session(a["tenant_id"], "s2", "completed", "HIGH", 50.0)
    await session(a["tenant_id"], "s3", "failed", "PENDING", 0.0)
    await session(b["tenant_id"], "s4", "completed", "LOW", 100.0)

    body = (await client.get(f"{V1}/admin/overview", headers=a_headers)).json()
    assert body["usage"]["verifications"] == 3 and body["usage"]["documents"] == 1
    assert body["usage"]["by_status"] == {"completed": 2, "failed": 1}
    assert body["usage"]["by_risk"] == {"LOW": 1, "HIGH": 1} and body["usage"]["average_score"] == 70.0
    assert body["people"]["users"] == 2 and body["people"]["by_role"] == {"admin": 1, "viewer": 1}
    assert body["people"]["api_keys_active"] == 1
    assert body["audit"]["chain_valid"] is True and body["audit"]["events"] >= 3
    assert body["instance"]["pipeline_version"].startswith("verifin-pipeline/")
    assert "jwt_secret" not in str(body).lower()


@pytest.mark.asyncio
async def test_overview_is_admin_only(client):
    _, headers = await register(client, "a@example.com")
    await client.post(f"{V1}/auth/users", headers=headers, json={"email": "an@example.com", "password": PASSWORD, "role": "analyst"})
    login = await client.post(f"{V1}/auth/login", json={"email": "an@example.com", "password": PASSWORD})
    analyst = {"Authorization": f"Bearer {login.json()['access_token']}"}
    assert (await client.get(f"{V1}/admin/overview", headers=analyst)).status_code == 403
    assert (await client.get(f"{V1}/admin/overview")).status_code == 401


@pytest.mark.asyncio
async def test_overview_flags_a_tampered_audit_chain(client):
    a, headers = await register(client, "a@example.com")
    await client.post(f"{V1}/auth/login", json={"email": "a@example.com", "password": PASSWORD})
    mongodb.get_database().audit_events._docs[0]["actor_id"] = "someone-else"
    audit = (await client.get(f"{V1}/admin/overview", headers=headers)).json()["audit"]
    assert audit["chain_valid"] is False and audit["first_broken_seq"] == 1
