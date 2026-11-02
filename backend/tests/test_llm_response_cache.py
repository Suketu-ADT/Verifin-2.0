"""The LLM response cache: same request, same answer from disk; any change to the request is a miss."""

import asyncio
import os
import time

from app.config import settings
from app.schemas.llm import LLMClaimExtractionResponse, LLMExtractedClaim
from app.services.llm import response_cache
from app.services.llm.base import LLMProvider
from app.services.llm.financial_extractor import FinancialExtractorService
from app.services.llm.response_cache import ResponseCache


def test_key_changes_with_every_part_of_the_request():
    base = ResponseCache.make_key("hf", "m", "sys", "prompt", "S")
    assert base == ResponseCache.make_key("hf", "m", "sys", "prompt", "S")
    for other in (("x", "m", "sys", "prompt", "S"), ("hf", "x", "sys", "prompt", "S"), ("hf", "m", "x", "prompt", "S"),
                  ("hf", "m", "sys", "x", "S"), ("hf", "m", "sys", "prompt", "x")):
        assert ResponseCache.make_key(*other) != base
    assert ResponseCache.make_key("ab", "c", None, "p", "S") != ResponseCache.make_key("a", "bc", None, "p", "S")


def test_put_get_round_trip_and_miss(tmp_path):
    cache = ResponseCache(tmp_path)
    assert cache.get("k") is None
    cache.put("k", '{"a": 1}')
    assert cache.get("k") == '{"a": 1}'
    assert cache.stats() == {"enabled": True, "hits": 1, "misses": 1}


def test_entries_expire_after_the_time_limit(tmp_path):
    cache = ResponseCache(tmp_path, ttl_seconds=10)
    cache.put("k", "v")
    old = time.time() - 60
    os.utime(tmp_path / "k.json", (old, old))
    assert cache.get("k") is None
    assert not (tmp_path / "k.json").exists()


def test_oldest_entries_are_removed_past_the_count_limit(tmp_path):
    cache = ResponseCache(tmp_path, max_entries=3)
    for i in range(5):
        cache.put(f"k{i}", "v")
        stamp = time.time() - (10 - i)
        os.utime(tmp_path / f"k{i}.json", (stamp, stamp))
    assert sorted(p.stem for p in tmp_path.glob("*.json")) == ["k2", "k3", "k4"]


def test_an_unwritable_directory_switches_the_cache_off(tmp_path):
    blocker = tmp_path / "file"
    blocker.write_text("x")
    cache = ResponseCache(blocker / "sub")
    assert cache.enabled is False
    cache.put("k", "v")
    assert cache.get("k") is None


class _CountingProvider(LLMProvider):
    """A configured provider (not the mock, which bypasses the cache) that counts calls."""

    def __init__(self, model="m1"):
        self.calls = 0
        self._model = model

    name = property(lambda self: "counting")
    model_name = property(lambda self: self._model)
    is_configured = property(lambda self: True)

    async def generate_structured(self, prompt, response_model, system_instruction=None):
        self.calls += 1
        return LLMClaimExtractionResponse(claims=[LLMExtractedClaim(claim_text="Revenue was USD 486.75 million in FY2025.")])

    async def health_check(self):
        return {}


def _extract(provider, text):
    return asyncio.run(FinancialExtractorService(llm_provider=provider).extract_claims(text=text, document_id="d"))


def test_repeat_extraction_is_answered_from_the_cache(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "llm_cache_dir", str(tmp_path))
    monkeypatch.setattr(response_cache, "_instance", None)
    text = "Revenue was USD 486.75 million in FY2025."
    provider = _CountingProvider()
    first = _extract(provider, text)
    second = _extract(provider, text)
    assert provider.calls == 1
    assert [c.claim_text for c in first] == [c.claim_text for c in second] == ["Revenue was USD 486.75 million in FY2025."]
    assert second[0].claim_id == "d_claim_1"  # ids and grounding are applied after the cache, not stored in it
    # a different model or a different document is a miss
    _extract(_CountingProvider(model="m2"), text)
    _extract(provider, text + " Net profit was USD 46.35 million.")
    assert provider.calls == 2


def test_cache_can_be_switched_off(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "llm_cache_dir", str(tmp_path))
    monkeypatch.setattr(settings, "llm_cache_enabled", False)
    monkeypatch.setattr(response_cache, "_instance", None)
    provider = _CountingProvider()
    _extract(provider, "Revenue was USD 486.75 million in FY2025.")
    _extract(provider, "Revenue was USD 486.75 million in FY2025.")
    assert provider.calls == 2
    assert not list(tmp_path.glob("*.json"))
