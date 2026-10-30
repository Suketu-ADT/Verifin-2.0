"""Authentication, roles, API keys and tenant isolation, exercised through the real FastAPI app."""

from datetime import datetime, timedelta, timezone

import jwt
import pytest
from httpx import ASGITransport, AsyncClient

from app.config import Settings, settings
from app.database import fallback_db
from app.database import mongodb
from app.main import app
from app.models.document import DocumentModel
from app.models.verification import VerificationSessionModel
from app.repositories.document_repository import DocumentRepository
from app.repositories.verification_repository import VerificationRepository

PASSWORD = "correct-horse-battery"
V1 = "/api/v1"


@pytest.fixture(autouse=True)
def secured_app(monkeypatch):
    """Auth switched on, against an empty in-memory database that never touches the real store."""
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
    r = await client.post(f"{V1}/auth/register", json={"email": email, "password": PASSWORD, "name": "T"})
    assert r.status_code == 201, r.text
    body = r.json()
    return body["user"], {"Authorization": f"Bearer {body['access_token']}"}


async def add_document(tenant_id, doc_id="doc-1"):
    await DocumentRepository().create_document(
        DocumentModel(id=doc_id, tenant_id=tenant_id, filename="r.pdf", size=1, file_path="x")
    )


# ── Login and tokens ─────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_register_login_and_me(client):
    user, headers = await register(client, "Admin@Example.com")
    assert user["role"] == "admin" and user["email"] == "admin@example.com"

    login = await client.post(f"{V1}/auth/login", json={"email": "admin@example.com", "password": PASSWORD})
    assert login.status_code == 200
    me = await client.get(f"{V1}/auth/me", headers={"Authorization": f"Bearer {login.json()['access_token']}"})
    assert me.json()["id"] == user["id"]
    assert "password_hash" not in me.text


@pytest.mark.asyncio
async def test_wrong_password_and_unknown_email_look_identical(client):
    await register(client, "a@example.com")
    wrong = await client.post(f"{V1}/auth/login", json={"email": "a@example.com", "password": "not-the-password"})
    unknown = await client.post(f"{V1}/auth/login", json={"email": "nobody@example.com", "password": PASSWORD})
    assert wrong.status_code == unknown.status_code == 401
    assert wrong.json() == unknown.json()


@pytest.mark.asyncio
async def test_weak_password_and_duplicate_email_are_rejected(client):
    weak = await client.post(f"{V1}/auth/register", json={"email": "w@example.com", "password": "short"})
    assert weak.status_code == 422
    await register(client, "dup@example.com")
    dup = await client.post(f"{V1}/auth/register", json={"email": "DUP@example.com", "password": PASSWORD})
    assert dup.status_code == 409


@pytest.mark.asyncio
async def test_registration_can_be_closed(client, monkeypatch):
    monkeypatch.setattr(settings, "allow_registration", False)
    r = await client.post(f"{V1}/auth/register", json={"email": "x@example.com", "password": PASSWORD})
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_requests_without_credentials_are_refused(client):
    r = await client.get(f"{V1}/documents")
    assert r.status_code == 401
    assert r.headers["www-authenticate"] == "Bearer"


@pytest.mark.asyncio
async def test_forged_expired_and_unsigned_tokens_are_refused(client):
    user, _ = await register(client, "t@example.com")
    now = datetime.now(timezone.utc)
    claims = {"sub": user["id"], "tid": user["tenant_id"], "role": "admin", "iss": settings.jwt_issuer,
              "iat": now, "exp": now + timedelta(minutes=5)}

    forged = jwt.encode(claims, "some-other-secret-" + "y" * 32, algorithm="HS256")
    expired = jwt.encode({**claims, "exp": now - timedelta(minutes=1)}, settings.jwt_secret, algorithm="HS256")
    unsigned = jwt.encode(claims, None, algorithm="none")
    for token in (forged, expired, unsigned):
        r = await client.get(f"{V1}/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert r.status_code == 401


@pytest.mark.asyncio
async def test_deactivated_user_is_locked_out_immediately(client):
    admin, admin_headers = await register(client, "boss@example.com")
    created = await client.post(
        f"{V1}/auth/users", headers=admin_headers,
        json={"email": "emp@example.com", "password": PASSWORD, "role": "analyst"},
    )
    emp_id = created.json()["id"]
    login = await client.post(f"{V1}/auth/login", json={"email": "emp@example.com", "password": PASSWORD})
    emp_headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
    assert (await client.get(f"{V1}/documents", headers=emp_headers)).status_code == 200

    await client.patch(f"{V1}/auth/users/{emp_id}", headers=admin_headers, json={"is_active": False})
    assert (await client.get(f"{V1}/documents", headers=emp_headers)).status_code == 401
    relogin = await client.post(f"{V1}/auth/login", json={"email": "emp@example.com", "password": PASSWORD})
    assert relogin.status_code == 401


# ── Roles ────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_viewer_can_read_but_not_upload_or_verify(client):
    _, admin_headers = await register(client, "boss@example.com")
    await client.post(f"{V1}/auth/users", headers=admin_headers,
                      json={"email": "view@example.com", "password": PASSWORD, "role": "viewer"})
    login = await client.post(f"{V1}/auth/login", json={"email": "view@example.com", "password": PASSWORD})
    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}

    assert (await client.get(f"{V1}/documents", headers=headers)).status_code == 200
    upload = await client.post(f"{V1}/documents/upload", headers=headers, files={"file": ("a.pdf", b"%PDF-1.4", "application/pdf")})
    assert upload.status_code == 403
    verify = await client.post(f"{V1}/verification/start", headers=headers,
                               json={"document_id": "d", "llm_output": "Revenue was $5 billion."})
    assert verify.status_code == 403
    assert (await client.get(f"{V1}/auth/users", headers=headers)).status_code == 403


@pytest.mark.asyncio
async def test_only_admins_can_use_resource_spending_system_endpoints(client):
    _, admin_headers = await register(client, "boss@example.com")
    await client.post(f"{V1}/auth/users", headers=admin_headers,
                      json={"email": "an@example.com", "password": PASSWORD, "role": "analyst"})
    login = await client.post(f"{V1}/auth/login", json={"email": "an@example.com", "password": PASSWORD})
    analyst = {"Authorization": f"Bearer {login.json()['access_token']}"}
    assert (await client.get(f"{V1}/system/llm/health", headers=analyst)).status_code == 403


# ── Tenant isolation ─────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_tenants_cannot_see_each_others_documents(client):
    a, a_headers = await register(client, "a@example.com")
    b, b_headers = await register(client, "b@example.com")
    assert a["tenant_id"] != b["tenant_id"]
    await add_document(a["tenant_id"], "doc-a")

    assert (await client.get(f"{V1}/documents/doc-a", headers=a_headers)).status_code == 200
    for path in ("", "/file", "/tables", "/chunks"):
        r = await client.get(f"{V1}/documents/doc-a{path}", headers=b_headers)
        assert r.status_code == 404, path

    retrieve = await client.post(f"{V1}/evidence/retrieve", headers=b_headers,
                                 json={"query": "revenue", "document_id": "doc-a"})
    assert retrieve.status_code == 404
    no_scope = await client.post(f"{V1}/evidence/retrieve", headers=b_headers, json={"query": "revenue"})
    assert no_scope.status_code == 400  # searching all documents would cross tenants

    listed = await client.get(f"{V1}/documents", headers=b_headers)
    assert listed.json() == []


@pytest.mark.asyncio
async def test_tenants_cannot_start_or_read_each_others_verifications(client):
    a, a_headers = await register(client, "a@example.com")
    _, b_headers = await register(client, "b@example.com")
    await add_document(a["tenant_id"], "doc-a")
    await VerificationRepository().create_session(
        VerificationSessionModel(id="sess-a", tenant_id=a["tenant_id"], document_id="doc-a",
                                 llm_output="x", status="completed")
    )

    assert (await client.get(f"{V1}/verification/sess-a/results", headers=a_headers)).status_code == 200
    assert (await client.get(f"{V1}/verification/sess-a/results", headers=b_headers)).status_code == 404
    start = await client.post(f"{V1}/verification/start", headers=b_headers,
                              json={"document_id": "doc-a", "llm_output": "Revenue was $5 billion."})
    assert start.status_code == 404


@pytest.mark.asyncio
async def test_admin_cannot_manage_users_of_another_tenant(client):
    _, a_headers = await register(client, "a@example.com")
    b, b_headers = await register(client, "b@example.com")
    r = await client.patch(f"{V1}/auth/users/{b['id']}", headers=a_headers, json={"role": "viewer"})
    assert r.status_code == 404
    assert [u["email"] for u in (await client.get(f"{V1}/auth/users", headers=a_headers)).json()] == ["a@example.com"]


@pytest.mark.asyncio
async def test_admin_cannot_demote_or_deactivate_themselves(client):
    admin, headers = await register(client, "a@example.com")
    r = await client.patch(f"{V1}/auth/users/{admin['id']}", headers=headers, json={"is_active": False})
    assert r.status_code == 400


# ── API keys ─────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_api_key_lifecycle(client):
    a, headers = await register(client, "a@example.com")
    await add_document(a["tenant_id"], "doc-a")

    created = await client.post(f"{V1}/auth/api-keys", headers=headers, json={"name": "ci", "role": "viewer"})
    assert created.status_code == 201
    key = created.json()["key"]
    assert key.startswith("vfn_")

    listing = await client.get(f"{V1}/auth/api-keys", headers=headers)
    assert key not in listing.text  # the plaintext key is never returned again
    assert listing.json()[0]["prefix"] == key[:8]

    with_key = await client.get(f"{V1}/documents/doc-a", headers={"X-API-Key": key})
    assert with_key.status_code == 200
    # the viewer key cannot write
    upload = await client.post(f"{V1}/documents/upload", headers={"X-API-Key": key},
                               files={"file": ("a.pdf", b"%PDF-1.4", "application/pdf")})
    assert upload.status_code == 403

    revoked = await client.delete(f"{V1}/auth/api-keys/{created.json()['id']}", headers=headers)
    assert revoked.status_code == 204
    assert (await client.get(f"{V1}/documents/doc-a", headers={"X-API-Key": key})).status_code == 401


@pytest.mark.asyncio
async def test_api_key_cannot_exceed_its_creators_role(client):
    _, admin_headers = await register(client, "a@example.com")
    await client.post(f"{V1}/auth/users", headers=admin_headers,
                      json={"email": "an@example.com", "password": PASSWORD, "role": "analyst"})
    login = await client.post(f"{V1}/auth/login", json={"email": "an@example.com", "password": PASSWORD})
    analyst = {"Authorization": f"Bearer {login.json()['access_token']}"}
    r = await client.post(f"{V1}/auth/api-keys", headers=analyst, json={"name": "k", "role": "admin"})
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_unknown_and_expired_api_keys_are_refused(client):
    _, headers = await register(client, "a@example.com")
    assert (await client.get(f"{V1}/documents", headers={"X-API-Key": "vfn_nope"})).status_code == 401

    created = await client.post(f"{V1}/auth/api-keys", headers=headers, json={"name": "k", "expires_in_days": 1})
    key = created.json()["key"]
    from app.repositories.api_key_repository import ApiKeyRepository
    await ApiKeyRepository().collection.update_one(
        {"id": created.json()["id"]}, {"$set": {"expires_at": datetime.now(timezone.utc) - timedelta(days=1)}}
    )
    assert (await client.get(f"{V1}/documents", headers={"X-API-Key": key})).status_code == 401


# ── Configuration safety ─────────────────────────────────────────────────────


def test_production_refuses_unsafe_configuration():
    with pytest.raises(ValueError):
        Settings(environment="production", debug=True, jwt_secret="s" * 40)
    with pytest.raises(ValueError):
        Settings(environment="production", debug=False)  # default secret
    with pytest.raises(ValueError):
        Settings(environment="production", debug=False, jwt_secret="short")


def test_production_forces_auth_and_drops_localhost_origins():
    prod = Settings(environment="production", debug=False, jwt_secret="s" * 40,
                    auth_enabled=False, frontend_url="https://app.example.com")
    assert prod.auth_enabled is True
    assert prod.cors_origins == ["https://app.example.com"]


@pytest.mark.asyncio
async def test_legacy_unversioned_paths_still_work_and_are_deprecated(client):
    paths = app.openapi()["paths"]
    assert "/api/v1/documents/upload" in paths and "/api/documents/upload" in paths
    assert paths["/api/documents/upload"]["post"].get("deprecated") is True
    assert not paths["/api/v1/documents/upload"]["post"].get("deprecated")


def test_production_disables_the_in_memory_database_fallback():
    prod = Settings(environment="production", debug=False, jwt_secret="s" * 40, allow_db_fallback=True)
    assert prod.allow_db_fallback is False


@pytest.mark.asyncio
async def test_startup_fails_instead_of_falling_back_when_fallback_is_disabled(monkeypatch):
    class Unreachable:
        def __init__(self, *args, **kwargs):
            raise ConnectionError("no route to host")

    monkeypatch.setattr(mongodb, "AsyncIOMotorClient", Unreachable)
    monkeypatch.setattr(settings, "allow_db_fallback", False)
    with pytest.raises(RuntimeError, match="fallback is disabled"):
        await mongodb.connect_to_mongo()
