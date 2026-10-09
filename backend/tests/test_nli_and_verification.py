"""
Unit and integration tests for Phase 3: Cross-Encoder NLI Classification & Verification Engine.
"""

from unittest.mock import AsyncMock, MagicMock, patch
import pytest

from app.models.document import DocumentModel
from app.models.verification import VerificationSessionModel
from app.schemas.retrieval import EvidenceChunkResponse
from app.schemas.verification import StartVerificationRequest
from app.services.claim_extractor import ClaimExtractor
from app.services.nli_service import (
    LABEL_CONTRADICTION,
    LABEL_ENTAILMENT,
    LABEL_NEUTRAL,
    VERDICT_CONTRADICTED,
    VERDICT_SUPPORTED,
    VERDICT_UNVERIFIED,
    NLIService,
)
from app.services.verification_service import VerificationService


# ── Label Mapping & Probability Normalization Tests ─────────────────────────

def test_nli_label_mapping_constants():
    """Verify exact index constants match the cross-encoder/nli-deberta-v3-small architecture."""
    # Verified id2label: {0: 'contradiction', 1: 'entailment', 2: 'neutral'}
    assert LABEL_CONTRADICTION == 0
    assert LABEL_ENTAILMENT == 1
    assert LABEL_NEUTRAL == 2


def test_nli_predict_probabilities_mocked():
    """Verify that raw logits/softmax outputs correctly map to verdict classes."""
    service = NLIService()
    service._initialized = True
    mock_model = MagicMock()

    # Raw model output: [contradiction, entailment, neutral]
    # Sample 1: Strong entailment
    # Sample 2: Strong contradiction
    # Sample 3: Strong neutral
    mock_model.predict.return_value = [
        [0.001, 0.998, 0.001],
        [0.985, 0.005, 0.010],
        [0.020, 0.030, 0.950],
    ]
    service._model = mock_model

    pairs = [("evidence 1", "claim 1"), ("evidence 2", "claim 2"), ("evidence 3", "claim 3")]
    results = service.predict_probabilities(pairs)

    assert len(results) == 3

    # Sample 1
    assert results[0][VERDICT_SUPPORTED] == pytest.approx(0.998, 0.001)
    assert results[0][VERDICT_CONTRADICTED] == pytest.approx(0.001, 0.001)
    assert results[0][VERDICT_UNVERIFIED] == pytest.approx(0.001, 0.001)

    # Sample 2
    assert results[1][VERDICT_CONTRADICTED] == pytest.approx(0.985, 0.001)

    # Sample 3
    assert results[2][VERDICT_UNVERIFIED] == pytest.approx(0.950, 0.001)


def test_nli_premise_hypothesis_ordering():
    """Verify that pair ordering passed to CrossEncoder is strictly (Premise, Hypothesis)."""
    service = NLIService()
    service._initialized = True
    mock_model = MagicMock()
    mock_model.predict.return_value = [[0.01, 0.98, 0.01]]
    service._model = mock_model

    evidence = [
        EvidenceChunkResponse(
            document_id="doc_1",
            source_filename="10k.pdf",
            page_number=14,
            chunk_id="c_1",
            chunk_text="In 2024 Alphabet revenue was 350 billion dollars.",
            retrieval_score=0.91,
        )
    ]

    service.evaluate_claim_against_evidence(
        claim_text="Alphabet had 350 billion in revenue.",
        evidence_chunks=evidence,
    )

    # Verify call args
    mock_model.predict.assert_called_once()
    called_pairs = mock_model.predict.call_args[0][0]
    assert len(called_pairs) == 1
    # First item must be Premise (evidence passage)
    assert called_pairs[0][0] == "In 2024 Alphabet revenue was 350 billion dollars."
    # Second item must be Hypothesis (claim)
    assert called_pairs[0][1] == "Alphabet had 350 billion in revenue."


# ── Verdict Class Evaluation Tests ───────────────────────────────────────────

def test_evaluate_claim_supported():
    service = NLIService()
    service._initialized = True
    mock_model = MagicMock()
    # High entailment at index 1
    mock_model.predict.return_value = [[0.001, 0.995, 0.004]]
    service._model = mock_model

    evidence = [
        EvidenceChunkResponse(
            document_id="doc_1",
            source_filename="report.pdf",
            page_number=10,
            chunk_id="c_1",
            chunk_text="Net income was $75 billion.",
            retrieval_score=0.90,
        )
    ]

    res = service.evaluate_claim_against_evidence("Net income reached $75B.", evidence)
    assert res.verdict == VERDICT_SUPPORTED
    assert res.confidence == pytest.approx(0.995, 0.001)
    assert res.risk_level == "LOW"
    assert res.risk_score < 0.20


def test_evaluate_claim_contradicted():
    service = NLIService()
    service._initialized = True
    mock_model = MagicMock()
    # High contradiction at index 0
    mock_model.predict.return_value = [[0.982, 0.003, 0.015]]
    service._model = mock_model

    evidence = [
        EvidenceChunkResponse(
            document_id="doc_1",
            source_filename="report.pdf",
            page_number=10,
            chunk_id="c_1",
            chunk_text="Net income was $75 billion.",
            retrieval_score=0.90,
        )
    ]

    res = service.evaluate_claim_against_evidence("Net income fell to $10 billion.", evidence)
    assert res.verdict == VERDICT_CONTRADICTED
    assert res.confidence == pytest.approx(0.982, 0.001)
    assert res.risk_level == "HIGH"
    assert res.risk_score >= 0.70


def test_evaluate_claim_unverified_neutral():
    service = NLIService()
    service._initialized = True
    mock_model = MagicMock()
    # High neutral at index 2
    mock_model.predict.return_value = [[0.05, 0.05, 0.90]]
    service._model = mock_model

    evidence = [
        EvidenceChunkResponse(
            document_id="doc_1",
            source_filename="report.pdf",
            page_number=10,
            chunk_id="c_1",
            chunk_text="Operating cash flow was positive.",
            retrieval_score=0.75,
        )
    ]

    res = service.evaluate_claim_against_evidence("CEO visited a supplier in Brazil.", evidence)
    assert res.verdict == VERDICT_UNVERIFIED
    assert res.risk_level == "MEDIUM"
    # Never present neutral as contradiction!
    assert res.risk_score == 0.50


# ── Conflicting & Empty Evidence Tests ────────────────────────────────────────

def test_conflicting_evidence_aggregation():
    """Verify that when one passage contradicts and another supports, contradiction is prioritized."""
    service = NLIService()
    service._initialized = True
    mock_model = MagicMock()
    # Passage 1: supports (0.80 entailment)
    # Passage 2: contradicts (0.92 contradiction)
    mock_model.predict.return_value = [
        [0.10, 0.80, 0.10],
        [0.92, 0.04, 0.04],
    ]
    service._model = mock_model

    evidence = [
        EvidenceChunkResponse(
            document_id="doc_1",
            source_filename="report.pdf",
            page_number=5,
            chunk_id="c_5",
            chunk_text="Preliminary numbers showed growth.",
            retrieval_score=0.88,
        ),
        EvidenceChunkResponse(
            document_id="doc_1",
            source_filename="report.pdf",
            page_number=22,
            chunk_id="c_22",
            chunk_text="Final audited statements reported a net decline.",
            retrieval_score=0.85,
        ),
    ]

    res = service.evaluate_claim_against_evidence("Final statements showed net growth.", evidence)
    assert res.verdict == VERDICT_CONTRADICTED
    assert res.risk_level == "HIGH"
    assert res.deciding_passage.chunk_id == "c_22"


def test_empty_evidence_handling():
    """Verify that claims with zero retrieved evidence chunks produce UNVERIFIED without crashing."""
    service = NLIService()
    res = service.evaluate_claim_against_evidence("Any financial claim", [])
    assert res.verdict == VERDICT_UNVERIFIED
    assert res.confidence == 0.0
    assert res.risk_level == "MEDIUM"
    assert res.deciding_passage is None


def test_failed_model_loading_reporting():
    """Verify that model loading failures report unavailable status and raise clean errors."""
    service = NLIService(model_name="non_existent_model_id_xyz")
    with patch("app.services.nli_service.CrossEncoder", side_effect=Exception("Model not found")):
        assert not service.is_healthy()
        assert service.status == "unavailable"
        with pytest.raises(RuntimeError, match="Failed to load NLI model|unavailable"):
            service.predict_probabilities([("premise", "hypothesis")])


# ── Claim Extractor Tests ────────────────────────────────────────────────────

def test_claim_extractor():
    extractor = ClaimExtractor()
    llm_output = (
        "Here is the summary of the quarterly report:\n"
        "- Alphabet reported consolidated revenues of $350.0 billion in 2024.\n"
        "- Operating income rose by 15.2% year-over-year.\n"
        "The company remains confident in its cloud strategy."
    )
    claims = extractor.extract_claims(llm_output)
    assert len(claims) == 3

    assert "350.0 billion" in claims[0]["claim_text"]
    assert claims[0]["claim_type"] == "numerical"

    assert "15.2%" in claims[1]["claim_text"]
    assert claims[1]["claim_type"] == "numerical"

    assert "cloud strategy" in claims[2]["claim_text"]
    assert claims[2]["claim_type"] == "factual"


# ── Verification Service Workflow Test (Mocked) ──────────────────────────────

@pytest.mark.asyncio
async def test_verification_service_full_session_flow():
    mock_doc_repo = AsyncMock()
    mock_doc = DocumentModel(
        id="doc_test_123",
        filename="Alphabet_10K.pdf",
        file_type="pdf",
        size=4096,
        file_path="/tmp/10k.pdf",
    )
    mock_doc_repo.get_document_by_id.return_value = mock_doc

    mock_verif_repo = AsyncMock()
    mock_verif_repo.create_session.side_effect = lambda s: s
    mock_verif_repo.save_claims.side_effect = lambda c: c

    mock_retrieval_svc = AsyncMock()
    mock_retrieval_svc.retrieve_evidence.return_value = [
        EvidenceChunkResponse(
            document_id="doc_test_123",
            source_filename="Alphabet_10K.pdf",
            page_number=14,
            chunk_id="c_1",
            chunk_text="In fiscal year 2024 Alphabet reported revenue of $350 billion.",
            retrieval_score=0.92,
        )
    ]

    mock_nli_svc = MagicMock()
    mock_nli_svc.is_healthy.return_value = True
    # Mock predict probabilities: entailment high
    mock_nli_svc.predict_probabilities.return_value = [{
        VERDICT_SUPPORTED: 0.99,
        VERDICT_CONTRADICTED: 0.005,
        VERDICT_UNVERIFIED: 0.005,
    }]
    # Use real evaluate_claim_against_evidence with mocked predict_probabilities
    real_nli = NLIService()
    real_nli._initialized = True
    real_nli.predict_probabilities = mock_nli_svc.predict_probabilities

    service = VerificationService(
        verification_repo=mock_verif_repo,
        document_repo=mock_doc_repo,
        retrieval_service=mock_retrieval_svc,
        nli_service=real_nli,
    )

    req = StartVerificationRequest(
        document_id="doc_test_123",
        llm_output="Alphabet reported revenue of $350 billion in 2024.",
    )

    result = await service.start_verification_session(req)

    assert result.status == "completed"
    assert result.overall_score == 100.0
    assert result.risk_level == "LOW"
    assert len(result.claims) == 1
    assert result.claims[0].status == VERDICT_SUPPORTED
    assert result.claims[0].evidence is not None
    assert result.claims[0].evidence.page_number == 14
    assert result.claims[0].nli.label == VERDICT_SUPPORTED
