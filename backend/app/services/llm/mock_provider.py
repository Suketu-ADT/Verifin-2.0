"""
Deterministic Mock LLM Provider for unit tests and offline environments.
"""

from __future__ import annotations

from typing import Any, Dict, Optional, Type, TypeVar
from pydantic import BaseModel

from app.services.llm.base import LLMProvider

T = TypeVar("T", bound=BaseModel)


class MockLLMProvider(LLMProvider):
    """Mock provider with customizable canned responses."""

    def __init__(self, canned_response: Optional[Any] = None, should_fail: bool = False):
        self._canned_response = canned_response
        self._should_fail = should_fail

    @property
    def name(self) -> str:
        return "mock"

    @property
    def model_name(self) -> str:
        return "mock-financial-extractor-v1"

    @property
    def is_configured(self) -> bool:
        return True

    def set_canned_response(self, response: Any):
        self._canned_response = response

    async def generate_structured(
        self,
        prompt: str,
        response_model: Type[T],
        system_instruction: Optional[str] = None,
    ) -> T:
        if self._should_fail:
            raise RuntimeError("Simulated mock provider failure.")

        if self._canned_response is not None:
            if isinstance(self._canned_response, response_model):
                return self._canned_response
            if isinstance(self._canned_response, dict):
                return response_model.model_validate(self._canned_response)
            if isinstance(self._canned_response, str):
                return response_model.model_validate_json(self._canned_response)

        # Fallback default empty instance
        try:
            return response_model.model_validate({})
        except Exception:
            # Construct minimal fields if required
            field_defaults = {}
            for field_name, field_info in response_model.model_fields.items():
                if field_info.is_required():
                    field_defaults[field_name] = "Mock"
            return response_model.model_validate(field_defaults)

    async def health_check(self) -> Dict[str, Any]:
        return {
            "status": "ready",
            "provider": self.name,
            "model": self.model_name,
            "is_mock": True,
        }
