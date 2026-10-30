"""Tests for the evaluation harness (label construction and metric maths)."""

import random

import pytest

from eval import build_dataset as bd
from eval import metrics as M


# ── Label construction ───────────────────────────────────────────────────────

def test_number_change_never_reuses_a_number_found_in_the_report():
    sentence = "Net profit rose 12% to ₹18,951 crore in the year."
    numbers = {12.0, 18951.0}
    for seed in range(40):
        out = bd.perturb_number(sentence, numbers, random.Random(seed))
        assert out is not None and out != sentence
        new_figs = {round(float(t.replace(",", "")), 6) for t in bd.NUM_RE.findall(out)}
        assert new_figs.isdisjoint({12.0}) or "12%" not in out
        # the edited figure must not collide with any number already in the report
        edited = new_figs - {18951.0} if "18,951" in out else new_figs - {12.0}
        assert edited and edited.isdisjoint(numbers)


def test_number_change_ignores_year_like_figures():
    assert bd.perturb_number("Results for 2024 were announced.", set(), random.Random(1)) is None


def test_unit_swap_changes_magnitude_word():
    out = bd.perturb_unit("Revenue was $5 billion for the year.", random.Random(1))
    assert out == "Revenue was $5 million for the year."


def test_unit_swap_skips_ambiguous_sentences():
    assert bd.perturb_unit("Revenue was $5 billion versus $4 million.", random.Random(1)) is None


def test_direction_flip_reverses_single_direction_word():
    assert bd.perturb_direction("Margins increased to 12% this year.") == "Margins decreased to 12% this year."
    assert bd.perturb_direction("Margins increased and revenue fell.") is None


@pytest.mark.parametrize(
    "sentence,expected_fragment",
    [
        ("Profit was ₹10 crore in FY2025, a record.", "FY"),
        ("Revenue for 2024-25 was US$ 5 billion.", "-"),
    ],
)
def test_period_swap_changes_the_period(sentence, expected_fragment):
    out = bd.perturb_period(sentence, random.Random(3))
    assert out and out != sentence and expected_fragment in out


def test_period_swap_skips_sentences_with_several_periods():
    assert bd.perturb_period("Profit rose from 2023 to 2024.", random.Random(1)) is None


def test_paraphrase_validator_requires_identical_numbers_and_polarity():
    orig = "Net profit rose 12% to ₹18,951 crore in FY2025 on strong retail growth."
    assert bd._paraphrase_ok(orig, "Profit after tax climbed 12% to ₹18,951 crore for FY2025 thanks to retail strength.")
    assert not bd._paraphrase_ok(orig, "Profit after tax climbed 15% to ₹18,951 crore for FY2025 thanks to retail strength.")
    assert not bd._paraphrase_ok(orig, "Net profit did not rise 12% to ₹18,951 crore in FY2025 on strong retail growth.")
    assert not bd._paraphrase_ok(orig, orig)  # unchanged text is not a paraphrase


def test_sentence_filter_rejects_table_rows_and_accepts_prose():
    assert bd.is_good_sentence("Total revenue for the year was $45.2 billion, an increase from the previous year.")
    assert not bd.is_good_sentence("12,345 11,200 9,876 8,765 7,654 6,543 5,432 4,321 3,210 2,109 1,098")
    assert not bd.is_good_sentence("See Table 4 for the revenue of $5 billion reported in the annual report page.")


def test_fabricated_names_do_not_appear_in_the_source_text():
    rng = random.Random(5)
    text = "a long annual report about nothing in particular"
    for _ in range(30):
        assert bd.fake_name(rng, text).lower() not in text


def test_split_assignment_is_deterministic_and_page_stable():
    assert bd.split_for("sbi:12") == bd.split_for("sbi:12")
    splits = {bd.split_for(f"doc:{p}") for p in range(200)}
    assert splits == {"dev", "test"}


# ── Metrics ──────────────────────────────────────────────────────────────────

def test_prf_and_macro_f1():
    y_true = ["SUPPORTED", "SUPPORTED", "CONTRADICTED", "CONTRADICTED", "UNVERIFIABLE"]
    y_pred = ["SUPPORTED", "CONTRADICTED", "CONTRADICTED", "CONTRADICTED", "UNVERIFIABLE"]
    report = M.classification_report(y_true, y_pred)
    assert report["accuracy"] == pytest.approx(0.8)
    assert report["per_class"]["CONTRADICTED"]["precision"] == pytest.approx(2 / 3)
    assert report["per_class"]["CONTRADICTED"]["recall"] == pytest.approx(1.0)
    assert report["per_class"]["SUPPORTED"]["recall"] == pytest.approx(0.5)
    assert report["confusion"]["SUPPORTED"]["CONTRADICTED"] == 1


def test_binary_flag_report_counts_hallucinations():
    truth = ["SUPPORTED", "CONTRADICTED", "UNVERIFIABLE", "SUPPORTED"]
    flagged = [False, True, False, True]
    r = M.binary_flag_report(truth, flagged, ("CONTRADICTED", "UNVERIFIABLE"))
    assert (r["tp"], r["fp"], r["fn"], r["tn"]) == (1, 1, 1, 1)
    assert r["recall"] == pytest.approx(0.5)
    assert r["false_positive_rate"] == pytest.approx(0.5)


def test_bootstrap_ci_brackets_the_point_estimate_and_is_reproducible():
    correct = [True] * 70 + [False] * 30
    point, lo, hi = M.accuracy_ci(correct, iterations=500)
    assert point == pytest.approx(0.7)
    assert lo < point < hi
    assert (point, lo, hi) == M.accuracy_ci(correct, iterations=500)


def test_mcnemar_exact_values():
    a = [True] * 10 + [False] * 2
    b = [False] * 10 + [False] * 2
    assert M.mcnemar(a, b)["p_value"] < 0.01
    assert M.mcnemar(a, a)["p_value"] == 1.0


def test_retrieval_metrics_use_only_claims_with_gold_page():
    r = M.retrieval_metrics([5, 9, None], [[1, 5, 7], [2, 3], [4]])
    assert r["n"] == 2
    assert r["recall_at_k"] == pytest.approx(0.5)
    assert r["mrr"] == pytest.approx((1 / 2 + 0) / 2)


def test_ece_is_zero_when_confidence_matches_accuracy():
    conf = [0.9] * 10
    ok = [True] * 9 + [False]
    assert M.expected_calibration_error(conf, ok)["ece"] == pytest.approx(0.0, abs=1e-9)
    assert M.expected_calibration_error([0.99] * 10, [True] * 5 + [False] * 5)["ece"] > 0.4
