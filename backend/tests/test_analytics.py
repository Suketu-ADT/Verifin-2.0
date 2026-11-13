"""Analytics: the aggregation maths, and the endpoint's scoping to the caller's organisation and window."""

from datetime import datetime, timedelta, timezone

import pytest
from httpx import ASGITransport, AsyncClient

from app.config import settings
from app.database import fallback_db, mongodb
from app.main import app
from app.models.claim import ClaimModel
from app.models.document import DocumentModel
from app.models.verification import VerificationSessionModel
from app.repositories.document_repository import DocumentRepository
from app.repositories.verification_repository import VerificationRepository
from app.services.analytics_service import build_overview

V1 = "/api/v1"
NOW = datetime(2026, 11, 13, 12, 0, tzinfo=timezone.utc)


def session(sid, days_ago, document="d1", score=50.0, risk="MEDIUM", tenant="t1"):
    return VerificationSessionModel(id=sid, tenant_id=tenant, document_id=document, llm_output="x", status="completed",
                                    overall_score=score, risk_level=risk, created_at=NOW - timedelta(days=days_ago, hours=1))


def claim(cid, sid, status, claim_type="numerical", htype=None, risk=None, rule="nli", text="Revenue rose 5%."):
    return ClaimModel(id=cid, session_id=sid, claim_text=text, claim_type=claim_type, status=status, hallucination_type=htype,
                      hallucination_risk_score=risk, decided_by=rule)


# ── The maths ────────────────────────────────────────────────────────────────


def test_totals_rates_and_a_daily_trend_with_empty_days_kept():
    sessions = [session("s1", 0, score=80), session("s2", 2, score=40)]
    claims = [claim("c1", "s1", "SUPPORTED"), claim("c2", "s1", "CONTRADICTED", htype="NUMERICAL_MISMATCH", risk=0.9),
              claim("c3", "s2", "UNVERIFIED", htype="UNSUPPORTED_FABRICATION", risk=0.5), claim("c4", "s2", "SUPPORTED")]
    out = build_overview(sessions, claims, {"d1": "annual.pdf"}, days=7, now=NOW)

    t = out["totals"]
    assert (t["verifications"], t["claims"], t["supported"], t["contradicted"], t["unverified"]) == (2, 4, 2, 1, 1)
    assert t["hallucination_rate"] == 0.25 and t["unverified_rate"] == 0.25 and t["support_rate"] == 0.5
    assert t["average_score"] == 60.0

    trend = out["trend"]
    assert len(trend) == 7 and trend[-1]["date"] == "2026-11-13"
    assert trend[-1]["claims"] == 2 and trend[-1]["contradicted"] == 1 and trend[-1]["hallucination_rate"] == 0.5
    assert trend[-3]["claims"] == 2 and trend[-2]["claims"] == 0  # a quiet day is a zero, not a gap


def test_the_daily_trend_adds_up_to_the_totals_even_for_runs_early_in_the_first_day():
    early = VerificationSessionModel(id="e", tenant_id="t1", document_id="d1", llm_output="x", status="completed", overall_score=10.0,
                                     risk_level="HIGH", created_at=datetime(2026, 11, 7, 0, 5, tzinfo=timezone.utc))
    late = session("l", 0)
    claims = [claim("1", "e", "CONTRADICTED"), claim("2", "l", "SUPPORTED")]
    out = build_overview([early, late], claims, {}, days=7, now=NOW)
    assert out["trend"][0]["date"] == "2026-11-07" and out["trend"][0]["claims"] == 1
    assert sum(p["claims"] for p in out["trend"]) == out["totals"]["claims"] == 2


def test_the_window_excludes_older_runs_and_feeds_the_comparison():
    sessions = [session("now", 1), session("before", 9)]
    claims = [claim("a", "now", "CONTRADICTED"), claim("b", "before", "SUPPORTED"), claim("c", "before", "SUPPORTED")]
    out = build_overview(sessions, claims, {}, days=7, now=NOW)
    assert out["totals"]["claims"] == 1 and out["totals"]["hallucination_rate"] == 1.0
    assert out["previous"]["claims"] == 2 and out["previous"]["hallucination_rate"] == 0.0


def test_documents_are_ranked_by_contradicted_share_then_unverified():
    sessions = [session("a", 1, "clean"), session("b", 1, "bad"), session("c", 1, "vague")]
    claims = [claim("1", "a", "SUPPORTED"), claim("2", "a", "SUPPORTED"),
              claim("3", "b", "CONTRADICTED"), claim("4", "b", "SUPPORTED"),
              claim("5", "c", "UNVERIFIED"), claim("6", "c", "SUPPORTED")]
    docs = build_overview(sessions, claims, {"clean": "clean.pdf", "bad": "bad.pdf"}, days=30, now=NOW)["documents"]
    assert [d["document_name"] for d in docs] == ["bad.pdf", "Unnamed document", "clean.pdf"]
    assert docs[0]["hallucination_rate"] == 0.5 and docs[1]["unverified_rate"] == 0.5


def test_breakdowns_by_claim_type_hallucination_type_and_rule():
    sessions = [session("s", 1, risk="HIGH")]
    claims = [claim("1", "s", "CONTRADICTED", "numerical", "NUMERICAL_MISMATCH", 0.9, rule="table_mismatch"),
              claim("2", "s", "CONTRADICTED", "numerical", "NUMERICAL_MISMATCH", 0.8, rule="table_mismatch"),
              claim("3", "s", "UNVERIFIED", "factual", "UNSUPPORTED_FABRICATION", 0.5, rule="nli"),
              claim("4", "s", "SUPPORTED", "factual", "NONE", None, rule="nli")]
    out = build_overview(sessions, claims, {}, days=30, now=NOW)
    types = {t["claim_type"]: t for t in out["claim_types"]}
    assert types["numerical"]["claims"] == 2 and types["numerical"]["hallucination_rate"] == 1.0
    assert types["factual"]["unverified"] == 1 and types["factual"]["supported"] == 1
    assert out["hallucination_types"] == [{"name": "NUMERICAL_MISMATCH", "claims": 2}, {"name": "UNSUPPORTED_FABRICATION", "claims": 1}]
    assert {r["name"]: r["claims"] for r in out["rules"]} == {"table_mismatch": 2, "nli": 2}
    assert out["risk_levels"] == [{"name": "HIGH", "verifications": 1}]


def test_top_claims_lists_contradicted_before_unverified_by_risk_and_truncates_text():
    sessions = [session("s", 1, document="d1")]
    claims = [claim("low", "s", "CONTRADICTED", risk=0.2), claim("high", "s", "CONTRADICTED", risk=0.95, text="x" * 400),
              claim("unv", "s", "UNVERIFIED", risk=0.99), claim("ok", "s", "SUPPORTED")]
    top = build_overview(sessions, claims, {"d1": "a.pdf"}, days=30, now=NOW)["top_claims"]
    assert [c["claim_id"] for c in top] == ["high", "low", "unv"]  # supported claims never appear
    assert len(top[0]["claim_text"]) == 180 and top[0]["claim_text"].endswith("...") and top[0]["document_name"] == "a.pdf"


def test_score_bins_cover_the_whole_range_including_a_perfect_score():
    sessions = [session("a", 1, score=0), session("b", 1, score=19.9), session("c", 1, score=55), session("d", 1, score=100)]
    bins = build_overview(sessions, [], {}, days=30, now=NOW)["score_bins"]
    assert [b["verifications"] for b in bins] == [2, 0, 1, 0, 1] and bins[-1]["upper"] == 100


def test_an_empty_window_gives_zeros_not_errors():
    out = build_overview([], [], {}, days=14, now=NOW)
    assert out["totals"]["claims"] == 0 and out["totals"]["hallucination_rate"] == 0.0 and out["totals"]["average_score"] == 0.0
    assert len(out["trend"]) == 14 and out["documents"] == [] and out["top_claims"] == []


# ── The endpoint ─────────────────────────────────────────────────────────────


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


async def seed(tenant, sid, days_ago, statuses, document="d1", status="completed"):
    repo = VerificationRepository()
    created = datetime.now(timezone.utc) - timedelta(days=days_ago, hours=1)
    await repo.create_session(VerificationSessionModel(id=sid, tenant_id=tenant, document_id=document, llm_output="x", status=status,
                                                      overall_score=50.0, risk_level="MEDIUM", created_at=created))
    await repo.save_claims([claim(f"{sid}-{i}", sid, st) for i, st in enumerate(statuses)])


@pytest.mark.asyncio
async def test_overview_covers_only_the_callers_organisation_and_finished_runs(client):
    a, a_headers = await register(client, "a@example.com")
    b, b_headers = await register(client, "b@example.com")
    await DocumentRepository().create_document(DocumentModel(id="d1", tenant_id=a["tenant_id"], filename="annual.pdf", size=1, file_path="x"))
    await seed(a["tenant_id"], "a1", 1, ["SUPPORTED", "CONTRADICTED"])
    await seed(a["tenant_id"], "a-failed", 1, ["CONTRADICTED"], status="failed")  # unfinished runs are not statistics
    await seed(b["tenant_id"], "b1", 1, ["CONTRADICTED", "CONTRADICTED", "CONTRADICTED"])

    mine = (await client.get(f"{V1}/analytics/overview?days=30", headers=a_headers)).json()
    assert mine["totals"]["verifications"] == 1 and mine["totals"]["claims"] == 2 and mine["totals"]["contradicted"] == 1
    assert mine["documents"][0]["document_name"] == "annual.pdf"
    theirs = (await client.get(f"{V1}/analytics/overview?days=30", headers=b_headers)).json()
    assert theirs["totals"]["claims"] == 3


@pytest.mark.asyncio
async def test_overview_window_and_validation(client):
    a, headers = await register(client, "a@example.com")
    await seed(a["tenant_id"], "recent", 2, ["SUPPORTED"])
    await seed(a["tenant_id"], "old", 40, ["CONTRADICTED"])
    week = (await client.get(f"{V1}/analytics/overview?days=7", headers=headers)).json()
    assert week["totals"]["claims"] == 1 and len(week["trend"]) == 7
    quarter = (await client.get(f"{V1}/analytics/overview?days=90", headers=headers)).json()
    assert quarter["totals"]["claims"] == 2
    assert (await client.get(f"{V1}/analytics/overview?days=0", headers=headers)).status_code == 422
    assert (await client.get(f"{V1}/analytics/overview?days=366", headers=headers)).status_code == 422


@pytest.mark.asyncio
async def test_overview_needs_a_signed_in_user(client):
    assert (await client.get(f"{V1}/analytics/overview")).status_code == 401
