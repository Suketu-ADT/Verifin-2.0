"""
LLM integration module for VERIFIN 2.0.
Provides modular cloud inference via Hugging Face Inference Providers,
with extensible support for Gemini, OpenAI, and Mock providers.
"""

from app.services.llm.base import LLMProvider
from app.services.llm.huggingface_provider import HuggingFaceProvider
from app.services.llm.gemini_provider import GeminiProvider
from app.services.llm.openai_provider import OpenAIProvider
from app.services.llm.mock_provider import MockLLMProvider
from app.services.llm.factory import get_llm_provider, reset_llm_provider
from app.services.llm.citation_validator import CitationValidator, CitationValidationResult
from app.services.llm.financial_extractor import FinancialExtractorService
from app.services.llm.explanation_service import GroundedExplanationService
from app.services.llm.exceptions import (
    LLMAuthenticationError,
    LLMError,
    LLMInputLimitExceededError,
    LLMModelNotFoundError,
    LLMProviderError,
    LLMRateLimitError,
    LLMRetryExhaustedError,
    LLMSchemaValidationError,
    LLMTimeoutError,
)

__all__ = [
    "LLMProvider",
    "HuggingFaceProvider",
    "GeminiProvider",
    "OpenAIProvider",
    "MockLLMProvider",
    "get_llm_provider",
    "reset_llm_provider",
    "CitationValidator",
    "CitationValidationResult",
    "FinancialExtractorService",
    "GroundedExplanationService",
    "LLMError",
    "LLMAuthenticationError",
    "LLMModelNotFoundError",
    "LLMProviderError",
    "LLMRateLimitError",
    "LLMTimeoutError",
    "LLMInputLimitExceededError",
    "LLMSchemaValidationError",
    "LLMRetryExhaustedError",
]
