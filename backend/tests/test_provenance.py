"""Verdict provenance: what is recorded about how a result was produced, and that it is returned with the result."""

from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

import pytest

from app.config import settings
from app.database import fallback_db, mongodb
from app.models.claim import ClaimModel
from app.models.verification import VerificationSessionModel
from app.repositories.verification_repository import VerificationRepository
from app.services.provenance import PIPELINE_VERSION, build_provenance, sha256_text
from app.services.verification_service import VerificationService


def test_provenance_names_models_settings_input_and_timing(monkeypatch):
    monkeypatch.setattr(settings, "disabled_checks", "temporal, neighbours")
    monkeypatch.setattr(settings, "reranker_enabled", False)
    start = datetime(2026, 1, 1, tzinfo=timezone.utc)
    p = build_provenance(
        document=SimpleNamespace(id="d1", filename="r.pdf", sha256="ab" * 32),
        llm_text="Revenue was $5 billion.",
        retrieval_mode=None,
        started_at=start,
        finished_at=start + timedelta(seconds=2.5),
        claim_count=2,
        rule_counts={"figure_conflict": 1, "grounded_support": 1},
    )
    assert p["pipeline_version"] == PIPELINE_VERSION
    assert p["models"]["nli"] == settings.nli_model_name and p["models"]["reranker"] is None
    assert p["policy"]["disabled_checks"] == ["temporal", "neighbours"]
    assert p["input"]["document_sha256"] == "ab" * 32
    assert p["input"]["statement_sha256"] == sha256_text("Revenue was $5 billion.")
    assert p["timing"]["duration_s"] == 2.5
    assert p["outcome"]["decided_by"] == {"figure_conflict": 1, "grounded_support": 1}


def test_provenance_never_contains_the_statement_or_document_text():
    text = "Confidential revenue was $5 billion."
    p = build_provenance(
        document=SimpleNamespace(id="d1", filename="r.pdf", sha256=None), llm_text=text, retrieval_mode="bm25",
        started_at=datetime.now(timezone.utc), finished_at=datetime.now(timezone.utc), claim_count=1, rule_counts={},
    )
    assert "Confidential" not in str(p) and p["retrieval"]["mode"] == "bm25"


@pytest.mark.asyncio
async def test_results_carry_provenance_and_the_deciding_rule(monkeypatch):
    monkeypatch.setattr(fallback_db, "_load_persisted_store", lambda: {})
    monkeypatch.setattr(fallback_db, "_save_persisted_store", lambda store: None)
    monkeypatch.setattr(mongodb.manager, "database", fallback_db.FallbackDatabase())
    repo = VerificationRepository()
    await repo.create_session(VerificationSessionModel(
        id="s1", document_id="d1", llm_output="x", status="completed", provenance={"pipeline_version": "t"},
    ))
    await repo.save_claims([ClaimModel(id="s1_c0", session_id="s1", claim_text="c", claim_type="numerical",
                                       status="CONTRADICTED", decided_by="figure_conflict")])
    result = await VerificationService().get_results("s1")
    assert result.provenance == {"pipeline_version": "t"}
    assert result.claims[0].decided_by == "figure_conflict"
    assert result.created_at is not None
