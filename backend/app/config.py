"""
VERIFIN 2.0 — Application Configuration.

Loads environment variables via pydantic-settings.
"""

from __future__ import annotations

from pathlib import Path
from typing import List, Optional

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Central configuration loaded from environment variables or .env file."""

    model_config = SettingsConfigDict(
        env_file=(Path(__file__).resolve().parent.parent / ".env", ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    # ── Database ──────────────────────────────────────────────────────────
    mongodb_uri: str = "mongodb://localhost:27017"
    mongodb_database: str = "verifin"
    mongodb_server_selection_timeout_ms: int = 5000
    mongodb_connect_timeout_ms: int = 5000

    # ── Server ───────────────────────────────────────────────────────────
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    environment: str = "development"
    debug: bool = True

    # ── Frontend & CORS ──────────────────────────────────────────────────
    frontend_url: str = "http://localhost:5173"

    # ── Storage ──────────────────────────────────────────────────────────
    upload_dir: str = "./storage/uploads"
    max_upload_size_mb: int = 25

    # ── Embeddings & Retrieval (Phase 2) ─────────────────────────────────
    embedding_model_name: str = "sentence-transformers/all-MiniLM-L6-v2"
    embedding_dimension: int = 384
    retrieval_top_k: int = 3
    chunk_size_chars: int = 500
    chunk_overlap_chars: int = 50

    # ── NLI Verification (Phase 3) ───────────────────────────────────────
    nli_model_name: str = "cross-encoder/nli-deberta-v3-small"
    nli_device: str = "cpu"
    nli_batch_size: int = 16
    nli_contradiction_threshold: float = 0.50
    nli_support_threshold: float = 0.50

    # ── OCR & Scanned Document Ingestion (Phase 6) ──────────────────────
    ocr_enabled: bool = True
    tesseract_cmd: Optional[str] = None
    ocr_min_char_threshold: int = 40
    ocr_confidence_threshold: float = 60.0
    ocr_timeout_seconds: int = 15
    ocr_dpi: int = 150

    # ── LLM Integration (Hugging Face Cloud Inference Providers) ─────────
    llm_enabled: bool = True
    llm_provider: str = "huggingface"  # "huggingface", "gemini", "openai"
    hf_token: Optional[str] = None
    hf_model: str = "Qwen/Qwen2.5-72B-Instruct"
    hf_provider: str = "auto"
    llm_temperature: float = 0.0
    llm_timeout_seconds: int = 30
    llm_max_output_tokens: int = 2048
    llm_max_input_chars: int = 30000
    llm_max_retries: int = 2

    # Alternative/future provider keys
    llm_model: Optional[str] = None
    gemini_api_key: Optional[str] = None
    openai_api_key: Optional[str] = None
    openai_base_url: Optional[str] = None

    @field_validator("llm_temperature")
    @classmethod
    def validate_temperature(cls, v: float) -> float:
        if not (0.0 <= v <= 2.0):
            raise ValueError("llm_temperature must be between 0.0 and 2.0")
        return v

    @field_validator("llm_timeout_seconds")
    @classmethod
    def validate_timeout(cls, v: int) -> int:
        if not (1 <= v <= 300):
            raise ValueError("llm_timeout_seconds must be between 1 and 300")
        return v

    @field_validator("llm_max_output_tokens")
    @classmethod
    def validate_max_tokens(cls, v: int) -> int:
        if not (16 <= v <= 8192):
            raise ValueError("llm_max_output_tokens must be between 16 and 8192")
        return v

    @field_validator("llm_max_input_chars")
    @classmethod
    def validate_max_input_chars(cls, v: int) -> int:
        if not (100 <= v <= 100000):
            raise ValueError("llm_max_input_chars must be between 100 and 100000")
        return v

    @field_validator("llm_max_retries")
    @classmethod
    def validate_max_retries(cls, v: int) -> int:
        if not (0 <= v <= 10):
            raise ValueError("llm_max_retries must be between 0 and 10")
        return v

    # ── Computed Paths & Properties ───────────────────────────────────────
    @property
    def project_root(self) -> Path:
        """Root directory of the repository."""
        return Path(__file__).resolve().parent.parent.parent

    @property
    def backend_root(self) -> Path:
        """Root directory of the backend."""
        return Path(__file__).resolve().parent.parent

    @property
    def data_dir(self) -> Path:
        """Data directory containing demo files."""
        return self.project_root / "data"

    @property
    def demo_data_path(self) -> Path:
        """Path to canned demo dataset."""
        return self.data_dir / "demo" / "demo_data.json"

    @property
    def upload_path(self) -> Path:
        """Resolved storage upload path on filesystem."""
        path = Path(self.upload_dir)
        if not path.is_absolute():
            path = self.backend_root / path
        path.mkdir(parents=True, exist_ok=True)
        return path

    @property
    def max_upload_size_bytes(self) -> int:
        """Maximum allowed upload file size in bytes."""
        return self.max_upload_size_mb * 1024 * 1024

    @property
    def cors_origins(self) -> List[str]:
        """Allowed origins for CORS policy."""
        origins = [self.frontend_url.rstrip("/")]
        # Ensure common localhost development ports are allowed if in dev mode
        dev_origins = ["http://localhost:5173", "http://127.0.0.1:5173"]
        for o in dev_origins:
            if o not in origins:
                origins.append(o)
        return origins


settings = Settings()
