"""Password reset by emailed code, and the signed-in account endpoints (change password, sign out everywhere, profile)."""

import pytest
from httpx import ASGITransport, AsyncClient

from app.api import auth as auth_api
from app.config import settings
from app.database import fallback_db, mongodb
from app.main import app
from app.repositories.user_repository import UserRepository

V1 = "/api/v1"
OLD = "Old-Password-1"
NEW = "New-Password-2"


@pytest.fixture(autouse=True)
def secured_app(monkeypatch):
    monkeypatch.setattr(fallback_db, "_load_persisted_store", lambda: {})
    monkeypatch.setattr(fallback_db, "_save_persisted_store", lambda store: None)
    monkeypatch.setattr(mongodb.manager, "database", fallback_db.FallbackDatabase())
    monkeypatch.setattr(settings, "auth_enabled", True)
    monkeypatch.setattr(settings, "allow_registration", True)
    monkeypatch.setattr(settings, "environment", "development")
    monkeypatch.setattr(settings, "jwt_secret", "test-secret-" + "x" * 32)
    monkeypatch.setattr(settings, "rate_limit_enabled", False)
    monkeypatch.setattr(settings, "email_otp_enabled", True)
    for name in ("smtp_host", "smtp_username", "smtp_password", "smtp_from"):  # never use a developer's real mail settings
        monkeypatch.setattr(settings, name, None)
    auth_api.reset_otp_limits()
    yield
    auth_api.reset_otp_limits()


@pytest.fixture
def sent(monkeypatch):
    """Codes the server tried to email as (kind, address, code), instead of emailing them."""
    box = []
    monkeypatch.setattr(auth_api, "_deliver_code", lambda email, code: box.append(("signin", email, code)))
    monkeypatch.setattr(auth_api, "_deliver_reset_code", lambda email, code: box.append(("reset", email, code)))
    return box


@pytest.fixture
async def client():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c


async def make_user(email="u@example.com", password=OLD, **fields):
    user = await auth_api._new_user(email, password, "Una", tenant_id="t-" + email, role="admin")
    if fields:
        await UserRepository().update_user(user.id, fields)
    return user


async def login(client, email="u@example.com", password=OLD):
    r = await client.post(f"{V1}/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


def bearer(token):
    return {"Authorization": f"Bearer {token}"}


async def ask_reset(client, sent, email="u@example.com"):
    r = await client.post(f"{V1}/auth/password/reset/request", json={"email": email})
    assert r.status_code == 202
    return sent[-1][2] if sent else None


# ── Options ──────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_options_say_when_password_reset_is_available(client, monkeypatch):
    assert (await client.get(f"{V1}/auth/options")).json()["password_reset"] is True
    monkeypatch.setattr(settings, "environment", "production")  # no SMTP in production: no codes, so no reset
    assert (await client.get(f"{V1}/auth/options")).json()["password_reset"] is False
    r = await client.post(f"{V1}/auth/password/reset/request", json={"email": "u@example.com"})
    assert r.status_code == 503


# ── Reset by emailed code ────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_reset_sets_a_new_password_and_the_code_works_once(client, sent):
    await make_user()
    code = await ask_reset(client, sent)
    assert sent[0][0] == "reset" and sent[0][1] == "u@example.com"

    done = await client.post(f"{V1}/auth/password/reset/confirm", json={"email": "u@example.com", "code": code, "new_password": NEW})
    assert done.status_code == 200
    assert (await client.post(f"{V1}/auth/login", json={"email": "u@example.com", "password": OLD})).status_code == 401
    await login(client, password=NEW)
    assert (await UserRepository().get_user_by_email("u@example.com")).email_verified is True

    again = await client.post(f"{V1}/auth/password/reset/confirm", json={"email": "u@example.com", "code": code, "new_password": "Third-Password-3"})
    assert again.status_code == 401


@pytest.mark.asyncio
async def test_unknown_address_gets_the_same_answer_and_no_code(client, sent):
    r = await client.post(f"{V1}/auth/password/reset/request", json={"email": "nobody@example.com"})
    assert r.status_code == 202 and sent == []
    known = await make_user()
    r2 = await client.post(f"{V1}/auth/password/reset/request", json={"email": known.email})
    assert r2.status_code == 202 and r2.json().keys() == r.json().keys()


@pytest.mark.asyncio
async def test_a_disabled_account_gets_no_reset_code(client, sent):
    await make_user(is_active=False)
    assert (await client.post(f"{V1}/auth/password/reset/request", json={"email": "u@example.com"})).status_code == 202
    assert sent == []


@pytest.mark.asyncio
async def test_sign_in_codes_and_reset_codes_are_not_interchangeable(client, sent):
    await make_user()
    await client.post(f"{V1}/auth/otp/request", json={"email": "u@example.com"})
    signin_code = sent[-1][2]
    refused = await client.post(f"{V1}/auth/password/reset/confirm", json={"email": "u@example.com", "code": signin_code, "new_password": NEW})
    assert refused.status_code == 401  # a sign-in code cannot change the password

    await client.post(f"{V1}/auth/password/reset/request", json={"email": "u@example.com"})
    reset_code = sent[-1][2]
    refused = await client.post(f"{V1}/auth/otp/verify", json={"email": "u@example.com", "code": reset_code})
    assert refused.status_code == 401  # a reset code cannot sign anyone in
    await login(client)  # the old password still works: nothing changed


@pytest.mark.asyncio
async def test_a_weak_new_password_does_not_spend_the_code(client, sent):
    await make_user()
    code = await ask_reset(client, sent)
    weak = await client.post(f"{V1}/auth/password/reset/confirm", json={"email": "u@example.com", "code": code, "new_password": "short"})
    assert weak.status_code == 422
    ok = await client.post(f"{V1}/auth/password/reset/confirm", json={"email": "u@example.com", "code": code, "new_password": NEW})
    assert ok.status_code == 200


@pytest.mark.asyncio
async def test_wrong_reset_codes_are_limited_and_destroy_the_code(client, sent):
    await make_user()
    code = await ask_reset(client, sent)
    bad = "000000" if code != "000000" else "111111"
    for _ in range(settings.otp_max_attempts):
        r = await client.post(f"{V1}/auth/password/reset/confirm", json={"email": "u@example.com", "code": bad, "new_password": NEW})
        assert r.status_code == 401
    right = await client.post(f"{V1}/auth/password/reset/confirm", json={"email": "u@example.com", "code": code, "new_password": NEW})
    assert right.status_code == 401  # too many wrong guesses: the real code no longer works
    await login(client)


@pytest.mark.asyncio
async def test_reset_requests_have_their_own_cooldown(client, sent):
    await make_user()
    assert (await client.post(f"{V1}/auth/password/reset/request", json={"email": "u@example.com"})).status_code == 202
    again = await client.post(f"{V1}/auth/password/reset/request", json={"email": "u@example.com"})
    assert again.status_code == 429 and "Retry-After" in again.headers
    # asking for a sign-in code is a separate allowance
    assert (await client.post(f"{V1}/auth/otp/request", json={"email": "u@example.com"})).status_code == 202


@pytest.mark.asyncio
async def test_reset_ends_every_older_session(client, sent):
    await make_user()
    old_token = await login(client)
    assert (await client.get(f"{V1}/auth/me", headers=bearer(old_token))).status_code == 200
    code = await ask_reset(client, sent)
    await client.post(f"{V1}/auth/password/reset/confirm", json={"email": "u@example.com", "code": code, "new_password": NEW})
    assert (await client.get(f"{V1}/auth/me", headers=bearer(old_token))).status_code == 401
    assert (await client.get(f"{V1}/auth/me", headers=bearer(await login(client, password=NEW)))).status_code == 200


@pytest.mark.asyncio
async def test_an_account_without_a_password_can_set_one_with_a_reset_code(client, sent):
    await UserRepository().create_user(
        auth_api.UserModel(id="g1", email="g@example.com", tenant_id="t-g", role="admin", email_verified=True, google_id="gid"))
    me_token = auth_api.create_access_token("g1", "t-g", "admin")
    profile = (await client.get(f"{V1}/auth/me", headers=bearer(me_token))).json()
    assert profile["has_password"] is False and profile["google_linked"] is True

    code = await ask_reset(client, sent, "g@example.com")
    ok = await client.post(f"{V1}/auth/password/reset/confirm", json={"email": "g@example.com", "code": code, "new_password": NEW})
    assert ok.status_code == 200
    await login(client, "g@example.com", NEW)


# ── Signed-in account ────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_me_describes_how_the_account_signs_in(client):
    await make_user()
    me = (await client.get(f"{V1}/auth/me", headers=bearer(await login(client)))).json()
    assert me["has_password"] is True and me["google_linked"] is False and me["email_verified"] is False


@pytest.mark.asyncio
async def test_change_password_needs_the_current_one_and_ends_other_sessions(client):
    await make_user()
    here, elsewhere = await login(client), await login(client)

    wrong = await client.post(f"{V1}/auth/password/change", headers=bearer(here), json={"current_password": "nope-nope-nope", "new_password": NEW})
    assert wrong.status_code == 400
    weak = await client.post(f"{V1}/auth/password/change", headers=bearer(here), json={"current_password": OLD, "new_password": "short"})
    assert weak.status_code == 422

    ok = await client.post(f"{V1}/auth/password/change", headers=bearer(here), json={"current_password": OLD, "new_password": NEW})
    assert ok.status_code == 200
    fresh = ok.json()["access_token"]
    assert (await client.get(f"{V1}/auth/me", headers=bearer(fresh))).status_code == 200  # the caller stays signed in
    assert (await client.get(f"{V1}/auth/me", headers=bearer(here))).status_code == 401
    assert (await client.get(f"{V1}/auth/me", headers=bearer(elsewhere))).status_code == 401
    assert (await client.post(f"{V1}/auth/login", json={"email": "u@example.com", "password": OLD})).status_code == 401
    await login(client, password=NEW)


@pytest.mark.asyncio
async def test_change_password_refuses_an_account_that_has_none(client):
    await UserRepository().create_user(auth_api.UserModel(id="g2", email="g2@example.com", tenant_id="t-g2", role="admin"))
    token = auth_api.create_access_token("g2", "t-g2", "admin")
    r = await client.post(f"{V1}/auth/password/change", headers=bearer(token), json={"current_password": OLD, "new_password": NEW})
    assert r.status_code == 400 and "no password" in r.json()["detail"].lower()


@pytest.mark.asyncio
async def test_sign_out_everywhere_keeps_only_the_caller(client):
    await make_user()
    here, other = await login(client), await login(client)
    r = await client.post(f"{V1}/auth/sessions/revoke", headers=bearer(here))
    assert r.status_code == 200
    assert (await client.get(f"{V1}/auth/me", headers=bearer(other))).status_code == 401
    assert (await client.get(f"{V1}/auth/me", headers=bearer(here))).status_code == 401
    assert (await client.get(f"{V1}/auth/me", headers=bearer(r.json()["access_token"]))).status_code == 200


@pytest.mark.asyncio
async def test_profile_name_can_be_changed_but_not_emptied(client):
    await make_user()
    token = await login(client)
    ok = await client.patch(f"{V1}/auth/me", headers=bearer(token), json={"name": "  Una Updated  "})
    assert ok.status_code == 200 and ok.json()["name"] == "Una Updated"
    assert (await client.patch(f"{V1}/auth/me", headers=bearer(token), json={"name": "   "})).status_code == 422


@pytest.mark.asyncio
async def test_account_endpoints_need_a_signed_in_user_not_an_api_key(client):
    user = await make_user()
    assert (await client.patch(f"{V1}/auth/me", json={"name": "X"})).status_code == 401
    assert (await client.post(f"{V1}/auth/sessions/revoke")).status_code == 401

    key = (await client.post(f"{V1}/auth/api-keys", headers=bearer(await login(client)), json={"name": "k", "role": "analyst"})).json()["key"]
    r = await client.post(f"{V1}/auth/password/change", headers={"X-API-Key": key}, json={"current_password": OLD, "new_password": NEW})
    assert r.status_code == 403
    assert (await UserRepository().get_user_by_id(user.id)).session_version == 0


@pytest.mark.asyncio
async def test_invalid_input_is_a_422_that_does_not_echo_the_input(client):
    """A custom validator error used to crash the error handler (500) and echo what was submitted."""
    r = await client.post(f"{V1}/auth/login", json={"email": "not-an-email", "password": "Super-Secret-Pass-9"})
    assert r.status_code == 422
    assert "Super-Secret-Pass-9" not in r.text and "not-an-email" not in r.text
    assert r.json()["detail"][0]["loc"][-1] == "email"
