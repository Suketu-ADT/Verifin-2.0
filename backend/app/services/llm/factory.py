"""
Factory for instantiating configured LLMProvider.
Supports Hugging Face cloud inference as the primary provider,
with extensible support for Gemini, OpenAI, and Mock providers.
"""

from __future__ import annotations

from typing import Optional

from app.config import settings
from app.services.llm.base import LLMProvider
from app.services.llm.gemini_provider import GeminiProvider
from app.services.llm.huggingface_provider import HuggingFaceProvider
from app.services.llm.mock_provider import MockLLMProvider
from app.services.llm.openai_provider import OpenAIProvider
from app.utils.logging import logger

_provider_instance: Optional[LLMProvider] = None


def reset_llm_provider():
    """Resets cached singleton provider (used for test isolation)."""
    global _provider_instance
    _provider_instance = None


def get_llm_provider(force_mock: bool = False) -> LLMProvider:
    """
    Returns configured LLM provider based on LLM_PROVIDER setting.
    Defaults to Hugging Face Inference Providers.
    """
    global _provider_instance
    if force_mock:
        return MockLLMProvider()

    if _provider_instance is not None:
        return _provider_instance

    provider_name = (settings.llm_provider or "huggingface").lower().strip()

    if provider_name == "huggingface":
        hf = HuggingFaceProvider()
        if hf.is_configured:
            logger.info(f"Initialized Hugging Face provider with model '{hf.model_name}' (routing: {hf.provider_routing}).")
        else:
            logger.info("Hugging Face provider initialized in unconfigured state (HF_TOKEN missing).")
        _provider_instance = hf
        return _provider_instance

    elif provider_name == "gemini":
        gemini = GeminiProvider()
        if gemini.is_configured:
            logger.info("Initialized Google Gemini LLM provider.")
        else:
            logger.warning("Gemini provider unconfigured (GEMINI_API_KEY missing).")
        _provider_instance = gemini
        return _provider_instance

    elif provider_name == "openai":
        openai_p = OpenAIProvider()
        if openai_p.is_configured:
            logger.info("Initialized OpenAI LLM provider.")
        else:
            logger.warning("OpenAI provider unconfigured (OPENAI_API_KEY missing).")
        _provider_instance = openai_p
        return _provider_instance

    elif provider_name == "mock":
        _provider_instance = MockLLMProvider()
        return _provider_instance

    logger.warning(f"Unknown LLM provider '{provider_name}'; falling back to MockLLMProvider.")
    _provider_instance = MockLLMProvider()
    return _provider_instance
