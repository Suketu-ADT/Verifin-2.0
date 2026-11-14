"""GET /auth/session: the web app's first "who am I" request. Unlike /auth/me it never answers 401 for a signed-out visitor."""

from app.config import settings
from app.observability import metrics
from tests.test_account_and_reset import V1, bearer, client, login, make_user, secured_app  # noqa: F401  (fixtures)


def failures(reason):
    return metrics.AUTH_FAILURES.labels(reason)._value.get()


async def test_signed_out_visitor_gets_200_with_no_user_and_no_failure_is_counted(client):
    before = failures("missing")
    r = await client.get(f"{V1}/auth/session")
    assert r.status_code == 200
    assert r.json() == {"user": None, "auth_enabled": True}
    assert failures("missing") == before  # nobody tried to authenticate, so nothing failed
    assert (await client.get(f"{V1}/auth/me")).status_code == 401  # /me keeps its strict behaviour


async def test_signed_in_user_is_returned(client):
    await make_user()
    r = await client.get(f"{V1}/auth/session", headers=bearer(await login(client)))
    body = r.json()
    assert r.status_code == 200 and body["auth_enabled"] is True
    assert body["user"]["email"] == "u@example.com" and body["user"]["role"] == "admin"


async def test_a_bad_or_revoked_token_answers_200_with_no_user(client):
    await make_user()
    assert (await client.get(f"{V1}/auth/session", headers=bearer("not-a-token"))).json()["user"] is None
    old = await login(client)
    await client.post(f"{V1}/auth/sessions/revoke", headers=bearer(old))  # signs out everywhere else, including this token
    r = await client.get(f"{V1}/auth/session", headers=bearer(old))
    assert r.status_code == 200 and r.json()["user"] is None


async def test_a_token_for_a_deleted_account_answers_200_with_no_user(client, monkeypatch):
    await make_user()
    token = await login(client)
    from app.repositories.user_repository import UserRepository

    async def gone(self, user_id):
        return None

    monkeypatch.setattr(UserRepository, "get_user_by_id", gone)
    r = await client.get(f"{V1}/auth/session", headers=bearer(token))
    assert r.status_code == 200 and r.json()["user"] is None


async def test_with_authentication_off_the_anonymous_user_is_returned(client, monkeypatch):
    monkeypatch.setattr(settings, "auth_enabled", False)
    r = await client.get(f"{V1}/auth/session")
    assert r.status_code == 200
    assert r.json()["auth_enabled"] is False and r.json()["user"]["email"] == "anonymous@local"


async def test_other_endpoints_still_require_sign_in(client):
    assert (await client.get(f"{V1}/auth/users")).status_code == 401
    assert (await client.get(f"{V1}/documents")).status_code in (401, 403)
