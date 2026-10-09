"""
Modular embedding service using Sentence Transformers for VERIFIN 2.0.
"""

from __future__ import annotations

import threading
from typing import List, Optional
import numpy as np

from app.config import settings
from app.utils.logging import logger

try:
    from sentence_transformers import SentenceTransformer
except ImportError:
    SentenceTransformer = None  # type: ignore


class EmbeddingService:
    """
    Modular Sentence Transformers service for dense vector embeddings.
    Implements lazy initialization and normalized vector generation.
    """

    def __init__(self, model_name: Optional[str] = None):
        self.model_name = model_name or settings.embedding_model_name
        self.dimension = settings.embedding_dimension
        self._model: Optional[SentenceTransformer] = None
        self._lock = threading.Lock()
        self._initialized = False
        self._init_error: Optional[str] = None

    def _load_model(self) -> None:
        """Loads the SentenceTransformer model on demand with error capture."""
        if self._initialized:
            return

        with self._lock:
            if self._initialized:
                return

            if SentenceTransformer is None:
                self._init_error = "sentence-transformers package is not installed."
                logger.error(self._init_error)
                return

            try:
                logger.info(f"Loading embedding model '{self.model_name}'...")
                self._model = SentenceTransformer(self.model_name)
                self._initialized = True
                self._init_error = None
                logger.info(
                    f"Embedding model '{self.model_name}' loaded successfully (dimension={self.dimension})."
                )
            except Exception as exc:
                self._init_error = f"Failed to load embedding model '{self.model_name}': {exc}"
                logger.error(self._init_error)
                self._initialized = False

    @property
    def is_available(self) -> bool:
        """Returns True if the underlying sentence-transformers library is present."""
        return SentenceTransformer is not None

    def is_healthy(self) -> bool:
        """
        Status check: attempts to load model if not yet loaded and verifies readiness.
        """
        if not self.is_available:
            return False
        if not self._initialized:
            self._load_model()
        return self._initialized and self._model is not None

    @property
    def status(self) -> str:
        """Returns 'healthy' if model is ready, else 'unavailable'."""
        return "healthy" if self.is_healthy() else "unavailable"

    def preprocess_text(self, text: str) -> str:
        """Cleans and standardizes text input for embedding generation."""
        if not text:
            return ""
        # Strip excessive whitespace and newlines
        cleaned = " ".join(text.split())
        return cleaned

    def generate_embedding(self, text: str) -> List[float]:
        """
        Generates a normalized dense vector embedding for a single text string.
        """
        cleaned = self.preprocess_text(text)
        if not cleaned:
            raise ValueError("Cannot generate embedding for empty or whitespace-only text.")

        if not self.is_healthy():
            error_msg = self._init_error or "Embedding service is unavailable."
            raise RuntimeError(f"Embedding generation failed: {error_msg}")

        embedding = self._model.encode(
            cleaned,
            normalize_embeddings=True,
            show_progress_bar=False,
        )
        return [float(x) for x in embedding]

    def generate_embeddings(self, texts: List[str]) -> List[List[float]]:
        """
        Generates normalized dense vector embeddings for a batch of text strings.
        """
        if not texts:
            return []

        cleaned_texts = [self.preprocess_text(t) for t in texts]
        non_empty_indices = [i for i, t in enumerate(cleaned_texts) if t]

        if not non_empty_indices:
            raise ValueError("All input texts in batch are empty.")

        if not self.is_healthy():
            error_msg = self._init_error or "Embedding service is unavailable."
            raise RuntimeError(f"Embedding batch generation failed: {error_msg}")

        # Encode valid texts in batch
        valid_texts = [cleaned_texts[i] for i in non_empty_indices]
        encoded = self._model.encode(
            valid_texts,
            normalize_embeddings=True,
            batch_size=32,
            show_progress_bar=False,
        )

        # Reconstruct result aligned with original list
        results: List[List[float]] = []
        valid_map = {idx: [float(x) for x in encoded[pos]] for pos, idx in enumerate(non_empty_indices)}
        
        for i in range(len(texts)):
            if i in valid_map:
                results.append(valid_map[i])
            else:
                # Fallback zero vector for empty elements in batch
                results.append([0.0] * self.dimension)

        return results

    @staticmethod
    def compute_cosine_similarity(vec_a: List[float], vec_b: List[float]) -> float:
        """
        Computes cosine similarity between two vectors.
        Since embeddings are L2 normalized, cosine similarity is equivalent to dot product.
        """
        if not vec_a or not vec_b or len(vec_a) != len(vec_b):
            return 0.0

        a = np.array(vec_a, dtype=np.float32)
        b = np.array(vec_b, dtype=np.float32)

        norm_a = np.linalg.norm(a)
        norm_b = np.linalg.norm(b)

        if norm_a == 0.0 or norm_b == 0.0:
            return 0.0

        dot = float(np.dot(a, b) / (norm_a * norm_b))
        # Clamp to [-1.0, 1.0] to prevent floating point inaccuracies
        return max(-1.0, min(1.0, dot))


# Singleton instance
_service_instance: Optional[EmbeddingService] = None
_service_lock = threading.Lock()


def get_embedding_service() -> EmbeddingService:
    """Returns the singleton EmbeddingService instance."""
    global _service_instance
    if _service_instance is None:
        with _service_lock:
            if _service_instance is None:
                _service_instance = EmbeddingService()
    return _service_instance
