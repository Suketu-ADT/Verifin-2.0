"""Sign-in with an emailed one-time code and with Google, exercised through the real FastAPI app."""

import time
from datetime import datetime, timedelta, timezone

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa
from httpx import ASGITransport, AsyncClient

from app.api import auth as auth_api
from app.config import settings
from app.database import fallback_db, mongodb
from app.main import app
from app.repositories.otp_repository import OtpRepository
from app.repositories.user_repository import UserRepository
from app.services import signin

V1 = "/api/v1"
CLIENT_ID = "test-client.apps.googleusercontent.com"
KEY = rsa.generate_private_key(public_exponent=65537, key_size=2048)


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
    monkeypatch.setattr(settings, "google_client_id", CLIENT_ID)
    monkeypatch.setattr(signin, "_google_signing_key", lambda credential: KEY.public_key())
    auth_api.reset_otp_limits()
    yield
    auth_api.reset_otp_limits()


@pytest.fixture
def sent(monkeypatch):
    """Codes the server tried to email, instead of emailing them."""
    box = []
    monkeypatch.setattr(auth_api, "_deliver_code", lambda email, code: box.append((email, code)))
    return box


@pytest.fixture
async def client():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c


def google_token(**overrides):
    now = int(time.time())
    claims = {"iss": "https://accounts.google.com", "aud": CLIENT_ID, "sub": "g-123", "email": "Person@Example.com",
              "email_verified": True, "name": "Pat Person", "iat": now, "exp": now + 600}
    claims.update(overrides)
    return jwt.encode({k: v for k, v in claims.items() if v is not None}, KEY, algorithm="RS256")


# ── Options ──────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_options_report_what_is_available(client, monkeypatch):
    body = (await client.get(f"{V1}/auth/options")).json()
    assert body == {"password": True, "google_client_id": CLIENT_ID, "email_otp": True, "registration": True}

    monkeypatch.setattr(settings, "google_client_id", None)
    monkeypatch.setattr(settings, "environment", "production")  # production without SMTP: codes must not be offered
    body = (await client.get(f"{V1}/auth/options")).json()
    assert body["google_client_id"] is None and body["email_otp"] is False


# ── Email codes ──────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_code_signs_in_a_new_address_and_works_once(client, sent):
    r = await client.post(f"{V1}/auth/otp/request", json={"email": "New@Example.com"})
    assert r.status_code == 202
    (email, code), = sent
    assert email == "new@example.com" and len(code) == settings.otp_length and code.isdigit()

    ok = await client.post(f"{V1}/auth/otp/verify", json={"email": "new@example.com", "code": code, "name": "Nia"})
    assert ok.status_code == 200
    user = ok.json()["user"]
    assert user["role"] == "admin" and user["name"] == "Nia"
    assert (await UserRepository().get_user_by_email("new@example.com")).email_verified is True

    again = await client.post(f"{V1}/auth/otp/verify", json={"email": "new@example.com", "code": code})
    assert again.status_code == 401


@pytest.mark.asyncio
async def test_code_for_an_existing_user_keeps_their_account(client, sent):
    reg = await client.post(f"{V1}/auth/register", json={"email": "a@example.com", "password": "correct-horse-battery"})
    await client.post(f"{V1}/auth/otp/request", json={"email": "a@example.com"})
    ok = await client.post(f"{V1}/auth/otp/verify", json={"email": "a@example.com", "code": sent[0][1]})
    assert ok.status_code == 200 and ok.json()["user"]["id"] == reg.json()["user"]["id"]


@pytest.mark.asyncio
async def test_wrong_codes_are_limited_and_destroy_the_code(client, sent):
    await client.post(f"{V1}/auth/otp/request", json={"email": "b@example.com"})
    good = sent[0][1]
    wrong = "000000" if good != "000000" else "111111"
    for _ in range(settings.otp_max_attempts):
        r = await client.post(f"{V1}/auth/otp/verify", json={"email": "b@example.com", "code": wrong})
        assert r.status_code == 401
    # the right code no longer works: it was thrown away after the last wrong guess
    late = await client.post(f"{V1}/auth/otp/verify", json={"email": "b@example.com", "code": good})
    assert late.status_code == 401


@pytest.mark.asyncio
async def test_expired_code_is_refused(client, sent):
    await client.post(f"{V1}/auth/otp/request", json={"email": "c@example.com"})
    await OtpRepository().save("c@example.com", signin.hash_code("c@example.com", "123456"),
                               datetime.now(timezone.utc) - timedelta(seconds=1))
    r = await client.post(f"{V1}/auth/otp/verify", json={"email": "c@example.com", "code": "123456"})
    assert r.status_code == 401


@pytest.mark.asyncio
async def test_a_code_is_bound_to_its_address(client, sent):
    await client.post(f"{V1}/auth/otp/request", json={"email": "d@example.com"})
    r = await client.post(f"{V1}/auth/otp/verify", json={"email": "other@example.com", "code": sent[0][1]})
    assert r.status_code == 401


@pytest.mark.asyncio
async def test_unknown_address_gets_no_code_when_registration_is_closed(client, sent, monkeypatch):
    monkeypatch.setattr(settings, "allow_registration", False)
    r = await client.post(f"{V1}/auth/otp/request", json={"email": "stranger@example.com"})
    assert r.status_code == 202 and sent == []  # same answer as for a real address: nothing reveals who has an account


@pytest.mark.asyncio
async def test_disabled_user_gets_no_code(client, sent):
    reg = await client.post(f"{V1}/auth/register", json={"email": "e@example.com", "password": "correct-horse-battery"})
    await UserRepository().update_user(reg.json()["user"]["id"], {"is_active": False})
    r = await client.post(f"{V1}/auth/otp/request", json={"email": "e@example.com"})
    assert r.status_code == 202 and sent == []


@pytest.mark.asyncio
async def test_codes_cannot_be_requested_in_quick_succession(client, sent):
    first = await client.post(f"{V1}/auth/otp/request", json={"email": "f@example.com"})
    second = await client.post(f"{V1}/auth/otp/request", json={"email": "f@example.com"})
    assert first.status_code == 202 and second.status_code == 429
    assert int(second.headers["retry-after"]) >= 1 and len(sent) == 1


@pytest.mark.asyncio
async def test_codes_unavailable_in_production_without_smtp(client, monkeypatch):
    monkeypatch.setattr(settings, "environment", "production")
    r = await client.post(f"{V1}/auth/otp/request", json={"email": "g@example.com"})
    assert r.status_code == 503


# ── Google ───────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_google_creates_an_account_then_signs_in_again(client):
    first = await client.post(f"{V1}/auth/google", json={"credential": google_token()})
    assert first.status_code == 200
    user = first.json()["user"]
    assert user["email"] == "person@example.com" and user["name"] == "Pat Person" and user["role"] == "admin"
    stored = await UserRepository().get_user_by_email("person@example.com")
    assert stored.google_id == "g-123" and stored.email_verified is True

    second = await client.post(f"{V1}/auth/google", json={"credential": google_token()})
    assert second.json()["user"]["id"] == user["id"]


@pytest.mark.asyncio
async def test_google_links_to_the_account_with_the_same_email(client):
    reg = await client.post(f"{V1}/auth/register", json={"email": "person@example.com", "password": "correct-horse-battery"})
    g = await client.post(f"{V1}/auth/google", json={"credential": google_token()})
    assert g.json()["user"]["id"] == reg.json()["user"]["id"]


@pytest.mark.asyncio
async def test_google_account_cannot_take_over_an_account_linked_to_another_google_id(client):
    await client.post(f"{V1}/auth/google", json={"credential": google_token()})
    r = await client.post(f"{V1}/auth/google", json={"credential": google_token(sub="someone-else")})
    assert r.status_code == 401


@pytest.mark.asyncio
@pytest.mark.parametrize("overrides", [
    {"aud": "another-app.apps.googleusercontent.com"},
    {"iss": "https://evil.example.com"},
    {"email_verified": False},
    {"email": None},
    {"exp": int(time.time()) - 3600, "iat": int(time.time()) - 7200},
])
async def test_google_tokens_that_do_not_check_out_are_refused(client, overrides):
    r = await client.post(f"{V1}/auth/google", json={"credential": google_token(**overrides)})
    assert r.status_code == 401
    assert await UserRepository().get_user_by_email("person@example.com") is None


@pytest.mark.asyncio
async def test_google_token_signed_with_another_key_is_refused(client):
    other = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    now = int(time.time())
    forged = jwt.encode({"iss": "https://accounts.google.com", "aud": CLIENT_ID, "sub": "x", "email": "p@example.com",
                         "email_verified": True, "iat": now, "exp": now + 600}, other, algorithm="RS256")
    assert (await client.post(f"{V1}/auth/google", json={"credential": forged})).status_code == 401


@pytest.mark.asyncio
async def test_google_respects_closed_registration_and_missing_configuration(client, monkeypatch):
    monkeypatch.setattr(settings, "allow_registration", False)
    assert (await client.post(f"{V1}/auth/google", json={"credential": google_token()})).status_code == 403
    monkeypatch.setattr(settings, "google_client_id", None)
    assert (await client.post(f"{V1}/auth/google", json={"credential": google_token()})).status_code == 503
