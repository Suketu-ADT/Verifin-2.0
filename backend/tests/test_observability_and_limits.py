"""Request context, headers, metrics, rate limits, log redaction and health probes."""

import json
import logging
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import ASGITransport, AsyncClient

from app.config import settings
from app.main import app
from app.observability.logging_setup import ContextFilter, JsonFormatter, redact
from app.observability.middleware import parse_traceparent
from app.security.rate_limit import SlidingWindowLimiter


@pytest.fixture
async def client():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c


# ── Request context and headers ──────────────────────────────────────────────


@pytest.mark.asyncio
async def test_request_id_is_generated_and_echoed(client):
    r = await client.get("/api/v1/system/live")
    assert len(r.headers["x-request-id"]) == 32

    r = await client.get("/api/v1/system/live", headers={"X-Request-ID": "client-supplied-123"})
    assert r.headers["x-request-id"] == "client-supplied-123"


@pytest.mark.asyncio
async def test_malformed_request_id_is_replaced(client):
    r = await client.get("/api/v1/system/live", headers={"X-Request-ID": "bad id with spaces"})
    assert r.headers["x-request-id"] != "bad id with spaces"
    assert len(r.headers["x-request-id"]) == 32


@pytest.mark.asyncio
async def test_traceparent_is_propagated_with_a_new_span(client):
    trace = "4bf92f3577b34da6a3ce929d0e0e4736"
    r = await client.get("/api/v1/system/live", headers={"traceparent": f"00-{trace}-00f067aa0ba902b7-01"})
    version, trace_id, span_id, flags = r.headers["traceparent"].split("-")
    assert (version, trace_id, flags) == ("00", trace, "01")
    assert span_id != "00f067aa0ba902b7" and len(span_id) == 16


def test_invalid_traceparents_are_ignored():
    assert parse_traceparent("garbage") is None
    assert parse_traceparent(f"00-{'0' * 32}-00f067aa0ba902b7-01") is None
    assert parse_traceparent(f"00-{'a' * 32}-{'0' * 16}-01") is None
    assert parse_traceparent(f"00-{'a' * 32}-{'b' * 16}-01") == ("a" * 32, "01")


@pytest.mark.asyncio
async def test_security_and_version_headers(client):
    r = await client.get("/api/v1/system/live")
    assert r.headers["x-content-type-options"] == "nosniff"
    assert r.headers["x-frame-options"] == "DENY"
    assert r.headers["x-api-version"] == "1"
    assert "deprecation" not in r.headers


@pytest.mark.asyncio
async def test_legacy_paths_announce_their_deprecation(client):
    r = await client.get("/api/system/live")
    assert r.status_code == 200
    assert r.headers["deprecation"] == "true"
    assert "successor-version" in r.headers["link"]


@pytest.mark.asyncio
async def test_errors_carry_the_request_id(client):
    r = await client.post("/api/v1/verification/start", json={})
    assert r.status_code == 422
    assert r.json()["request_id"] == r.headers["x-request-id"]


# ── Metrics ──────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_metrics_endpoint_exposes_route_templates_not_raw_paths(client, monkeypatch):
    monkeypatch.setattr(settings, "metrics_token", None)
    await client.get("/api/v1/documents/some-private-id")
    text = (await client.get("/metrics")).text
    assert "verifin_http_requests_total" in text
    assert 'route="/api/v1/documents/{document_id}"' in text
    assert "some-private-id" not in text


@pytest.mark.asyncio
async def test_metrics_token_is_enforced(client, monkeypatch):
    monkeypatch.setattr(settings, "metrics_token", "scrape-secret")
    assert (await client.get("/metrics")).status_code == 401
    assert (await client.get("/metrics", headers={"Authorization": "Bearer wrong"})).status_code == 401
    ok = await client.get("/metrics", headers={"Authorization": "Bearer scrape-secret"})
    assert ok.status_code == 200


@pytest.mark.asyncio
async def test_metrics_are_never_exposed_unprotected_in_production(client, monkeypatch):
    monkeypatch.setattr(settings, "metrics_token", None)
    monkeypatch.setattr(settings, "environment", "production")
    assert (await client.get("/metrics")).status_code == 404


# ── Rate limiting ────────────────────────────────────────────────────────────


def test_sliding_window_counts_and_recovers():
    lim = SlidingWindowLimiter(window=60)
    assert [lim.check("k", 3, now=t)[0] for t in (0, 1, 2)] == [True, True, True]
    allowed, remaining, retry = lim.check("k", 3, now=3)
    assert (allowed, remaining) == (False, 0) and retry == pytest.approx(57)
    assert lim.check("other", 3, now=3)[0] is True  # keys are independent
    assert lim.check("k", 3, now=61)[0] is True  # the first hit has left the window


@pytest.mark.asyncio
async def test_general_rate_limit_returns_429_with_retry_after(client, monkeypatch):
    monkeypatch.setattr(settings, "rate_limit_enabled", True)
    monkeypatch.setattr(settings, "rate_limit_per_minute", 3)
    statuses = [(await client.get("/api/v1/documents/x")).status_code for _ in range(5)]
    assert 429 not in statuses[:3] and statuses[3:] == [429, 429]
    blocked = await client.get("/api/v1/documents/x")
    assert int(blocked.headers["retry-after"]) >= 1
    assert blocked.json()["error"] == "Too Many Requests"


@pytest.mark.asyncio
async def test_probes_are_exempt_from_rate_limits(client, monkeypatch):
    monkeypatch.setattr(settings, "rate_limit_enabled", True)
    monkeypatch.setattr(settings, "rate_limit_per_minute", 1)
    assert all([(await client.get("/api/v1/system/live")).status_code == 200 for _ in range(5)])


@pytest.mark.asyncio
async def test_login_attempts_are_limited_more_tightly(client, monkeypatch):
    monkeypatch.setattr(settings, "rate_limit_enabled", True)
    monkeypatch.setattr(settings, "rate_limit_auth_per_minute", 3)
    body = {"email": "nobody@example.com", "password": "whatever-password"}
    codes = [(await client.post("/api/v1/auth/login", json=body)).status_code for _ in range(5)]
    assert codes[3:] == [429, 429] and 429 not in codes[:3]


@pytest.mark.asyncio
async def test_heavy_endpoints_have_their_own_limit(client, monkeypatch):
    monkeypatch.setattr(settings, "rate_limit_enabled", True)
    monkeypatch.setattr(settings, "rate_limit_per_minute", 1000)
    monkeypatch.setattr(settings, "rate_limit_heavy_per_minute", 2)
    payload = {"document_id": "d", "llm_output": "x y z"}
    codes = [(await client.post("/api/v1/verification/start", json=payload)).status_code for _ in range(4)]
    assert codes[2:] == [429, 429] and 429 not in codes[:2]


@pytest.mark.asyncio
async def test_forwarded_header_is_ignored_unless_proxy_is_trusted(client, monkeypatch):
    monkeypatch.setattr(settings, "rate_limit_enabled", True)
    monkeypatch.setattr(settings, "rate_limit_per_minute", 2)
    monkeypatch.setattr(settings, "trust_proxy_headers", False)
    codes = []
    for i in range(4):  # a spoofed header must not give each request its own bucket
        r = await client.get("/api/v1/documents/x", headers={"X-Forwarded-For": f"10.0.0.{i}"})
        codes.append(r.status_code)
    assert codes[2:] == [429, 429]


# ── Logging ──────────────────────────────────────────────────────────────────


def test_credentials_are_redacted_from_log_text():
    text = (
        "Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.abc.def key=vfn_abcdefghijklmnop "
        "uri=mongodb+srv://user:hunter2pass@cluster.example.net/db password=hunter2pass"
    )
    cleaned = redact(text)
    for secret in ("eyJhbGciOiJIUzI1NiJ9", "vfn_abcdefghijklmnop", "hunter2pass"):
        assert secret not in cleaned


def test_json_log_line_is_valid_and_carries_context():
    from app.observability.context import request_id_var

    token = request_id_var.set("req-123456")
    try:
        record = logging.LogRecord("verifin", logging.INFO, __file__, 1, "token=%s", ("abcdef123456",), None)
        ContextFilter().filter(record)
        entry = json.loads(JsonFormatter().format(record))
    finally:
        request_id_var.reset(token)
    assert entry["request_id"] == "req-123456"
    assert entry["level"] == "INFO"
    assert "abcdef123456" not in entry["message"]


# ── Probes ───────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_readiness_reports_503_when_a_dependency_is_down(client):
    with patch("app.api.system.ping_database", new_callable=AsyncMock) as ping, \
         patch("app.api.system.get_embedding_service") as emb, patch("app.api.system.get_nli_service") as nli:
        emb.return_value = MagicMock(is_healthy=lambda: True)
        nli.return_value = MagicMock(is_healthy=lambda: True)
        ping.return_value = True
        assert (await client.get("/api/v1/system/ready")).status_code == 200
        ping.return_value = False
        down = await client.get("/api/v1/system/ready")
        assert down.status_code == 503 and down.json()["database"] is False
