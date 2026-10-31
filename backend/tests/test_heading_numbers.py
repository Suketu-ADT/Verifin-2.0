"""Section numbers are headings, not figures; real figures next to them are kept."""

import pytest

from app.services.numeric_grounding import CONFLICT, extract_figures, ground_figures


@pytest.mark.parametrize(
    "text, expected",
    [
        ("Section 4 - Management Discussion and Financial Ratios 4.1 Revenue Revenue rose from USD 412.5 million.", ["USD 412.5 million"]),
        ("See Section 4.2 for detail; NIM of 3.45 improved.", ["3.45"]),
        ("Revenue grew. 4.2 Gross Margin was 56.0%.", ["56.0%"]),
        ("The ratio was 5.2 times and 4.1 points higher.", ["5.2", "4.1"]),
        ("Net profit 46.35 Total assets 470.0 Total", ["46.35", "470.0"]),
    ],
)
def test_heading_numbers_are_not_figures(text, expected):
    assert [f.text for f in extract_figures(text)] == expected


def test_section_number_is_not_offered_as_the_conflicting_figure():
    evidence = [
        "Section 4 - Management Discussion 4.1 Revenue Revenue increased from USD 412.5 million in FY2024 to "
        "USD 486.75 million in FY2025, an increase of USD 74.25 million or 18.0%."
    ]
    result = ground_figures("Revenue grew 22.5% year over year to USD 486.75 million in FY2025.", evidence)
    assert result.status == "CONFLICT"
    assert all("4.1" not in rival for _, rival in result.conflicts)
    assert ("22.5%", "18.0%") in result.conflicts


def test_fact_extraction_fallback_prefers_sentences_with_figures():
    from app.services.llm.financial_extractor import FinancialExtractorService

    raw = [
        {"claim_text": "Annual Financial Report FY2025 Year ended 31 March 2025", "claim_type": "GENERAL"},
        {"claim_text": "Revenue increased to USD 486.75 million in FY2025.", "claim_type": "NUMERICAL"},
    ]
    assert FinancialExtractorService.prefer_figure_claims(raw) == [raw[1]]
    headers_only = [raw[0]]
    assert FinancialExtractorService.prefer_figure_claims(headers_only) == headers_only


def test_fact_sentences_are_whole_figure_sentences_without_page_furniture():
    from app.services.llm.financial_extractor import FinancialExtractorService

    text = (
        "Page 4 of 8 Section 4 - Management Discussion and Financial Ratios 4.1 Revenue Revenue increased from "
        "USD 412.5 million in FY2024 to USD 486.75 million in FY2025, an increase of USD 74.25 million or 18.0%. "
        "Gross margin decreased from 57.0% in FY2024 to 56.0% in FY2025 on higher cloud hosting costs."
    )
    got = [c["claim_text"] for c in FinancialExtractorService.figure_sentences(text)]
    assert got == [
        "Revenue increased from USD 412.5 million in FY2024 to USD 486.75 million in FY2025, an increase of USD 74.25 million or 18.0%.",
        "Gross margin decreased from 57.0% in FY2024 to 56.0% in FY2025 on higher cloud hosting costs.",
    ]


def test_conflict_quotes_the_figure_from_the_matching_sentence():
    evidence = (
        "Revenue increased from USD 412.5 million in FY2024 to USD 486.75 million in FY2025, or 18.0%. "
        "Gross margin decreased because cost of goods sold grew by 20.7%, faster than revenue. "
        "Cloud revenue rose 25.4% in the period."
    )
    result = ground_figures("Revenue grew 22.5% year over year to USD 486.75 million in FY2025.", [evidence])
    assert result.status == CONFLICT
    assert result.conflicts == [("22.5%", "18.0%")]
