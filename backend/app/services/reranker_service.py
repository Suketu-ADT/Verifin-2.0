"""
Cross-encoder reranking of retrieval candidates.

A cross-encoder reads the claim and a candidate passage together, so it separates passages that
merely share words with the claim from passages that answer it. It is slower than the first-stage
retrievers, so it only scores a short candidate list.
"""

from __future__ import annotations

import math
import threading
from typing import List, Optional, Sequence

from app.config import settings
from app.utils.logging import logger


class RerankerService:
    def __init__(self, model_name: Optional[str] = None):
        self.model_name = model_name or settings.reranker_model
        self._model = None
        self._lock = threading.Lock()

    def _load(self):
        with self._lock:
            if self._model is None:
                from sentence_transformers import CrossEncoder

                self._model = CrossEncoder(self.model_name, max_length=256)
                logger.info(f"Loaded reranker model '{self.model_name}'")
        return self._model

    def score(self, query: str, passages: Sequence[str]) -> List[float]:
        """Relevance of each passage to the query as a probability-like score in (0, 1)."""
        if not passages:
            return []
        logits = self._load().predict([(query, p) for p in passages], show_progress_bar=False)
        return [1.0 / (1.0 + math.exp(-float(x))) for x in logits]


_instance: Optional[RerankerService] = None
_instance_lock = threading.Lock()


def get_reranker_service() -> RerankerService:
    global _instance
    with _instance_lock:
        if _instance is None or _instance.model_name != settings.reranker_model:
            _instance = RerankerService()
        return _instance
