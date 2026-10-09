"""
Unit tests for Phase 4 Part A: Numerical and Temporal Reasoning Service.
Validates exact formulas, rounding tolerances, entity extraction,
edge cases (zero division, negative values, missing inputs), and temporal anchoring.
"""

import pytest
from app.services.numerical_reasoner import (
    NumericalReasonerService,
    NumericEntity,
    TemporalPeriod,
)
from app.schemas.verification import StartVerificationRequest
from app.services.verification_service import VerificationService
from unittest.mock import AsyncMock, MagicMock


@pytest.fixture
def reasoner():
    return NumericalReasonerService(default_percentage_tolerance=0.5)


def test_entity_extraction_numbers_currencies_units(reasoner):
    text = "Revenue reached $350 million, up from €307.4 million, representing a 14% increase and -5.2% decline."
    entities = reasoner.extract_numeric_entities(text)

    assert len(entities) >= 4
    # Check $350 million
    e0 = entities[0]
    assert e0.value == 350.0
    assert e0.currency == "USD"
    assert e0.unit_multiplier == 1e6
    assert e0.normalized_value == 350e6

    # Check €307.4 million
    e1 = entities[1]
    assert e1.value == 307.4
    assert e1.currency == "EUR"
    assert e1.unit_multiplier == 1e6

    # Check 14%
    e2 = entities[2]
    assert e2.value == 14.0
    assert e2.is_percentage is True

    # Check -5.2%
    e3 = entities[3]
    assert e3.value == 5.2
    assert e3.is_negative is True
    assert e3.normalized_value == -5.2


def test_known_expected_output_percentage_growth_and_tolerance(reasoner):
    """
    Requirement 8: Known expected output
    (350 - 307.4) / 307.4 * 100 = 13.858165...% (~13.86%),
    reported value of 14%, rounding tolerance +-0.5%.
    """
    claim = "Revenue grew by 14% year-over-year."
    evidence = "Total revenue was $350 million compared to $307.4 million in the prior year."

    finding = reasoner.verify_numerical_claim(claim, evidence)

    assert finding.finding_type == "PERCENTAGE_CHANGE"
    assert finding.formula == "((current - prior) / abs(prior)) * 100"
    assert finding.operands["current"] == 350.0 * 1e6
    assert finding.operands["prior"] == 307.4 * 1e6
    # Computed result is approximately 13.8582
    assert pytest.approx(finding.computed_result, 0.001) == 13.8582
    assert finding.reported_result == 14.0
    assert finding.tolerance == 0.5
    assert finding.comparison_outcome == "VALIDATED"
    assert "13.8582%" in finding.explanation


def test_contradictory_percentage_value_mismatch(reasoner):
    """Reported 25% vs actual ~13.86% is outside tolerance."""
    claim = "Revenue grew by 25% year-over-year."
    evidence = "Total revenue was $350 million compared to $307.4 million in the prior year."

    finding = reasoner.verify_numerical_claim(claim, evidence)

    assert finding.finding_type == "PERCENTAGE_CHANGE"
    assert finding.comparison_outcome == "MISMATCH"
    assert finding.reported_result == 25.0
    assert pytest.approx(finding.computed_result, 0.001) == 13.8582


def test_missing_inputs_insufficient_evidence(reasoner):
    """Claim reports growth but evidence has only 1 base value."""
    claim = "Revenue grew by 14%."
    evidence = "Revenue was $350 million."

    finding = reasoner.verify_numerical_claim(claim, evidence)

    assert finding.finding_type == "PERCENTAGE_CHANGE"
    assert finding.comparison_outcome == "INSUFFICIENT_INPUTS"
    assert "minimum 2 required" in finding.explanation.lower()


def test_division_by_zero_safety(reasoner):
    """When prior period base is zero, percentage growth is undefined."""
    claim = "Operating profit increased by 50%."
    evidence = "Operating profit was $10 million compared to $0 million in the prior period."

    finding = reasoner.verify_numerical_claim(claim, evidence)

    assert finding.finding_type == "PERCENTAGE_CHANGE"
    assert finding.comparison_outcome == "DIVISION_BY_ZERO"
    assert "zero" in finding.explanation.lower()


def test_negative_values_prior_loss(reasoner):
    """Handles negative values (e.g. prior loss) mathematically."""
    claim = "Operating loss improved by 50%."
    evidence = "Operating loss was -$50 million compared to -$100 million in the prior period."

    finding = reasoner.verify_numerical_claim(claim, evidence)

    assert finding.finding_type == "PERCENTAGE_CHANGE"
    assert finding.comparison_outcome == "VALIDATED"
    assert finding.computed_result == 50.0


def test_absolute_difference(reasoner):
    """Calculates absolute difference: current - prior."""
    claim = "Operating profit increased by $42.6 million."
    evidence = "Operating profit was $350.0 million compared to $307.4 million last year."

    finding = reasoner.verify_numerical_claim(claim, evidence)

    assert finding.finding_type == "ABSOLUTE_DIFFERENCE"
    assert finding.formula == "current - prior"
    assert finding.comparison_outcome == "VALIDATED"
    assert pytest.approx(finding.computed_result, 0.01) == 42.6 * 1e6


def test_margin_and_ratio_check(reasoner):
    """Verifies operating margin: profit / revenue * 100."""
    claim = "Operating margin was 20%."
    evidence = "Operating income was $20 million on total revenue of $100 million."

    finding = reasoner.verify_numerical_claim(claim, evidence)

    assert finding.finding_type == "MARGIN_RATIO"
    assert finding.formula == "(numerator / denominator) * 100"
    assert finding.computed_result == 20.0
    assert finding.comparison_outcome == "VALIDATED"


def test_currency_and_unit_inconsistency(reasoner):
    """Detects currency and unit scale mismatches."""
    # 1. Currency mismatch (USD vs EUR)
    claim1 = "Revenue reached $350 million."
    evidence1 = "Revenue reached €350 million."
    finding1 = reasoner.verify_numerical_claim(claim1, evidence1)
    assert finding1.comparison_outcome == "INCONSISTENT_UNITS"
    assert "Currency mismatch" in finding1.explanation

    # 2. Unit scale mismatch (billion vs million)
    claim2 = "Revenue reached $350 billion."
    evidence2 = "Revenue reached $350 million."
    finding2 = reasoner.verify_numerical_claim(claim2, evidence2)
    assert finding2.comparison_outcome == "INCONSISTENT_UNITS"
    assert "Unit scale mismatch" in finding2.explanation


def test_temporal_anchoring_aligned_and_misaligned(reasoner):
    # Aligned FY2024
    anchor_aligned = reasoner.verify_temporal_alignment(
        claim_text="In FY2024, revenue was $350 million.",
        evidence_text="During FY2024, total revenue was $350 million.",
    )
    assert anchor_aligned.period_match == "ALIGNED"
    assert anchor_aligned.claim_period == "FY2024"
    assert anchor_aligned.evidence_period == "FY2024"

    # Misaligned FY2024 vs FY2023
    anchor_misaligned = reasoner.verify_temporal_alignment(
        claim_text="In FY2024, revenue grew 14%.",
        evidence_text="In FY2023, revenue grew 14%.",
    )
    assert anchor_misaligned.period_match == "MISALIGNED"
    assert "Claim specifies 'FY2024' but retrieved evidence refers to 'FY2023'" in anchor_misaligned.explanation


def test_temporal_anchoring_ambiguous_period_safely_unanchored(reasoner):
    """
    Requirement 6: Do not infer a fiscal year when the evidence is insufficient.
    """
    claim = "In FY2024, revenue was $350 million."
    evidence = "During the fiscal year, revenue was $350 million."

    # Without document metadata grounding, must be marked AMBIGUOUS
    anchor = reasoner.verify_temporal_alignment(claim, evidence, doc_metadata=None)
    assert anchor.period_match == "AMBIGUOUS"
    assert "insufficient textual evidence" in anchor.explanation.lower()

    # With document metadata providing explicit FY2024
    anchor_grounded = reasoner.verify_temporal_alignment(
        claim, evidence, doc_metadata={"filename": "Company_10K_FY2024.pdf"}
    )
    assert anchor_grounded.period_match == "ALIGNED"
    assert anchor_grounded.document_period == "FY2024"


@pytest.mark.asyncio
async def test_numerical_mismatch_keeps_nli_verdict_decoupled():
    """
    Requirement 7: Keep numerical/temporal results separate from NLI verdicts.
    A numerical mismatch should produce a distinct finding rather than silently overriding NLI.
    """
    mock_doc_repo = AsyncMock()
    mock_doc = MagicMock()
    mock_doc.filename = "report_2024.pdf"
    mock_doc_repo.get_document_by_id.return_value = mock_doc

    mock_verif_repo = AsyncMock()
    mock_retrieval = AsyncMock()
    mock_retrieval.retrieve_evidence.return_value = []

    mock_nli = MagicMock()
    mock_dp = MagicMock()
    mock_dp.evidence_text = "Total revenue was $350 million compared to $307.4 million."
    mock_dp.page_number = 4
    mock_dp.retrieval_score = 0.88
    mock_dp.p_supported = 0.95
    mock_dp.p_contradicted = 0.03
    mock_dp.p_unverified = 0.02
    mock_dp.verdict = "SUPPORTED"

    mock_nli_res = MagicMock()
    mock_nli_res.claim_text = "Revenue grew by 45%."
    mock_nli_res.claim_type = "numerical"
    mock_nli_res.verdict = "SUPPORTED"
    mock_nli_res.confidence = 0.95
    mock_nli_res.risk_level = "LOW"
    mock_nli_res.source_sentence = "Revenue grew by 45%."
    mock_nli_res.deciding_passage = mock_dp

    mock_nli.evaluate_claim_against_evidence.return_value = mock_nli_res

    mock_extractor = MagicMock()
    mock_extractor.extract_claims.return_value = [{
        "claim_text": "Revenue grew by 45%.",
        "claim_type": "numerical",
        "source_sentence": "Revenue grew by 45%.",
    }]

    svc = VerificationService(
        verification_repo=mock_verif_repo,
        document_repo=mock_doc_repo,
        retrieval_service=mock_retrieval,
        nli_service=mock_nli,
        claim_extractor=mock_extractor,
    )

    req = StartVerificationRequest(
        document_id="doc_123",
        llm_output="Revenue grew by 45%.",
    )
    result = await svc.start_verification_session(req)

    assert len(result.claims) == 1
    c = result.claims[0]
    # NLI verdict remains SUPPORTED
    assert c.status == "SUPPORTED"
    # Numerical finding is distinctly MISMATCH
    assert c.numerical_finding is not None
    assert c.numerical_finding.comparison_outcome == "MISMATCH"
    assert c.numerical_finding.reported_result == 45.0
    assert pytest.approx(c.numerical_finding.computed_result, 0.001) == 13.8582
