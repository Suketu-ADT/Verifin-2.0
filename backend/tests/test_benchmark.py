"""Benchmark: the summary is a faithful reshaping of the recorded reports, and the endpoint serves it to signed-in users only."""

from pathlib import Path

import pytest
from httpx import ASGITransport, AsyncClient

from app.api import benchmark as benchmark_api
from app.config import settings
from app.database import fallback_db, mongodb
from app.main import app
from app.services.benchmark_service import BenchmarkUnavailable, build_summary, load_reports

V1 = "/api/v1"
REAL_RESULTS = Path(__file__).resolve().parents[2] / "data" / "eval" / "results"


def metrics(accuracy, f1, n=10, latency=1.0):
    cm = {"SUPPORTED": {"SUPPORTED": 4, "CONTRADICTED": 1, "UNVERIFIABLE": 0}, "CONTRADICTED": {"SUPPORTED": 0, "CONTRADICTED": 3, "UNVERIFIABLE": 0},
          "UNVERIFIABLE": {"SUPPORTED": 0, "CONTRADICTED": 0, "UNVERIFIABLE": 2}}
    pc = {c: {"precision": 1.0, "recall": 0.5, "f1": 0.6, "support": 5} for c in cm}
    return {"n": n, "accuracy": {"point": accuracy, "ci95": [accuracy - 0.05, accuracy + 0.05]}, "macro_f1": {"point": f1, "ci95": [f1 - 0.05, f1 + 0.05]},
            "per_class": pc, "confusion": cm, "flag_any_unsupported": {"precision": 0.9, "recall": 0.8, "f1": 0.85, "false_positive_rate": 0.1},
            "by_subtype_accuracy": {"CONTRADICTED/number_change": {"n": 6, "accuracy": 0.83}},
            "retrieval": {"n": 10, "recall_at_k": 0.9, "mrr": 0.8},
            "calibration": {"ece": 0.1, "bins": [{"bin": "0.4-0.5", "n": 3, "mean_confidence": 0.45, "accuracy": 0.3}, {"bin": "0.5-0.6", "n": 0, "mean_confidence": 0, "accuracy": 0}]},
            "latency_s": {"mean": latency, "p50": latency, "p95": latency * 2}}


def reports(with_baselines=True):
    final = {"verifin": metrics(0.9, 0.9), "verifin [raw NLI]": metrics(0.7, 0.6), "number_match": metrics(0.8, 0.75)}
    base = {"baselines/llm_rag:qwen2.5:7b": metrics(0.8, 0.8, latency=12.0)} if with_baselines else {}
    return {"final": final, "baselines": base}


def test_systems_come_in_a_fixed_order_and_missing_baselines_are_left_out():
    out = build_summary(reports())
    assert [s["label"] for s in out["systems"]] == ["VERIFIN", "NLI model alone", "Number-match heuristic", "7B language model, with evidence"]
    assert out["systems"][0]["accuracy"] == {"value": 0.9, "low": pytest.approx(0.85), "high": pytest.approx(0.95)}
    assert out["systems"][3]["latency_mean_s"] == 12.0
    assert len(build_summary(reports(with_baselines=False))["systems"]) == 3


def test_the_matrix_rows_follow_the_class_order_and_empty_calibration_bins_are_dropped():
    out = build_summary(reports())
    assert out["classes"] == ["SUPPORTED", "CONTRADICTED", "UNVERIFIABLE"]
    assert out["confusion"] == [[4, 1, 0], [0, 3, 0], [0, 0, 2]]
    assert [b["bin"] for b in out["calibration"]["bins"]] == ["0.4-0.5"]
    assert out["subtypes"] == [{"name": "CONTRADICTED/number_change", "claims": 6, "accuracy": 0.83}]


def test_a_report_without_verifin_is_unavailable_rather_than_misleading():
    broken = reports()
    del broken["final"]["verifin"]
    with pytest.raises(BenchmarkUnavailable):
        build_summary(broken)


def test_unreadable_reports_are_unavailable(tmp_path):
    with pytest.raises(BenchmarkUnavailable):
        load_reports(tmp_path)
    (tmp_path / "final").mkdir()
    (tmp_path / "final" / "report_test.json").write_text("{not json", encoding="utf-8")
    with pytest.raises(BenchmarkUnavailable):
        load_reports(tmp_path)


def test_the_recorded_results_are_internally_consistent():
    """The committed reports: the confusion matrix adds up to the claims and reproduces the accuracy that was recorded."""
    out = build_summary(load_reports(REAL_RESULTS))
    matrix = out["confusion"]
    total = sum(sum(row) for row in matrix)
    assert total == out["claims"] == out["systems"][0]["claims"]
    assert sum(matrix[i][i] for i in range(3)) / total == pytest.approx(out["systems"][0]["accuracy"]["value"])
    assert [s["support"] for s in out["per_class"]] == [sum(row) for row in matrix]
    first, *rest = out["systems"]
    assert first["label"] == "VERIFIN" and all(first["macro_f1"]["value"] > s["macro_f1"]["value"] for s in rest)


# ── The endpoint ─────────────────────────────────────────────────────────────


@pytest.fixture(autouse=True)
def secured_app(monkeypatch):
    monkeypatch.setattr(fallback_db, "_load_persisted_store", lambda: {})
    monkeypatch.setattr(fallback_db, "_save_persisted_store", lambda store: None)
    monkeypatch.setattr(mongodb.manager, "database", fallback_db.FallbackDatabase())
    monkeypatch.setattr(settings, "auth_enabled", True)
    monkeypatch.setattr(settings, "allow_registration", True)
    monkeypatch.setattr(settings, "email_otp_enabled", False)
    monkeypatch.setattr(settings, "jwt_secret", "test-secret-" + "x" * 32)
    monkeypatch.setattr(settings, "rate_limit_enabled", False)


@pytest.fixture
async def client():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c


async def headers_for(client):
    r = await client.post(f"{V1}/auth/register", json={"email": "a@example.com", "password": "correct-horse-battery"})
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


@pytest.mark.asyncio
async def test_the_endpoint_serves_the_summary_to_a_signed_in_user(client, monkeypatch):
    monkeypatch.setattr(benchmark_api, "results_dir", lambda: REAL_RESULTS)
    r = await client.get(f"{V1}/benchmark/summary", headers=await headers_for(client))
    assert r.status_code == 200
    body = r.json()
    assert body["split"] == "test" and body["systems"][0]["label"] == "VERIFIN" and len(body["confusion"]) == 3


@pytest.mark.asyncio
async def test_the_endpoint_says_so_when_the_results_are_not_on_the_server(client, monkeypatch, tmp_path):
    monkeypatch.setattr(benchmark_api, "results_dir", lambda: tmp_path)
    r = await client.get(f"{V1}/benchmark/summary", headers=await headers_for(client))
    assert r.status_code == 404 and "not available" in r.json()["detail"]


@pytest.mark.asyncio
async def test_the_endpoint_needs_a_signed_in_user(client):
    assert (await client.get(f"{V1}/benchmark/summary")).status_code == 401
