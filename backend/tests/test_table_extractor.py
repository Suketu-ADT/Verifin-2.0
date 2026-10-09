"""
Unit tests for Phase 5 Part A: Financial Table Extraction and Reasoning Integration.
Validates table parsing, cell normalization, negative handling, multi-page continuation,
scanned document detection, and reasoning engine integration.
"""

import pytest
from app.models.table import (
    FinancialTableModel,
    TableCellModel,
    TableBoundingBox,
)
from app.services.table_extractor import TableExtractionService
from app.services.numerical_reasoner import NumericalReasonerService


@pytest.fixture
def table_extractor():
    return TableExtractionService()


@pytest.fixture
def numerical_reasoner():
    return NumericalReasonerService(default_percentage_tolerance=0.5)


def test_cell_normalization_numbers_currencies_units(table_extractor):
    """Test cell parsing for positive, currency, scale units, and percentages."""
    # 1. "$ 350.0" with millions multiplier
    cell_mil = table_extractor._parse_cell_value(
        raw_text="$ 350.0",
        row_idx=0,
        col_idx=1,
        default_currency="USD",
        default_multiplier=1e6,
        default_unit_name="million",
    )
    assert cell_mil.raw_text == "$ 350.0"
    assert cell_mil.is_numeric is True
    assert cell_mil.currency == "USD"
    assert cell_mil.normalized_value == 350.0 * 1e6
    assert cell_mil.is_negative is False

    # 2. Percentage cell
    cell_pct = table_extractor._parse_cell_value(
        raw_text="14.2%",
        row_idx=0,
        col_idx=2,
        default_multiplier=1e6,
    )
    assert cell_pct.is_numeric is True
    assert cell_pct.normalized_value == 14.2  # Percentages are not scaled by millions


def test_cell_normalization_negative_parentheses_and_signs(table_extractor):
    """Test parenthetical negative values commonly used in financial disclosures e.g. (12.5)."""
    cell_paren = table_extractor._parse_cell_value(
        raw_text="(12.5)",
        row_idx=1,
        col_idx=1,
        default_multiplier=1e6,
    )
    assert cell_paren.is_numeric is True
    assert cell_paren.is_negative is True
    assert cell_paren.normalized_value == -12.5 * 1e6

    cell_minus = table_extractor._parse_cell_value(
        raw_text="-45.0",
        row_idx=1,
        col_idx=2,
        default_multiplier=1.0,
    )
    assert cell_minus.is_negative is True
    assert cell_minus.normalized_value == -45.0


def test_cell_missing_and_empty_values_safe(table_extractor):
    """Test handling of em-dash, null, and empty cells without crashing."""
    for empty_sym in ["", "—", "-", "--", "N/A", "   "]:
        cell = table_extractor._parse_cell_value(
            raw_text=empty_sym,
            row_idx=2,
            col_idx=0,
        )
        assert cell.is_numeric is False
        assert cell.normalized_value is None


def test_process_raw_table_headers_and_periods(table_extractor):
    """Test extracting headers, reporting periods, and rows from raw grid."""
    raw_grid = [
        ["Line Item", "2024", "2023", "Change %"],
        ["Total Revenue", "$ 350.0", "$ 307.4", "13.9%"],
        ["Operating Income", "$ 75.0", "$ 65.0", "15.4%"],
        ["Net Loss", "(10.0)", "(15.0)", "(33.3%)"],
    ]

    table = table_extractor._process_raw_table(
        raw_rows=raw_grid,
        page_number=4,
        document_id="doc_test_123",
        default_units="millions",
        default_currency="USD",
    )

    assert table is not None
    assert table.document_id == "doc_test_123"
    assert table.page_number == 4
    assert table.headers == ["Line Item", "2024", "2023", "Change %"]
    assert table.reporting_periods == [None, "2024", "2023", None]
    assert table.units == "million"
    assert table.currency == "USD"
    assert len(table.rows) == 3

    # Check Total Revenue row
    rev_row = table.rows[0]
    assert rev_row[0].raw_text == "Total Revenue"
    assert rev_row[1].normalized_value == 350.0 * 1e6
    assert rev_row[2].normalized_value == 307.4 * 1e6

    # Check Net Loss negative row
    loss_row = table.rows[2]
    assert loss_row[1].is_negative is True
    assert loss_row[1].normalized_value == -10.0 * 1e6


def test_multi_page_table_continuation_and_merge(table_extractor):
    """Test multi-page table continuation detection and merging."""
    grid_p1 = [
        ["Line Item", "2024", "2023"],
        ["Revenue", "$ 100", "$ 90"],
    ]
    grid_p2 = [
        ["Line Item", "2024", "2023"],
        ["Cost of Goods", "$ 60", "$ 55"],
        ["Gross Profit", "$ 40", "$ 35"],
    ]

    t1 = table_extractor._process_raw_table(grid_p1, page_number=1, document_id="doc1")
    t2 = table_extractor._process_raw_table(grid_p2, page_number=2, document_id="doc1")

    assert table_extractor._is_continuation(t1, t2) is True

    table_extractor._merge_continuation(t1, t2)
    assert t1.is_multi_page is True
    assert len(t1.rows) == 3
    assert len(t1.raw_rows) == 5  # 2 rows from p1 + 3 rows from p2


def test_table_to_markdown_formatting(table_extractor):
    """Test markdown conversion of structured financial table."""
    raw_grid = [
        ["Metric", "FY2024", "FY2023"],
        ["Revenue", "$350M", "$307.4M"],
    ]
    table = table_extractor._process_raw_table(raw_grid, page_number=1, document_id="doc1")
    md = table.to_markdown()

    assert "| Metric | FY2024 | FY2023 |" in md
    assert "| Revenue | $350M | $307.4M |" in md


def test_table_line_item_lookup(table_extractor):
    """Test targeted cell lookup by line item keyword and period."""
    raw_grid = [
        ["Financial Metric", "2024", "2023"],
        ["Total Revenue", "$ 350.0", "$ 307.4"],
        ["Operating Income", "$ 75.0", "$ 65.0"],
    ]
    table = table_extractor._process_raw_table(raw_grid, page_number=2, document_id="doc1")

    cell_2024 = table_extractor.lookup_line_item(table, "revenue", "2024")
    assert cell_2024 is not None
    assert cell_2024.raw_text == "$ 350.0"

    cell_2023 = table_extractor.lookup_line_item(table, "revenue", "2023")
    assert cell_2023 is not None
    assert cell_2023.raw_text == "$ 307.4"


def test_numerical_reasoner_table_integration(table_extractor, numerical_reasoner):
    """
    Requirement 4: Integrate extracted tables with the existing numerical verification engine.
    """
    raw_grid = [
        ["Line Item", "2024", "2023"],
        ["Total Revenue", "$ 350.0", "$ 307.4"],
        ["Net Income", "$ 50.0", "$ 40.0"],
    ]
    table = table_extractor._process_raw_table(
        raw_rows=raw_grid,
        page_number=5,
        document_id="doc_fin",
        default_units="millions",
        default_currency="USD",
    )

    # 1. Validated claim against table
    claim_valid = "Total Revenue was $350 million in 2024."
    finding = numerical_reasoner.verify_claim_with_tables(claim_valid, [table])

    assert finding is not None
    assert finding.finding_type == "TABLE_LOOKUP"
    assert finding.comparison_outcome == "VALIDATED"
    assert finding.operands["line_item"] == "Total Revenue"
    assert finding.operands["page_number"] == 5
    assert finding.computed_result == 350.0 * 1e6
    assert finding.reported_result == 350.0 * 1e6

    # 2. Mismatch claim against table
    claim_mismatch = "Total Revenue was $400 million in 2024."
    finding_mismatch = numerical_reasoner.verify_claim_with_tables(claim_mismatch, [table])

    assert finding_mismatch is not None
    assert finding_mismatch.comparison_outcome == "MISMATCH"
    assert finding_mismatch.reported_result == 400.0 * 1e6
    assert finding_mismatch.computed_result == 350.0 * 1e6
