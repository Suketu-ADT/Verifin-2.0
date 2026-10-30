"""Sentence splitting and decomposition must not strip a claim of its subject or period."""

from app.services.claim_extractor import ClaimExtractor

extractor = ClaimExtractor()


def _texts(text):
    return [c["claim_text"] for c in extractor.extract_claims(text)]


def test_abbreviation_does_not_end_a_sentence():
    text = "For the three months ended December 31, 2025, both the Firm and JPMorgan Chase Bank, N.A. were compliant with the 100% minimum NSFR requirement."
    assert _texts(text) == [text]


def test_rupee_abbreviation_and_decimals_stay_together():
    text = "The Bank recommends a dividend of Rs. 15.50 per share with a 1:1 bonus issue."
    assert _texts(text) == [text]


def test_following_sentence_still_splits():
    assert len(_texts("Revenue rose 12% to $5 billion. Net income fell 3% to $1 billion.")) == 2


def test_later_part_inherits_the_period_lead_in():
    parts = _texts("In FY25, revenue was $5 billion, and the operating margin rose to 28.5%.")
    assert len(parts) == 2
    assert parts[1].startswith("In FY25,")


def test_part_without_its_own_subject_is_not_split_off():
    text = "Net profit rose 12% to $5 billion in 2024, and achieved a return on equity of 18%."
    assert _texts(text) == [text]
