"""
Google Gemini LLM provider implementation using google-genai SDK.
Supports structured outputs with Pydantic schemas.
"""

from __future__ import annotations

import json
from typing import Any, Dict, Optional, Type, TypeVar
from pydantic import BaseModel, ValidationError

from app.config import settings
from app.services.llm.base import LLMProvider
from app.utils.logging import logger

try:
    from google import genai
    from google.genai import types
except ImportError:
    genai = None  # type: ignore
    types = None  # type: ignore

T = TypeVar("T", bound=BaseModel)


class GeminiProvider(LLMProvider):
    """Google Gemini LLM provider."""

    DEFAULT_MODEL = "gemini-2.0-flash"

    def __init__(
        self,
        api_key: Optional[str] = None,
        model_name: Optional[str] = None,
    ):
        self._api_key = api_key or settings.gemini_api_key
        self._model_name = model_name or settings.llm_model or self.DEFAULT_MODEL
        self._client = None
        if genai is not None and self._api_key:
            try:
                self._client = genai.Client(api_key=self._api_key)
            except Exception as exc:
                logger.warning(f"Failed to initialize Gemini client: {exc}")

    @property
    def name(self) -> str:
        return "gemini"

    @property
    def model_name(self) -> str:
        return self._model_name

    @property
    def is_configured(self) -> bool:
        return bool(self._client is not None and self._api_key)

    async def generate_structured(
        self,
        prompt: str,
        response_model: Type[T],
        system_instruction: Optional[str] = None,
    ) -> T:
        """
        Invokes Gemini with structured JSON output and validates against Pydantic schema.
        """
        if not self.is_configured:
            raise ConnectionError(
                "Gemini provider is not configured. Please set GEMINI_API_KEY environment variable."
            )

        try:
            config = types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=response_model,
                temperature=settings.llm_temperature,
                max_output_tokens=settings.llm_max_output_tokens,
                system_instruction=system_instruction,
            )

            # google-genai async or sync call via client.models
            response = self._client.models.generate_content(
                model=self._model_name,
                contents=prompt,
                config=config,
            )

            if not response or not response.text:
                raise ValueError("Gemini returned empty response text.")

            # Validate structured output against target model
            return response_model.model_validate_json(response.text)

        except ValidationError as val_err:
            logger.error(f"Gemini response failed Pydantic validation: {val_err}")
            raise ValueError(f"Malformed LLM structured response: {val_err}") from val_err
        except Exception as exc:
            logger.error(f"Gemini generation error: {exc}")
            raise RuntimeError(f"Gemini provider failure: {exc}") from exc

    async def health_check(self) -> Dict[str, Any]:
        """Performs safe configuration verification without leaking secret keys."""
        if genai is None:
            return {
                "status": "unavailable",
                "provider": self.name,
                "error": "google-genai package is not installed",
            }
        if not self._api_key:
            return {
                "status": "unconfigured",
                "provider": self.name,
                "model": self._model_name,
                "message": "GEMINI_API_KEY is not set",
            }
        if self._client is None:
            return {
                "status": "error",
                "provider": self.name,
                "error": "Client failed initialization",
            }
        return {
            "status": "ready",
            "provider": self.name,
            "model": self._model_name,
            "api_key_configured": True,
        }
