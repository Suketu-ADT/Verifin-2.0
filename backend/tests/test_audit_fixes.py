"""
Regression tests for issues found in the project audit.
"""

import asyncio
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.config import settings
from app.database import fallback_db, mongodb
from app.models.chunk import DocumentChunkModel
from app.models.document import DocumentModel
from app.schemas.retrieval import EvidenceChunkResponse
from app.schemas.verification import StartVerificationRequest
from app.services.claim_extractor import ClaimExtractor
from app.services.document_service import DocumentService
from app.services.nli_service import (
    VERDICT_CONTRADICTED,
    VERDICT_SUPPORTED,
    VERDICT_UNVERIFIED,
    NLIService,
)
from app.services.numerical_reasoner import NumericalReasonerService
from app.services.verification_service import VerificationService


# ── Claim extractor: lead-in phrases must not swallow real claims ─────────────

def test_lead_in_sentence_with_figures_is_kept():
    claims = ClaimExtractor().extract_claims(
        "According to the 10-K, revenue rose 12% to $5.2B."
    )
    assert len(claims) == 1
    assert "12%" in claims[0]["claim_text"]
    assert claims[0]["claim_type"] == "numerical"


def test_short_lead_in_with_metric_is_kept():
    claims = ClaimExtractor().extract_claims("Overall, net income fell 5%.")
    assert len(claims) == 1
    assert "5%" in claims[0]["claim_text"]


def test_conversational_filler_is_still_discarded():
    claims = ClaimExtractor().extract_claims(
        "Here is the summary:\nSure, happy to help.\nLet me know if you need more."
    )
    assert claims == []


# ── Verification: flagged claims must not count as supported ──────────────────

def _make_service(llm_numeric_outcome: str):
    doc_repo = AsyncMock()
    doc_repo.get_document_by_id.return_value = DocumentModel(
        id="doc_audit",
        filename="report.pdf",
        file_type="pdf",
        size=1,
        file_path="/tmp/report.pdf",
    )
    verif_repo = AsyncMock()
    retrieval = AsyncMock()
    retrieval.retrieve_evidence.return_value = [
        EvidenceChunkResponse(
            document_id="doc_audit",
            source_filename="report.pdf",
            page_number=3,
            chunk_id="c1",
            chunk_text="Revenue was $350 billion in 2024.",
            retrieval_score=0.9,
        )
    ]
    table_repo = AsyncMock()
    table_repo.get_tables_by_document_id.return_value = []
    chunk_repo = AsyncMock()
    chunk_repo.get_chunks_by_document.return_value = []

    nli = NLIService()
    nli._initialized = True
    nli.predict_probabilities = lambda pairs: [
        {VERDICT_SUPPORTED: 0.98, VERDICT_CONTRADICTED: 0.01, VERDICT_UNVERIFIED: 0.01}
        for _ in pairs
    ]

    reasoner = NumericalReasonerService()
    reasoner.verify_numerical_claim = lambda **kwargs: SimpleNamespace(
        finding_type="PERCENT_CHANGE",
        formula="(a-b)/b",
        operands={},
        computed_result=350.0,
        reported_result=420.0,
        tolerance=0.01,
        comparison_outcome=llm_numeric_outcome,
        explanation="test",
    )

    return VerificationService(
        verification_repo=verif_repo,
        document_repo=doc_repo,
        retrieval_service=retrieval,
        nli_service=nli,
        numerical_reasoner=reasoner,
        table_repo=table_repo,
        chunk_repo=chunk_repo,
    )


@pytest.mark.asyncio
async def test_numerical_mismatch_is_not_counted_as_supported():
    service = _make_service("MISMATCH")
    result = await service.start_verification_session(
        StartVerificationRequest(
            document_id="doc_audit",
            llm_output="Revenue was $420 billion in 2024.",
        )
    )
    claim = result.claims[0]
    assert claim.status == VERDICT_SUPPORTED  # NLI verdict stays decoupled
    assert claim.hallucination_type == "NUMERICAL_DISCREPANCY"
    assert result.overall_score == 0.0
    assert result.risk_level == "HIGH"


@pytest.mark.asyncio
async def test_validated_claim_still_scores_full():
    service = _make_service("VALIDATED")
    result = await service.start_verification_session(
        StartVerificationRequest(
            document_id="doc_audit",
            llm_output="Revenue was $350 billion in 2024.",
        )
    )
    assert result.claims[0].hallucination_type == "NONE"
    assert result.overall_score == 100.0
    assert result.risk_level == "LOW"


def test_verification_service_imports_chunk_model():
    # Regression: the multi-hop fallback referenced DocumentChunkModel without importing it.
    from app.services import verification_service

    assert verification_service.DocumentChunkModel is DocumentChunkModel


# ── Database health ──────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_ping_database_reports_false_when_live_connection_fails(monkeypatch):
    failing_client = MagicMock()
    failing_client.admin.command = AsyncMock(side_effect=RuntimeError("down"))
    monkeypatch.setattr(mongodb.manager, "client", failing_client)
    monkeypatch.setattr(mongodb.manager, "is_fallback", False)

    assert await mongodb.ping_database() is False


@pytest.mark.asyncio
async def test_ping_database_true_when_fallback_active(monkeypatch):
    monkeypatch.setattr(mongodb.manager, "client", None)
    monkeypatch.setattr(mongodb.manager, "is_fallback", True)

    assert await mongodb.ping_database() is True


# ── Fallback store location ──────────────────────────────────────────────────

def test_fallback_store_path_is_anchored_to_project_data_dir():
    assert fallback_db.STORE_FILE == settings.data_dir / "fallback_db_store.json"
    assert fallback_db.STORE_FILE.is_absolute()


def test_fallback_store_save_is_atomic_and_round_trips(tmp_path, monkeypatch):
    store_file = tmp_path / "fallback_db_store.json"
    monkeypatch.setattr(fallback_db, "STORE_FILE", store_file)
    monkeypatch.setattr(fallback_db, "LEGACY_STORE_FILE", tmp_path / "missing.json")

    fallback_db._save_persisted_store({"documents": [{"_id": "a", "name": "x"}]})

    assert not store_file.with_suffix(".json.tmp").exists()
    assert fallback_db._load_persisted_store() == {"documents": [{"_id": "a", "name": "x"}]}


def test_fallback_store_loads_newest_of_current_and_legacy(tmp_path, monkeypatch):
    import json
    import os

    current = tmp_path / "current.json"
    legacy = tmp_path / "legacy.json"
    current.write_text(json.dumps({"documents": [{"_id": "old"}]}), encoding="utf-8")
    legacy.write_text(json.dumps({"documents": [{"_id": "new"}]}), encoding="utf-8")
    os.utime(current, (1_000_000, 1_000_000))
    os.utime(legacy, (2_000_000, 2_000_000))
    monkeypatch.setattr(fallback_db, "STORE_FILE", current)
    monkeypatch.setattr(fallback_db, "LEGACY_STORE_FILE", legacy)

    assert fallback_db._load_persisted_store() == {"documents": [{"_id": "new"}]}


# ── Extract-facts sampling ───────────────────────────────────────────────────

def _chunk(idx: int, text: str) -> DocumentChunkModel:
    return DocumentChunkModel(
        id=f"c{idx}", document_id="d", page_number=idx + 1, chunk_index=idx, text=text
    )


def test_fact_sampling_reaches_beyond_first_pages():
    chunks = [_chunk(i, "Boilerplate legal text without figures.") for i in range(40)]
    chunks[33] = _chunk(33, "Revenue was $350 billion, up 12% year over year.")

    selected = DocumentService._select_fact_chunks(chunks)

    assert len(selected) == DocumentService.FACT_SAMPLE_MAX_CHUNKS
    assert any(c.id == "c33" for c in selected)
    # Returned in document order
    assert [c.chunk_index for c in selected] == sorted(c.chunk_index for c in selected)


def test_fact_sampling_small_document_returns_everything():
    chunks = [_chunk(i, "text") for i in range(3)]
    assert DocumentService._select_fact_chunks(chunks) == chunks


def test_fact_sampling_without_any_signal_falls_back_to_leading_chunks():
    chunks = [_chunk(i, "nothing numeric here") for i in range(30)]
    selected = DocumentService._select_fact_chunks(chunks)
    assert [c.id for c in selected] == [f"c{i}" for i in range(DocumentService.FACT_SAMPLE_MAX_CHUNKS)]
