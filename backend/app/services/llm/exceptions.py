"""
Normalized exceptions for modular LLM providers.
Provides structured, safe error representations without exposing tokens or internal authorization headers.
"""

from __future__ import annotations

from typing import Optional


class LLMError(Exception):
    """Base exception for all LLM provider errors."""

    def __init__(self, message: str, provider: str = "unknown", status_code: Optional[int] = None):
        super().__init__(message)
        self.message = message
        self.provider = provider
        self.status_code = status_code

    def __str__(self) -> str:
        code_str = f" [HTTP {self.status_code}]" if self.status_code else ""
        return f"[{self.provider.upper()}{code_str}] {self.message}"


class LLMAuthenticationError(LLMError):
    """Raised when authentication credentials (e.g. HF_TOKEN) are missing, invalid, or expired."""
    pass


class LLMModelNotFoundError(LLMError):
    """Raised when the specified model is not found, private, or not hosted on the inference provider."""
    pass


class LLMRateLimitError(LLMError):
    """Raised when the provider rate limit is exceeded (transient error suitable for retry)."""
    pass


class LLMTimeoutError(LLMError):
    """Raised when request duration exceeds configured timeout (transient error)."""
    pass


class LLMInputLimitExceededError(LLMError):
    """Raised when input text length exceeds configured LLM_MAX_INPUT_CHARS."""
    pass


class LLMSchemaValidationError(LLMError):
    """Raised when provider response fails Pydantic schema validation or output is malformed JSON."""
    pass


class LLMProviderError(LLMError):
    """Raised when provider encounters internal or 5xx inference errors."""
    pass


class LLMRetryExhaustedError(LLMError):
    """Raised when transient retries with exponential backoff have been exhausted."""
    pass
