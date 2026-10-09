"""
Abstract base class for modular LLM providers.
Supports structured output generation via Pydantic schemas.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any, Dict, Optional, Type, TypeVar
from pydantic import BaseModel

T = TypeVar("T", bound=BaseModel)


class LLMProvider(ABC):
    """Abstract interface for LLM providers (Hugging Face, Gemini, OpenAI, Mock)."""

    @property
    @abstractmethod
    def name(self) -> str:
        """Provider identifier e.g. 'huggingface', 'gemini', 'openai', 'mock'."""
        pass

    @property
    @abstractmethod
    def model_name(self) -> str:
        """Active model identifier e.g. 'Qwen/Qwen2.5-72B-Instruct'."""
        pass

    @property
    @abstractmethod
    def is_configured(self) -> bool:
        """True if credentials and model are configured."""
        pass

    @abstractmethod
    async def generate_structured(
        self,
        prompt: str,
        response_model: Type[T],
        system_instruction: Optional[str] = None,
    ) -> T:
        """
        Executes prompt and returns validated Pydantic model.
        Must handle rate limits, timeouts, provider errors, and invalid JSON.
        """
        pass

    @abstractmethod
    async def health_check(self) -> Dict[str, Any]:
        """
        Returns safe health and configuration status without exposing API keys.
        Does not perform expensive inference calls on ordinary status checks.
        """
        pass

    async def test_readiness(self) -> Dict[str, Any]:
        """
        Optional bounded readiness check that performs a minimal inference test.
        Subclasses may override to test actual connectivity.
        """
        return await self.health_check()
