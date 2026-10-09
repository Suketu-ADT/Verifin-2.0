"""
Hugging Face Inference Providers LLM Provider.
Uses cloud-hosted inference via huggingface_hub.AsyncInferenceClient with provider routing.
Enforces Pydantic schema validation, exponential backoff for transient errors,
and strict credential protection.
"""

from __future__ import annotations

import asyncio
import json
import random
import re
from typing import Any, Dict, List, Optional, Type, TypeVar
from pydantic import BaseModel, ValidationError

from app.config import settings
from app.services.llm.base import LLMProvider
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
from app.utils.logging import logger

try:
    from huggingface_hub import AsyncInferenceClient
    from huggingface_hub.errors import (
        HfHubHTTPError,
        RepositoryNotFoundError,
    )
except ImportError:
    AsyncInferenceClient = None  # type: ignore
    HfHubHTTPError = Exception  # type: ignore
    RepositoryNotFoundError = Exception  # type: ignore

T = TypeVar("T", bound=BaseModel)


class HuggingFaceProvider(LLMProvider):
    """
    Hugging Face Inference Providers adapter.
    Dispatches chat completion requests across routed hosted providers (e.g. Together, Groq, Fireworks, HF-Inference).
    """

    DEFAULT_MODEL = "Qwen/Qwen2.5-72B-Instruct"

    def __init__(
        self,
        token: Optional[str] = None,
        model_name: Optional[str] = None,
        provider: Optional[str] = None,
        timeout: Optional[float] = None,
        temperature: Optional[float] = None,
        max_output_tokens: Optional[int] = None,
        max_input_chars: Optional[int] = None,
        max_retries: Optional[int] = None,
        client: Optional[Any] = None,
    ):
        self._token = token or settings.hf_token
        self._model_name = model_name or settings.hf_model or self.DEFAULT_MODEL
        self._provider = provider or settings.hf_provider or "auto"
        self._timeout = timeout or settings.llm_timeout_seconds
        self._temperature = temperature if temperature is not None else settings.llm_temperature
        self._max_output_tokens = max_output_tokens or settings.llm_max_output_tokens
        self._max_input_chars = max_input_chars or settings.llm_max_input_chars
        self._max_retries = max_retries if max_retries is not None else settings.llm_max_retries

        # Client instantiation
        if client is not None:
            self._client = client
        elif AsyncInferenceClient is not None and self._token:
            try:
                self._client = AsyncInferenceClient(
                    token=self._token,
                    provider=self._provider,
                    timeout=self._timeout,
                )
            except Exception as exc:
                logger.warning(f"Failed to initialize Hugging Face client: {exc}")
                self._client = None
        else:
            self._client = None

    @property
    def name(self) -> str:
        return "huggingface"

    @property
    def model_name(self) -> str:
        return self._model_name

    @property
    def provider_routing(self) -> str:
        return self._provider

    @property
    def is_configured(self) -> bool:
        return bool(self._token and len(self._token.strip()) > 0)

    @staticmethod
    def _extract_json_text(text: str) -> str:
        """Strips markdown code blocks and extracts raw JSON string."""
        if not text:
            return ""
        stripped = text.strip()
        # Remove markdown code fences e.g. ```json ... ```
        if "```" in stripped:
            match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", stripped)
            if match:
                return match.group(1).strip()
        return stripped

    def _normalize_hf_exception(self, exc: Exception) -> LLMError:
        """Normalizes external exceptions into safe internal LLMError instances."""
        if isinstance(exc, LLMError):
            return exc

        err_msg = str(exc)
        status_code = getattr(exc, "status_code", None)
        if hasattr(exc, "response") and getattr(exc.response, "status_code", None):
            status_code = exc.response.status_code

        # Check for authentication / permission failures
        if status_code in (401, 403) or "unauthorized" in err_msg.lower() or "token" in err_msg.lower():
            return LLMAuthenticationError(
                "Hugging Face authentication failed. Please verify that HF_TOKEN is valid and has inference permissions.",
                provider=self.name,
                status_code=status_code,
            )

        # Check for model not found / repository not found
        if status_code == 404 or "not found" in err_msg.lower() or isinstance(exc, RepositoryNotFoundError):
            return LLMModelNotFoundError(
                f"Model '{self._model_name}' was not found or is unavailable under provider '{self._provider}'.",
                provider=self.name,
                status_code=status_code,
            )

        # Check for rate limiting
        if status_code == 429 or "rate limit" in err_msg.lower():
            return LLMRateLimitError(
                "Hugging Face Inference Provider rate limit exceeded.",
                provider=self.name,
                status_code=status_code,
            )

        # Check for timeout
        if isinstance(exc, asyncio.TimeoutError) or "timed out" in err_msg.lower():
            return LLMTimeoutError(
                f"Request to Hugging Face timed out after {self._timeout} seconds.",
                provider=self.name,
                status_code=status_code,
            )

        return LLMProviderError(
            f"Hugging Face Inference Provider error: {err_msg}",
            provider=self.name,
            status_code=status_code,
        )

    def _is_transient_error(self, err: LLMError) -> bool:
        """Determines if error is eligible for retry."""
        if isinstance(err, (LLMRateLimitError, LLMTimeoutError)):
            return True
        if isinstance(err, LLMProviderError) and err.status_code in (500, 502, 503, 504):
            return True
        return False

    async def generate_structured(
        self,
        prompt: str,
        response_model: Type[T],
        system_instruction: Optional[str] = None,
    ) -> T:
        """
        Executes structured chat completion via Hugging Face Inference Providers.
        Validates response against Pydantic model with bounded exponential retries.
        """
        if not self.is_configured:
            raise LLMAuthenticationError(
                "Hugging Face provider is not configured. Please set HF_TOKEN environment variable.",
                provider=self.name,
            )

        # 1. Enforce input character limits
        total_chars = len(prompt) + len(system_instruction or "")
        if total_chars > self._max_input_chars:
            raise LLMInputLimitExceededError(
                f"Input text length ({total_chars} chars) exceeds maximum allowed limit of {self._max_input_chars} chars.",
                provider=self.name,
            )

        # 2. Build system prompt instructing JSON schema compliance
        schema_json = json.dumps(response_model.model_json_schema(), indent=2)
        sys_prompt = (
            (system_instruction or "You are a financial information extraction specialist.")
            + "\n\nCRITICAL INSTRUCTION: You MUST output strictly valid JSON conforming to this exact JSON schema:\n"
            + schema_json
            + "\nDo NOT wrap output in conversational text. Return ONLY the JSON object."
        )

        messages = [
            {"role": "system", "content": sys_prompt},
            {"role": "user", "content": prompt},
        ]

        # 3. Request parameters
        request_kwargs: Dict[str, Any] = {
            "model": self._model_name,
            "messages": messages,
            "max_tokens": self._max_output_tokens,
            "temperature": self._temperature,
            "response_format": {"type": "json_object"},
        }

        # 4. Execute request with bounded exponential backoff
        attempts = 0
        last_error: Optional[LLMError] = None

        while attempts <= self._max_retries:
            attempts += 1
            try:
                # Ensure client is instantiated
                if self._client is None:
                    if AsyncInferenceClient is None:
                        raise LLMProviderError("huggingface_hub package is not installed.", provider=self.name)
                    self._client = AsyncInferenceClient(
                        token=self._token,
                        provider=self._provider,
                        timeout=self._timeout,
                    )

                response = await self._client.chat_completion(**request_kwargs)

                if not response or not response.choices:
                    raise LLMSchemaValidationError("Hugging Face returned empty choices list.", provider=self.name)

                raw_content = response.choices[0].message.content or ""
                clean_json_str = self._extract_json_text(raw_content)

                if not clean_json_str:
                    raise LLMSchemaValidationError("Hugging Face returned empty message content.", provider=self.name)

                # Validate against target Pydantic schema
                try:
                    return response_model.model_validate_json(clean_json_str)
                except (ValidationError, json.JSONDecodeError) as val_err:
                    logger.warning(f"Response failed Pydantic validation: {val_err}")
                    raise LLMSchemaValidationError(
                        f"Response failed schema validation: {val_err}",
                        provider=self.name,
                    ) from val_err

            except Exception as exc:
                normalized_err = self._normalize_hf_exception(exc)
                last_error = normalized_err

                # Fail fast on non-transient errors (auth, model not found, schema, input limit)
                if not self._is_transient_error(normalized_err) or attempts > self._max_retries:
                    raise normalized_err

                # Transient error: compute exponential backoff with jitter
                delay = (2 ** (attempts - 1)) * 0.5 + random.uniform(0.0, 0.4)
                logger.warning(
                    f"Transient Hugging Face error ({normalized_err}); retrying in {delay:.2f}s "
                    f"(attempt {attempts}/{self._max_retries + 1})..."
                )
                await asyncio.sleep(delay)

        if last_error:
            raise LLMRetryExhaustedError(
                f"Retries exhausted after {self._max_retries} attempts. Last error: {last_error}",
                provider=self.name,
            )
        raise LLMProviderError("Unknown generation failure.", provider=self.name)

    async def health_check(self) -> Dict[str, Any]:
        """
        Returns safe configuration status without exposing credentials or executing expensive inference.
        """
        if AsyncInferenceClient is None:
            return {
                "status": "unavailable",
                "provider": self.name,
                "error": "huggingface_hub package is not installed",
            }

        if not self._token:
            return {
                "status": "unconfigured",
                "provider": self.name,
                "model": self._model_name,
                "hf_provider": self._provider,
                "message": "HF_TOKEN environment variable is not set",
            }

        return {
            "status": "ready",
            "provider": self.name,
            "model": self._model_name,
            "hf_provider": self._provider,
            "token_configured": True,
            "temperature": self._temperature,
            "timeout_seconds": self._timeout,
            "max_output_tokens": self._max_output_tokens,
            "max_input_chars": self._max_input_chars,
        }

    async def test_readiness(self) -> Dict[str, Any]:
        """
        Performs a bounded live readiness probe when explicitly requested.
        """
        if not self.is_configured:
            return await self.health_check()

        try:
            # Minimal bounded probe
            test_resp = await self._client.chat_completion(
                model=self._model_name,
                messages=[{"role": "user", "content": "ping"}],
                max_tokens=5,
            )
            return {
                "status": "operational",
                "provider": self.name,
                "model": self._model_name,
                "hf_provider": self._provider,
                "live_probe": "passed",
            }
        except Exception as exc:
            norm = self._normalize_hf_exception(exc)
            return {
                "status": "error",
                "provider": self.name,
                "model": self._model_name,
                "hf_provider": self._provider,
                "error": norm.message,
            }
