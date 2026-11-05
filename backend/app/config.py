"""
VERIFIN 2.0 — Application Configuration.

Loads environment variables via pydantic-settings.
"""

from __future__ import annotations

from pathlib import Path
from typing import List, Optional

from pydantic import field_validator, model_validator
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
    api_host: str = "0.0.0.0"  # nosec B104 - binds all interfaces on purpose: the service runs in a container behind a proxy
    api_port: int = 8000
    environment: str = "development"
    debug: bool = True

    # ── Authentication & authorisation ───────────────────────────────────
    auth_enabled: bool = False  # forced on in production
    jwt_secret: str = "dev-insecure-secret-change-me"
    jwt_algorithm: str = "HS256"
    jwt_issuer: str = "verifin"
    access_token_ttl_minutes: int = 60
    allow_registration: bool = True  # public self-service sign-up (creates a new tenant)
    min_password_length: int = 10

    # ── Sign-in without a password ───────────────────────────────────────
    # Google: the web page obtains an ID token from Google; the API checks it against this OAuth client ID. Unset = Google sign-in off.
    google_client_id: Optional[str] = None
    # Email one-time codes. Codes are sent over SMTP; without SMTP they are only written to the log, and never in production.
    email_otp_enabled: bool = True
    otp_length: int = 6
    otp_ttl_minutes: int = 10
    otp_max_attempts: int = 5  # wrong guesses before a code is thrown away
    otp_resend_seconds: int = 45  # minimum gap between two codes for the same address
    otp_max_per_hour: int = 6  # codes per address per hour
    smtp_host: Optional[str] = None
    smtp_port: int = 587
    smtp_username: Optional[str] = None
    smtp_password: Optional[str] = None
    smtp_from: Optional[str] = None  # sender address; defaults to the SMTP username
    smtp_ssl: bool = False  # True: implicit TLS (port 465); False: STARTTLS (port 587)

    # ── Rate limiting (per instance, in memory) ──────────────────────────
    rate_limit_enabled: bool = True
    rate_limit_per_minute: int = 120  # general API calls per principal or client address
    rate_limit_heavy_per_minute: int = 10  # verification starts, uploads, LLM calls
    trust_proxy_headers: bool = False  # believe X-Forwarded-For (only behind a proxy you control)
    rate_limit_auth_per_minute: int = 10  # login and registration attempts per client address

    # ── Observability ────────────────────────────────────────────────────
    log_format: str = "text"  # "text" or "json"
    metrics_enabled: bool = True
    metrics_token: Optional[str] = None  # when set, /metrics requires "Authorization: Bearer <token>"

    # ── Background jobs ──────────────────────────────────────────────────
    max_concurrent_jobs: int = 2  # verification jobs running at once per instance
    job_queue_limit: int = 50  # queued jobs per instance before new ones are refused
    batch_max_items: int = 25  # statements accepted in one batch request

    # ── SEC EDGAR import ─────────────────────────────────────────────────
    edgar_user_agent: Optional[str] = None  # required by the SEC: "Organisation contact@example.com"
    edgar_max_bytes: int = 30_000_000

    # ── Data store ───────────────────────────────────────────────────────
    # Local development may fall back to an in-memory database when MongoDB is unreachable. Production never does:
    # it refuses to start, so an outage is visible instead of silently losing data on restart.
    allow_db_fallback: bool = True

    # ── Frontend & CORS ──────────────────────────────────────────────────
    frontend_url: str = "http://localhost:5173"
    # Folder holding the built web interface (frontend/dist). When set, the API serves it too, so the site and the API share one
    # address: used to run the whole product behind a single tunnel or host.
    frontend_dist: Optional[str] = None

    # ── Storage ──────────────────────────────────────────────────────────
    upload_dir: str = "./storage/uploads"
    max_upload_size_mb: int = 25

    # ── Embeddings & Retrieval (Phase 2 & Hybrid RAG) ─────────────────────
    embedding_model_name: str = "sentence-transformers/all-MiniLM-L6-v2"
    embedding_dimension: int = 384
    retrieval_top_k: int = 3
    chunk_size_chars: int = 500
    chunk_overlap_chars: int = 50
    retrieval_mode: str = "hybrid"  # "hybrid", "dense", "bm25"
    retrieval_fusion_method: str = "rrf"  # "rrf" or "weighted"
    retrieval_hybrid_alpha: float = 0.5  # Weight for dense vs bm25 in weighted fusion (0.0 to 1.0)
    retrieval_rrf_k: int = 60  # RRF smoothing constant
    reranker_enabled: bool = False  # rerank first-stage candidates with a cross-encoder
    reranker_model: str = "cross-encoder/ms-marco-MiniLM-L-6-v2"
    reranker_candidates: int = 15  # first-stage candidates passed to the reranker
    bm25_k1: float = 1.5  # BM25 term frequency saturation
    bm25_b: float = 0.75  # BM25 document length normalization

    # ── NLI Verification (Phase 3) ───────────────────────────────────────
    nli_model_name: str = "cross-encoder/nli-deberta-v3-small"
    nli_device: str = "cpu"
    nli_batch_size: int = 16
    # Hold each model's token-embedding table as int8 (about 250 MB less memory, probabilities move by ~0.002). Off by default.
    low_memory: bool = False
    nli_contradiction_threshold: float = 0.50
    nli_support_threshold: float = 0.50
    nli_aggregation: str = "aligned"  # "aligned" (sentence windows) or "legacy" (whole chunks, any contradiction wins)
    nli_max_windows: int = 6  # candidate sentence windows scored per claim
    # Comma-separated verdict checks to switch off (ablation studies only): entity_novelty, figure_conflict,
    # table_mismatch, temporal, grounded_support, neighbours, derived_values
    disabled_checks: str = ""
    nli_relevance_ratio: float = 0.75  # windows must be this close to the best alignment to decide the verdict

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
    # Cache of structured LLM responses (fact extraction): a repeat call for the same model, instructions and text is answered
    # from disk. Entries expire after the time limit and the oldest go first past the count limit.
    llm_cache_enabled: bool = True
    llm_cache_dir: Optional[str] = None  # default: <data dir>/cache/llm
    llm_cache_ttl_seconds: int = 7 * 24 * 3600
    llm_cache_max_entries: int = 256
    # Whole-call budget for document fact extraction; past it the deterministic extractor answers instead.
    llm_extraction_budget_seconds: int = 45

    # Alternative/future provider keys
    llm_model: Optional[str] = None
    gemini_api_key: Optional[str] = None
    openai_api_key: Optional[str] = None
    openai_base_url: Optional[str] = None

    @model_validator(mode="after")
    def enforce_production_safety(self) -> "Settings":
        """A production deployment must not run open, with a default secret, or in debug mode."""
        if self.environment.lower() == "production":
            self.auth_enabled = True
            self.allow_db_fallback = False
            if self.debug:
                raise ValueError("DEBUG must be false when ENVIRONMENT=production")
            if len(self.jwt_secret) < 32 or self.jwt_secret == "dev-insecure-secret-change-me":
                raise ValueError("JWT_SECRET must be set to a random value of at least 32 characters in production")
        return self

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
        if self.environment.lower() != "production":
            # local development ports are never allowed in production
            for o in ("http://localhost:5173", "http://127.0.0.1:5173"):
                if o not in origins:
                    origins.append(o)
        return origins


settings = Settings()
