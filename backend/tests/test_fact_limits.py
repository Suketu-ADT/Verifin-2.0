"""The caps on "Draft from document" are settings, not constants."""
import pytest
from pydantic import ValidationError

from app.config import Settings, settings
from app.services.llm.financial_extractor import FinancialExtractorService

SENTENCES = " ".join(f"Revenue for segment {i} grew by {10 + i}.5% to USD {100 + i}.0 million in FY2025." for i in range(30))


def test_fallback_extractor_honours_the_configured_limit(monkeypatch):
    monkeypatch.setattr(settings, "fact_fallback_max_claims", 5)
    assert len(FinancialExtractorService.figure_sentences(SENTENCES)) == 5
    monkeypatch.setattr(settings, "fact_fallback_max_claims", 20)
    assert len(FinancialExtractorService.figure_sentences(SENTENCES)) == 20


def test_explicit_limit_overrides_the_setting(monkeypatch):
    monkeypatch.setattr(settings, "fact_fallback_max_claims", 5)
    assert len(FinancialExtractorService.figure_sentences(SENTENCES, limit=3)) == 3


def test_defaults_keep_the_previous_behaviour():
    fresh = Settings(_env_file=None)
    assert (fresh.fact_sample_max_chunks, fresh.fact_sample_max_pages, fresh.fact_max_claims, fresh.fact_fallback_max_claims) == (12, 8, 10, 8)


@pytest.mark.parametrize("name", ["fact_sample_max_chunks", "fact_sample_max_pages", "fact_max_claims", "fact_fallback_max_claims"])
@pytest.mark.parametrize("bad", [0, 201])
def test_limits_are_bounded(name, bad):
    with pytest.raises(ValidationError):
        Settings(_env_file=None, **{name: bad})
