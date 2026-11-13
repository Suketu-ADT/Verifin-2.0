"""num_ctx and keep_alive reach Ollama through its native API; without them the OpenAI-compatible endpoint is used unchanged."""
import json
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import httpx
import pytest
from pydantic import ValidationError

from app.config import Settings, settings
from app.schemas.llm import LLMClaimExtractionResponse
from app.services.llm.openai_provider import OpenAIProvider

REPLY = json.dumps({"claims": [{"claim_text": "Revenue grew 18.0% to USD 486.75 million in FY2025", "claim_type": "numerical"}]})


def make_provider(monkeypatch, **overrides):
    monkeypatch.setattr(settings, "openai_base_url", "http://localhost:11434/v1")
    monkeypatch.setattr(settings, "openai_api_key", "ollama")
    monkeypatch.setattr(settings, "llm_max_output_tokens", 3072)
    for k, v in overrides.items():
        monkeypatch.setattr(settings, k, v)
    return OpenAIProvider(api_key="ollama", model_name="qwen2.5:3b")


def fake_native(monkeypatch, sent):
    class FakeClient:
        def __init__(self, **kwargs):
            sent["client"] = kwargs

        async def __aenter__(self):
            return self

        async def __aexit__(self, *exc):
            return False

        async def post(self, url, json=None):
            sent["url"], sent["json"] = url, json
            return httpx.Response(200, json={"message": {"content": REPLY}}, request=httpx.Request("POST", url))

    monkeypatch.setattr(httpx, "AsyncClient", FakeClient)


async def test_num_ctx_and_keep_alive_use_the_native_endpoint(monkeypatch):
    sent = {}
    fake_native(monkeypatch, sent)
    provider = make_provider(monkeypatch, ollama_num_ctx=8192, ollama_keep_alive="30m")
    result = await provider.generate_structured("text", LLMClaimExtractionResponse, "system")
    assert result.claims[0].claim_text.startswith("Revenue grew")
    assert sent["url"] == "http://localhost:11434/api/chat"
    assert sent["json"]["keep_alive"] == "30m"
    assert sent["json"]["options"]["num_ctx"] == 8192
    assert sent["json"]["options"]["num_predict"] == 3072  # the setting is honoured, not capped at 1500
    assert sent["json"]["format"] == "json" and sent["json"]["stream"] is False


async def test_only_keep_alive_is_enough(monkeypatch):
    sent = {}
    fake_native(monkeypatch, sent)
    provider = make_provider(monkeypatch, ollama_num_ctx=None, ollama_keep_alive="1h")
    await provider.generate_structured("text", LLMClaimExtractionResponse, None)
    assert "num_ctx" not in sent["json"]["options"] and sent["json"]["keep_alive"] == "1h"


async def test_without_the_settings_the_openai_endpoint_is_used_with_the_full_token_limit(monkeypatch):
    provider = make_provider(monkeypatch, ollama_num_ctx=None, ollama_keep_alive=None)
    create = AsyncMock(return_value=SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content=REPLY))]))
    provider._client = MagicMock()
    provider._client.chat.completions.create = create
    await provider.generate_structured("text", LLMClaimExtractionResponse, None)
    assert create.await_args.kwargs["max_tokens"] == 3072


def test_native_base_strips_the_v1_suffix(monkeypatch):
    make_provider(monkeypatch, ollama_num_ctx=4096, ollama_keep_alive=None)
    assert OpenAIProvider._ollama_native_base() == "http://localhost:11434"
    monkeypatch.setattr(settings, "openai_base_url", "http://gpu-box:11434/")
    assert OpenAIProvider._ollama_native_base() == "http://gpu-box:11434"


def test_defaults_and_bounds():
    fresh = Settings(_env_file=None)
    assert fresh.ollama_num_ctx is None and fresh.ollama_keep_alive is None
    assert Settings(_env_file=None, ollama_num_ctx=8192, ollama_keep_alive="30m").ollama_keep_alive == "30m"
    for bad in ({"ollama_num_ctx": 100}, {"ollama_num_ctx": 999999}, {"ollama_keep_alive": "forever"}):
        with pytest.raises(ValidationError):
            Settings(_env_file=None, **bad)
