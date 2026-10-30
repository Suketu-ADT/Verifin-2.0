"""Regression tests for the structured-table check, found by running a real report through the live pipeline.

Before the fix a true claim such as "Operating income was USD 71,250 thousand in FY2025" came back CONTRADICTED:
the page-level unit detector returned the name "thousand" and the table builder only recognised the text "thousands",
so every table stayed unscaled; and a table with no column for the claimed year was matched by guessing a column.
"""

import pytest

from app.services.numerical_reasoner import NumericalReasonerService
from app.services.table_extractor import TableExtractionService


@pytest.fixture
def extractor():
    return TableExtractionService()


@pytest.fixture
def reasoner():
    return NumericalReasonerService()


def income_statement(extractor, units="thousand"):
    """Shaped like the sample report: footnote marker on a label, a Note column, restated prior year."""
    return extractor._process_raw_table(
        raw_rows=[
            ["Line item", "Note", "FY2024 (restated)", "FY2025"],
            ["Revenue (a)", "3", "412,500", "486,750"],
            ["Operating income", "", "74,250", "71,250"],
            ["Net profit", "", "51,000", "46,350"],
        ],
        page_number=2, document_id="d", default_units=units, default_currency="USD",
    )


@pytest.mark.parametrize("units,multiplier", [("thousand", 1e3), ("thousands", 1e3), ("in thousands", 1e3),
                                              ("million", 1e6), ("millions", 1e6), ("billion", 1e9)])
def test_units_given_as_a_name_or_as_page_text_both_scale_the_table(extractor, units, multiplier):
    table = income_statement(extractor, units)
    cell = table.rows[1][3]
    assert cell.normalized_value == 71_250 * multiplier and table.units in ("thousand", "million", "billion")


def test_unscaled_table_when_no_unit_is_stated(extractor):
    assert income_statement(extractor, None).rows[1][3].normalized_value == 71_250


def test_true_claim_in_thousands_is_validated_not_contradicted(extractor, reasoner):
    finding = reasoner.verify_claim_with_tables("Operating income was USD 71,250 thousand in FY2025.", [income_statement(extractor)])
    assert finding.comparison_outcome == "VALIDATED"
    assert finding.computed_result == finding.reported_result == 71_250_000


def test_wrong_figure_is_still_a_mismatch(extractor, reasoner):
    finding = reasoner.verify_claim_with_tables("Operating income was USD 74,250 thousand in FY2025.", [income_statement(extractor)])
    assert finding.comparison_outcome == "MISMATCH"


def test_line_item_with_footnote_marker_is_matched(extractor, reasoner):
    finding = reasoner.verify_claim_with_tables("Revenue was USD 486,750 thousand in FY2025.", [income_statement(extractor)])
    assert finding is not None and finding.comparison_outcome == "VALIDATED"
    assert finding.operands["line_item"] == "Revenue (a)"


def test_prior_year_figure_is_picked_by_the_period_in_the_claim(extractor, reasoner):
    finding = reasoner.verify_claim_with_tables("Net profit was USD 51,000 thousand in FY2024.", [income_statement(extractor)])
    assert finding.comparison_outcome == "VALIDATED"


def test_figure_stated_to_fewer_decimals_is_accepted_when_it_rounds(extractor, reasoner):
    table = income_statement(extractor)
    assert reasoner.verify_claim_with_tables("Revenue was $487 million in FY2025.", [table]).comparison_outcome == "VALIDATED"
    assert reasoner.verify_claim_with_tables("Revenue was $486.75 million in FY2025.", [table]).comparison_outcome == "VALIDATED"
    assert reasoner.verify_claim_with_tables("Revenue was $490 million in FY2025.", [table]).comparison_outcome == "MISMATCH"


def test_table_without_the_claimed_period_is_not_guessed(extractor, reasoner):
    restatement = extractor._process_raw_table(
        raw_rows=[
            ["FY2024, USD thousands", "As originally reported", "Adjustment", "Restated"],
            ["Revenue", "414,600", "(2,100)", "412,500"],
        ],
        page_number=8, document_id="d", default_units="thousand",
    )
    assert reasoner.verify_claim_with_tables("Revenue was USD 486,750 thousand in FY2025.", [restatement]) is None


def test_claim_with_no_period_against_several_year_columns_is_ambiguous(extractor, reasoner):
    assert reasoner.verify_claim_with_tables("Operating income was USD 71,250 thousand.", [income_statement(extractor)]) is None


def test_percentage_claim_is_not_compared_with_an_amount(extractor, reasoner):
    assert reasoner.verify_claim_with_tables("Revenue grew 18% in FY2025.", [income_statement(extractor)]) is None


def test_a_day_of_the_month_is_not_taken_as_the_claimed_figure(extractor, reasoner):
    finding = reasoner.verify_claim_with_tables("At 31 March 2025 net profit was USD 46,350 thousand in FY2025.", [income_statement(extractor)])
    assert finding is not None and finding.comparison_outcome == "VALIDATED"


def test_unseparated_digits_are_one_number_and_a_fiscal_year_is_not_a_figure(reasoner):
    assert [e.value for e in reasoner.extract_numeric_entities("Revenue grew 18% in FY2025.")] == [18.0]
    assert [e.value for e in reasoner.extract_numeric_entities("Sales were $1250 million and 1,250.5 units.")] == [1250.0, 1250.5]


def expense_table(extractor):
    return extractor._process_raw_table(
        raw_rows=[
            ["Line item", "Note", "FY2024", "FY2025"],
            ["Interest expense", "5", "(6,250)", "(9,450)"],
            ["Cash and cash equivalents", "", "58,400", "46,900"],
        ],
        page_number=2, document_id="d", default_units="thousand",
    )


def test_expense_shown_in_parentheses_matches_a_positive_statement(extractor, reasoner):
    table = expense_table(extractor)
    assert reasoner.verify_claim_with_tables("Interest expense was USD 9.45 million in FY2025.", [table]).comparison_outcome == "VALIDATED"
    assert reasoner.verify_claim_with_tables("Interest expense was USD 6.25 million in FY2025.", [table]).comparison_outcome == "MISMATCH"


def test_claim_with_several_figures_is_left_to_the_other_checks(extractor, reasoner):
    # "fell by 11.5 to 46.9": comparing the first figure with the cash balance would be a false contradiction
    claim = "Cash and cash equivalents decreased by USD 11.5 million to USD 46.9 million in FY2025."
    assert reasoner.verify_claim_with_tables(claim, [expense_table(extractor)]) is None
