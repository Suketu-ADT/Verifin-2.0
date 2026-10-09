"""
OpenAI LLM provider implementation using official openai SDK.
Supports structured outputs via beta.chat.completions.parse.
"""

from __future__ import annotations

from typing import Any, Dict, Optional, Type, TypeVar
from pydantic import BaseModel, ValidationError

from app.config import settings
from app.services.llm.base import LLMProvider
from app.utils.logging import logger

try:
    from openai import AsyncOpenAI
except ImportError:
    AsyncOpenAI = None  # type: ignore

T = TypeVar("T", bound=BaseModel)


class OpenAIProvider(LLMProvider):
    """OpenAI LLM provider."""

    DEFAULT_MODEL = "gpt-4o-mini"

    def __init__(
        self,
        api_key: Optional[str] = None,
        model_name: Optional[str] = None,
    ):
        self._api_key = api_key or settings.openai_api_key
        self._model_name = model_name or settings.llm_model or self.DEFAULT_MODEL
        self._client = None
        if AsyncOpenAI is not None and self._api_key:
            try:
                client_kwargs: Dict[str, Any] = {
                    "api_key": self._api_key,
                    "timeout": settings.llm_timeout_seconds,
                }
                if settings.openai_base_url:
                    client_kwargs["base_url"] = settings.openai_base_url
                self._client = AsyncOpenAI(**client_kwargs)
            except Exception as exc:
                logger.warning(f"Failed to initialize OpenAI client: {exc}")

    @property
    def name(self) -> str:
        return "openai"

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
        Executes prompt via OpenAI Chat Completions parse and validates against Pydantic schema.
        """
        if not self.is_configured:
            raise ConnectionError(
                "OpenAI provider is not configured. Please set OPENAI_API_KEY environment variable."
            )

        messages = []
        if system_instruction:
            messages.append({"role": "system", "content": system_instruction})
        messages.append({"role": "user", "content": prompt})


        # Check if running against local/custom base URL (such as Ollama)
        is_custom_base_url = bool(settings.openai_base_url)

        try:
            # Only use OpenAI beta.chat.completions.parse for genuine OpenAI endpoints
            if not is_custom_base_url:
                try:
                    completion = await self._client.beta.chat.completions.parse(
                        model=self._model_name,
                        messages=messages,
                        response_format=response_model,
                        temperature=settings.llm_temperature,
                        max_tokens=settings.llm_max_output_tokens,
                    )

                    parsed = completion.choices[0].message.parsed
                    if parsed is not None:
                        return parsed
                except Exception as parse_err:
                    logger.info(f"OpenAI beta parse error ({parse_err}), falling back to standard JSON completion...")

            # Direct fast JSON completion for Ollama / Groq / custom endpoints
            import json
            import re

            example_json = {
                "claims": [
                    {
                        "claim_text": "Company revenue grew 15% to $88.27 billion in Q3 2024",
                        "claim_type": "numerical",
                        "entity": "Company Name",
                        "metric": "Revenue",
                        "value": 88.27,
                        "unit": "billion",
                        "currency": "USD",
                        "reporting_period": "Q3 2024",
                    }
                ]
            }

            sys_prompt = (
                (system_instruction or "You are a financial information extraction specialist.")
                + "\n\nCRITICAL: You MUST output strictly valid JSON matching this exact structure:\n"
                + json.dumps(example_json, indent=2)
                + "\nReturn ONLY the JSON object without commentary or markdown code blocks."
            )

            standard_messages = [
                {"role": "system", "content": sys_prompt},
                {"role": "user", "content": prompt},
            ]

            raw_comp = await self._client.chat.completions.create(
                model=self._model_name,
                messages=standard_messages,
                response_format={"type": "json_object"},
                temperature=settings.llm_temperature,
                max_tokens=min(settings.llm_max_output_tokens, 1500),
            )

            raw_text = raw_comp.choices[0].message.content or ""
            if "```" in raw_text:
                m = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", raw_text)
                if m:
                    raw_text = m.group(1).strip()

            try:
                return response_model.model_validate_json(raw_text)
            except Exception:
                # Handle flexible root keys from compact local models
                data = json.loads(raw_text)
                if isinstance(data, list):
                    data = {"claims": data}
                elif isinstance(data, dict):
                    if "claims" not in data:
                        for cand in ["extracted_claims", "facts", "extracted_facts", "data", "results", "key_claims"]:
                            if cand in data and isinstance(data[cand], list):
                                data["claims"] = data[cand]
                                break
                    if "claims" not in data:
                        data["claims"] = []
                return response_model.model_validate(data)

        except ValidationError as val_err:
            logger.error(f"OpenAI response failed Pydantic validation: {val_err}")
            raise ValueError(f"Malformed LLM structured response: {val_err}") from val_err
        except Exception as exc:
            logger.error(f"OpenAI generation error: {exc}")
            raise RuntimeError(f"OpenAI provider failure: {exc}") from exc

    async def health_check(self) -> Dict[str, Any]:
        """Performs safe configuration verification without leaking secret keys."""
        if AsyncOpenAI is None:
            return {
                "status": "unavailable",
                "provider": self.name,
                "error": "openai package is not installed",
            }
        if not self._api_key:
            return {
                "status": "unconfigured",
                "provider": self.name,
                "model": self._model_name,
                "message": "OPENAI_API_KEY is not set",
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
