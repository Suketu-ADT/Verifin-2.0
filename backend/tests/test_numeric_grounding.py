"""Figure grounding, reporting-period alignment and verdict policy."""

from types import SimpleNamespace

from app.services import numeric_grounding as g
from app.services.nli_service import VERDICT_SUPPORTED, VERDICT_UNVERIFIED, ClaimNLIResult
from app.services.verdict_policy import synthesize_verdict


def _nli(verdict):
    return ClaimNLIResult(
        claim_text="c", claim_type="numerical", verdict=verdict, confidence=0.7,
        risk_level="LOW", risk_score=0.1, explanation="", source_sentence="c",
    )


# ── figures ──────────────────────────────────────────────────────────────────


def test_indian_grouping_and_units_are_parsed():
    figs = g.extract_figures("Revenue was Rs 3,71,085 crore and PAT 1.5 lakh crore.")
    values = sorted(f.normalized for f in figs)
    assert 3_71_085 * 1e7 in values
    assert 1.5e12 in values


def test_same_value_in_different_units_matches():
    claim = g.extract_figures("Turnover of $2.5 billion")[0]
    evidence = g.extract_figures("Turnover was 2,500 million")[0]
    assert g.figures_match(claim, evidence)


def test_percentage_does_not_match_plain_number():
    claim = g.extract_figures("margin of 8%")[0]
    evidence = g.extract_figures("8 crore")[0]
    assert not g.figures_match(claim, evidence)


# ── grounding ────────────────────────────────────────────────────────────────


def test_claim_without_figures_has_no_figure_status():
    assert g.ground_figures("The bank expanded.", ["Revenue was 5 crore."]).status == g.NO_FIGURES


def test_figures_found_in_evidence_are_grounded():
    result = g.ground_figures(
        "EBITDA margin was 8.2% on 20,160 stores.",
        ["EBITDA margin was 8.2%. The company operated 20,160 stores."],
    )
    assert result.status == g.GROUNDED


def test_changed_figure_in_matching_sentence_is_a_conflict():
    result = g.ground_figures(
        "EBITDA amounted to H 18,924 crore in the year.",
        ["EBITDA for the year stood at H 27,034 crore, up on last year. 18,924 stores were opened."],
    )
    assert result.status == g.CONFLICT
    assert result.conflicts


def test_figure_absent_from_evidence_without_comparable_text_is_ungrounded():
    result = g.ground_figures("Dividend was Rs 99 per share.", ["The auditors were appointed in May by the board."])
    assert result.status == g.UNGROUNDED


# ── reporting period ─────────────────────────────────────────────────────────


def test_period_notations_normalise_to_end_year():
    assert g.period_years("FY25 results") == {2025}
    assert g.period_years("for FY 2024-25") == {2025}
    assert g.period_years("As on March 31, 2026") == {2026}
    assert g.period_years("fiscal year 2023") == {2023}
    assert g.period_years("up 70% in 2000") == {2000}


def test_period_is_misaligned_only_when_both_state_years_and_share_none():
    assert g.check_period("Profit in FY24 rose.", "Profit in FY25 rose.").period_match == "MISALIGNED"
    assert g.check_period("Profit in FY25 rose.", "For 2024-25 profit rose.").period_match == "ALIGNED"
    assert g.check_period("Profit rose.", "Profit in FY25 rose.").period_match == "UNSPECIFIED"


# ── verdict policy ───────────────────────────────────────────────────────────


def _grounding(status, overlap=1.0):
    return g.GroundingResult(status=status, anchor_overlap=overlap, explanation="x")


def test_unknown_entity_makes_claim_unverifiable():
    verdict = synthesize_verdict(_nli(VERDICT_SUPPORTED), _grounding(g.NO_FIGURES), ["Zenith Holdings"])
    assert verdict.status == VERDICT_UNVERIFIED
    assert verdict.hallucination_type == "UNSUPPORTED_FABRICATION"
    assert verdict.decided_by == "entity_novelty"


def test_figure_conflict_beats_supportive_nli():
    verdict = synthesize_verdict(_nli(VERDICT_SUPPORTED), _grounding(g.CONFLICT), [])
    assert verdict.status == "CONTRADICTED"
    assert verdict.decided_by == "figure_conflict"


def test_misaligned_period_contradicts():
    temporal = SimpleNamespace(period_match="MISALIGNED", claim_period="2024", evidence_period="2025",
                               explanation="x")
    verdict = synthesize_verdict(_nli(VERDICT_SUPPORTED), _grounding(g.GROUNDED), [], temporal=temporal)
    assert verdict.status == "CONTRADICTED"
    assert verdict.decided_by == "temporal"


def test_grounded_claim_with_supportive_nli_is_supported():
    verdict = synthesize_verdict(_nli(VERDICT_SUPPORTED), _grounding(g.GROUNDED), [])
    assert verdict.status == VERDICT_SUPPORTED


def test_all_figures_in_one_window_ground_the_claim():
    result = g.ground_figures(
        "Net profit rose 12.88% to Rs 80,032 crore from Rs 70,901 crore.",
        ["Net profit increased by 12.88% to Rs 80,032 crore from Rs 70,901 crore in the year. Other items follow."],
    )
    assert result.status == g.GROUNDED


def test_same_number_with_different_unit_is_a_conflict():
    result = g.ground_figures("Revenue was $5 million for the segment.", ["The deposit was $5 billion in total."])
    assert result.status == g.CONFLICT
