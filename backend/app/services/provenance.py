"""
Provenance of a verification: what produced a verdict, so a result can be explained, compared and reproduced.

Stored with every session. It records identifiers and settings only, never document text or credentials.
"""

from __future__ import annotations

import hashlib
from datetime import datetime
from typing import Any, Dict, Optional

from app.config import settings
from app.services.verdict_policy import GROUNDED_SUPPORT_MIN_OVERLAP, MULTI_FIGURE_SUPPORT_MIN_OVERLAP

# Bump when verdict logic changes, so stored results can be traced to the rules that produced them.
# 4.1: table units scaled, table period/percentage matching, multi-digit figures (found by a live demo rehearsal).
# 4.2: section numbers such as "4.1 Revenue" are no longer read as figures, so they cannot appear as a conflicting value.
# 4.0: local-context figure grounding, unit-twin conflicts, fiscal-year period check, derived-value recompute.
PIPELINE_VERSION = "verifin-pipeline/4.2"
APP_VERSION = "2.0.0"


def sha256_text(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def build_provenance(
    *,
    document: Any,
    llm_text: str,
    retrieval_mode: Optional[str],
    started_at: datetime,
    finished_at: datetime,
    claim_count: int,
    rule_counts: Dict[str, int],
) -> Dict[str, Any]:
    return {
        "pipeline_version": PIPELINE_VERSION,
        "app_version": APP_VERSION,
        "models": {
            "embedding": settings.embedding_model_name,
            "nli": settings.nli_model_name,
            "reranker": settings.reranker_model if settings.reranker_enabled else None,
            "low_memory": settings.low_memory,
        },
        "retrieval": {
            "mode": retrieval_mode or settings.retrieval_mode,
            "fusion": settings.retrieval_fusion_method,
            "top_k": settings.retrieval_top_k,
            "reranker_enabled": settings.reranker_enabled,
        },
        "policy": {
            "aggregation": settings.nli_aggregation,
            "nli_contradiction_threshold": settings.nli_contradiction_threshold,
            "nli_support_threshold": settings.nli_support_threshold,
            "grounded_support_min_overlap": GROUNDED_SUPPORT_MIN_OVERLAP,
            "multi_figure_support_min_overlap": MULTI_FIGURE_SUPPORT_MIN_OVERLAP,
            "disabled_checks": [c.strip() for c in settings.disabled_checks.split(",") if c.strip()],
        },
        "input": {
            "document_id": getattr(document, "id", None),
            "document_filename": getattr(document, "filename", None),
            "document_sha256": getattr(document, "sha256", None),
            "statement_sha256": sha256_text(llm_text),
        },
        "outcome": {"claims": claim_count, "decided_by": rule_counts},
        "timing": {
            "started_at": started_at.isoformat(),
            "finished_at": finished_at.isoformat(),
            "duration_s": round((finished_at - started_at).total_seconds(), 3),
        },
    }
