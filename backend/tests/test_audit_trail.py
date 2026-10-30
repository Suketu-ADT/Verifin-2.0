"""Audit trail: recording, hash-chain tamper detection, tenant scoping, and the events routes write."""

import asyncio

import pytest
from httpx import ASGITransport, AsyncClient

from app.config import settings
from app.database import fallback_db, mongodb
from app.main import app
from app.models.audit import GENESIS_HASH
from app.services.audit_service import AuditService

PASSWORD = "correct-horse-battery"
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
    r = await client.post(f"{V1}/auth/register", json={"email": email, "password": PASSWORD, "name": "T"})
    body = r.json()
    return body["user"], {"Authorization": f"Bearer {body['access_token']}"}


async def seed(service, tenant, n):
    for i in range(n):
        await service.record(f"test.action{i}", tenant_id=tenant, actor_id="u1", details={"i": i})


# ── Chain ────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_events_are_chained_and_verify():
    service = AuditService()
    await seed(service, "t1", 5)
    events = await service.repo.all_in_order("t1")
    assert [e.seq for e in events] == [1, 2, 3, 4, 5]
    assert events[0].prev_hash == GENESIS_HASH
    assert all(events[i].prev_hash == events[i - 1].hash for i in range(1, 5))
    report = await service.verify_chain("t1")
    assert report.valid and report.events == 5 and report.head_hash == events[-1].hash


@pytest.mark.asyncio
async def test_concurrent_writes_keep_the_chain_intact():
    service = AuditService()
    await asyncio.gather(*(service.record("test.burst", tenant_id="t1", actor_id="u") for _ in range(25)))
    report = await service.verify_chain("t1")
    assert report.valid and report.events == 25


@pytest.mark.asyncio
async def test_editing_an_event_is_detected():
    service = AuditService()
    await seed(service, "t1", 4)
    stored = mongodb.get_database().audit_events._docs
    stored[1]["outcome"] = "success"
    stored[1]["details"] = {"i": 999}  # rewrite history
    report = await service.verify_chain("t1")
    assert not report.valid and report.first_broken_seq == 2 and "hash" in report.reason


@pytest.mark.asyncio
async def test_deleting_an_event_is_detected():
    service = AuditService()
    await seed(service, "t1", 4)
    docs = mongodb.get_database().audit_events._docs
    docs.pop(1)
    report = await service.verify_chain("t1")
    assert not report.valid and report.first_broken_seq == 3 and "gap" in report.reason


@pytest.mark.asyncio
async def test_rewriting_one_event_and_its_hash_still_breaks_the_next_link():
    service = AuditService()
    await seed(service, "t1", 3)
    docs = mongodb.get_database().audit_events._docs
    from app.models.audit import AuditEventModel

    forged = AuditEventModel.model_validate({k: v for k, v in docs[0].items() if k != "_id"})
    forged.details = {"forged": True}
    forged.hash = forged.compute_hash()
    docs[0].update(forged.model_dump())
    report = await service.verify_chain("t1")
    assert not report.valid and report.first_broken_seq == 2 and "link" in report.reason


@pytest.mark.asyncio
async def test_secrets_never_reach_the_log():
    service = AuditService()
    event = await service.record(
        "test.leak", tenant_id="t1", actor_id="u",
        details={"password": "hunter2", "token": "abc", "api_key": "vfn_x", "filename": "r.pdf"},
    )
    assert event.details == {"filename": "r.pdf"}


@pytest.mark.asyncio
async def test_a_storage_failure_is_counted_not_raised():
    class Broken:
        async def last_event(self, tenant_id):
            raise ConnectionError("db down")

    assert await AuditService(repo=Broken()).record("test.x", tenant_id="t1") is None


@pytest.mark.asyncio
async def test_chains_are_per_tenant():
    service = AuditService()
    await seed(service, "t1", 3)
    await seed(service, "t2", 2)
    assert (await service.verify_chain("t1")).events == 3
    assert (await service.verify_chain("t2")).events == 2
    assert (await service.repo.all_in_order("t2"))[0].prev_hash == GENESIS_HASH


# ── Recording from the API ───────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_login_and_user_management_are_recorded(client):
    admin, headers = await register(client, "admin@example.com")
    await client.post(f"{V1}/auth/login", json={"email": "admin@example.com", "password": PASSWORD})
    await client.post(f"{V1}/auth/login", json={"email": "admin@example.com", "password": "wrong-password-1"})
    await client.post(f"{V1}/auth/users", headers=headers,
                      json={"email": "v@example.com", "password": PASSWORD, "role": "viewer"})

    events = (await client.get(f"{V1}/audit/events", headers=headers)).json()
    pairs = [(e["action"], e["outcome"]) for e in reversed(events)]  # oldest first
    assert pairs == [("auth.register", "success"), ("auth.login", "success"),
                     ("auth.login", "denied"), ("user.create", "success")]
    assert "password" not in str(events).lower().replace("password_hash", "")
    assert (await client.get(f"{V1}/audit/verify", headers=headers)).json()["valid"] is True


@pytest.mark.asyncio
async def test_unknown_email_login_attempts_do_not_land_in_a_tenant_log(client):
    _, headers = await register(client, "admin@example.com")
    await client.post(f"{V1}/auth/login", json={"email": "ghost@example.com", "password": "whatever-pass-1"})
    events = (await client.get(f"{V1}/audit/events", headers=headers)).json()
    assert [e["action"] for e in events] == ["auth.register"]
    assert (await AuditService().repo.all_in_order("_unscoped"))[0].outcome == "denied"


@pytest.mark.asyncio
async def test_only_admins_read_the_audit_trail_and_only_their_own(client):
    _, a_headers = await register(client, "a@example.com")
    _, b_headers = await register(client, "b@example.com")
    viewer = await client.post(f"{V1}/auth/users", headers=a_headers,
                               json={"email": "v@example.com", "password": PASSWORD, "role": "viewer"})
    login = await client.post(f"{V1}/auth/login", json={"email": "v@example.com", "password": PASSWORD})
    v_headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
    assert viewer.status_code == 201

    assert (await client.get(f"{V1}/audit/events", headers=v_headers)).status_code == 403
    assert (await client.get(f"{V1}/audit/events")).status_code == 401
    a_ids = {e["tenant_id"] for e in (await client.get(f"{V1}/audit/events", headers=a_headers)).json()}
    b_ids = {e["tenant_id"] for e in (await client.get(f"{V1}/audit/events", headers=b_headers)).json()}
    assert len(a_ids) == len(b_ids) == 1 and a_ids != b_ids


@pytest.mark.asyncio
async def test_events_can_be_filtered_and_paged(client):
    _, headers = await register(client, "a@example.com")
    for _ in range(3):
        await client.post(f"{V1}/auth/login", json={"email": "a@example.com", "password": PASSWORD})
    logins = (await client.get(f"{V1}/audit/events?action=auth.login", headers=headers)).json()
    assert len(logins) == 3
    older = (await client.get(f"{V1}/audit/events?before_seq={logins[0]['seq']}&limit=1", headers=headers)).json()
    assert len(older) == 1 and older[0]["seq"] < logins[0]["seq"]
