"""
Financial BM25 Lexical Retrieval Service for VERIFIN 2.0.

Implements financial-aware tokenization and Okapi BM25 scoring with:
- Preservation of currencies, numbers, percentages, fiscal periods, and metrics.
- Fast, deterministic in-memory indexer with rank-bm25 compatibility and native fallback.
- In-memory index caching per document.
- Keyword match tracking and score normalization.
"""

from __future__ import annotations

import math
import re
import threading
from typing import Dict, List, Optional, Set, Tuple

from app.config import settings
from app.models.chunk import DocumentChunkModel

try:
    from rank_bm25 import BM25Okapi as ExternalBM25Okapi
except ImportError:
    ExternalBM25Okapi = None  # type: ignore


class FinancialTokenizer:
    """
    Tokenizer tailored for financial documents and claims.
    Preserves numerical entities, percentages, currency symbols,
    fiscal periods, and standard financial acronyms.
    """

    # Low-value English stopwords (directionals and financial keywords excluded)
    STOPWORDS: Set[str] = {
        "a", "about", "above", "after", "again", "all", "am", "an", "and", "any",
        "are", "as", "at", "be", "because", "been", "before", "being", "below",
        "between", "both", "but", "by", "could", "did", "do", "does", "doing",
        "down", "during", "each", "few", "for", "from", "further", "had", "has",
        "have", "having", "he", "her", "here", "hers", "herself", "him", "himself",
        "his", "how", "i", "if", "in", "into", "is", "it", "its", "itself", "just",
        "me", "more", "most", "my", "myself", "no", "nor", "not", "of", "off",
        "on", "once", "only", "or", "other", "our", "ours", "ourselves", "out",
        "over", "own", "same", "she", "should", "so", "some", "such", "than",
        "that", "the", "their", "theirs", "them", "themselves", "then", "there",
        "these", "they", "this", "those", "through", "to", "too", "under", "until",
        "up", "very", "was", "we", "were", "what", "when", "where", "which",
        "while", "who", "whom", "why", "will", "with", "would", "you", "your",
        "yours", "yourself", "yourselves",
    }

    # Financial keywords that should NEVER be filtered even if in stop lists
    PRESERVED_KEYWORDS: Set[str] = {
        "revenue", "income", "profit", "loss", "growth", "margin", "ebitda",
        "gaap", "eps", "debt", "cash", "asset", "liability", "dividend",
        "operating", "gross", "net", "sales", "quarter", "fiscal", "annual",
        "increase", "decrease", "rose", "fell", "up", "down", "higher", "lower",
    }

    # Regex pattern to capture:
    # 1. Currencies with numbers (e.g. $94.8, €100, $350M, $12.5B)
    # 2. Percentages (e.g. 15.2%, 5%)
    # 3. Fiscal periods (e.g. FY2024, FY24, Q1, Q2, Q3, Q4)
    # 4. Standard numbers with optional commas/decimals (e.g. 1,234.56 or 307.4)
    # 5. Words / alphanumeric tokens (e.g. EBITDA, 10-K, AAPL)
    TOKEN_PATTERN = re.compile(
        r"[$€£¥₹]?\d+(?:,\d{3})*(?:\.\d+)?(?:[bBtTmMkK%]|(?:\s*(?:billion|million|trillion|thousand|percent)))?"
        r"|\b(?:FY|Q[1-4])\s*['’]?\d{2,4}\b"
        r"|\b[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*\b",
        re.IGNORECASE,
    )

    def tokenize(self, text: str, remove_stopwords: bool = True) -> List[str]:
        """
        Tokenizes financial text into normalized tokens.
        """
        if not text or not text.strip():
            return []

        tokens: List[str] = []
        for match in self.TOKEN_PATTERN.finditer(text):
            raw_token = match.group(0).strip().lower()
            if not raw_token:
                continue

            # Clean outer punctuation but preserve inner hyphens and decimals
            cleaned = raw_token.strip(".,;:()[]{}\"'`")
            if not cleaned:
                continue

            if remove_stopwords:
                if cleaned in self.STOPWORDS and cleaned not in self.PRESERVED_KEYWORDS:
                    continue

            tokens.append(cleaned)

        return tokens


class NativeBM25Okapi:
    """
    High-performance native implementation of Okapi BM25 ranking algorithm.
    Used natively or when rank-bm25 is unavailable, with zero external dependencies.
    """

    def __init__(
        self,
        corpus: List[List[str]],
        k1: float = 1.5,
        b: float = 0.75,
        epsilon: float = 0.25,
    ):
        self.k1 = k1
        self.b = b
        self.epsilon = epsilon
        self.corpus_size = len(corpus)
        self.doc_lengths = [len(doc) for doc in corpus]
        self.avgdl = (
            sum(self.doc_lengths) / self.corpus_size if self.corpus_size > 0 else 1.0
        )
        self.doc_freqs: List[Dict[str, int]] = []
        self.idf: Dict[str, float] = {}

        self._initialize(corpus)

    def _initialize(self, corpus: List[List[str]]) -> None:
        nd: Dict[str, int] = {}
        for doc in corpus:
            freqs: Dict[str, int] = {}
            for term in doc:
                freqs[term] = freqs.get(term, 0) + 1
            self.doc_freqs.append(freqs)

            for term in freqs:
                nd[term] = nd.get(term, 0) + 1

        # Calculate standard Robertson-Spärck Jones IDF with Robertson smoothing
        idf_sum = 0.0
        negative_idfs: List[str] = []
        for term, freq in nd.items():
            # Standard BM25 IDF: ln((N - n + 0.5) / (n + 0.5) + 1)
            term_idf = math.log((self.corpus_size - freq + 0.5) / (freq + 0.5) + 1.0)
            self.idf[term] = term_idf
            idf_sum += term_idf
            if term_idf < 0:
                negative_idfs.append(term)

        avg_idf = idf_sum / len(self.idf) if self.idf else 0.0
        eps = self.epsilon * avg_idf
        for term in negative_idfs:
            self.idf[term] = eps

    def get_scores(self, query_tokens: List[str]) -> List[float]:
        """Calculates BM25 scores for all corpus documents against query tokens."""
        scores = [0.0] * self.corpus_size
        if not query_tokens or self.corpus_size == 0:
            return scores

        for term in query_tokens:
            if term not in self.idf:
                continue
            term_idf = self.idf[term]
            for i, doc_freq in enumerate(self.doc_freqs):
                freq = doc_freq.get(term, 0)
                if freq == 0:
                    continue
                doc_len = self.doc_lengths[i]
                numerator = freq * (self.k1 + 1.0)
                denominator = freq + self.k1 * (1.0 - self.b + self.b * (doc_len / self.avgdl))
                scores[i] += term_idf * (numerator / denominator)

        return scores


class BM25DocumentIndex:
    """
    In-memory BM25 index over a specific collection of document chunks.
    """

    def __init__(
        self,
        chunks: List[DocumentChunkModel],
        tokenizer: Optional[FinancialTokenizer] = None,
        k1: Optional[float] = None,
        b: Optional[float] = None,
    ):
        self.chunks = chunks
        self.tokenizer = tokenizer or FinancialTokenizer()
        self.k1 = k1 or settings.bm25_k1
        self.b = b or settings.bm25_b

        # Tokenize all chunks
        self.tokenized_corpus = [
            self.tokenizer.tokenize(chunk.text) for chunk in self.chunks
        ]

        # Use smoothed NativeBM25Okapi for robust Lucene-grade IDF across all corpus sizes
        self.bm25 = NativeBM25Okapi(self.tokenized_corpus, k1=self.k1, b=self.b)

    def query(
        self,
        query: str,
        top_k: int = 5,
    ) -> List[Tuple[DocumentChunkModel, float, List[str]]]:
        """
        Executes BM25 search for query string.
        Returns list of tuples: (chunk, raw_bm25_score, matched_keywords)
        """
        if not self.chunks or not query or not query.strip():
            return []

        query_tokens = self.tokenizer.tokenize(query)
        if not query_tokens:
            return []

        scores = self.bm25.get_scores(query_tokens)

        # Build results with keyword match intersection
        query_set = set(query_tokens)
        results: List[Tuple[DocumentChunkModel, float, List[str]]] = []

        for i, score in enumerate(scores):
            raw_score = float(score)
            doc_tokens = self.tokenized_corpus[i]
            matched = sorted(list(query_set.intersection(doc_tokens)))
            results.append((self.chunks[i], raw_score, matched))

        # Sort descending by BM25 score
        results.sort(key=lambda item: item[1], reverse=True)
        return results[:top_k]


class BM25Service:
    """
    Singleton service managing financial BM25 indexes and cached per-document retrieval.
    """

    def __init__(self):
        self.tokenizer = FinancialTokenizer()
        self._index_cache: Dict[str, BM25DocumentIndex] = {}
        self._lock = threading.Lock()

    def get_or_build_index(
        self,
        document_id: str,
        chunks: List[DocumentChunkModel],
    ) -> BM25DocumentIndex:
        """
        Retrieves cached index or builds a new one for the document.
        """
        cache_key = f"{document_id}_{len(chunks)}"
        with self._lock:
            if cache_key in self._index_cache:
                return self._index_cache[cache_key]

            index = BM25DocumentIndex(
                chunks=chunks,
                tokenizer=self.tokenizer,
                k1=settings.bm25_k1,
                b=settings.bm25_b,
            )
            self._index_cache[cache_key] = index
            return index

    def search(
        self,
        query: str,
        chunks: List[DocumentChunkModel],
        document_id: Optional[str] = None,
        top_k: int = 5,
    ) -> List[Tuple[DocumentChunkModel, float, List[str]]]:
        """
        Performs BM25 search over the provided chunks.
        """
        if not chunks:
            return []

        doc_key = document_id or "adhoc_corpus"
        index = self.get_or_build_index(doc_key, chunks)
        return index.query(query, top_k=top_k)

    def clear_cache(self, document_id: Optional[str] = None) -> None:
        """Clears cached indices."""
        with self._lock:
            if document_id:
                keys_to_del = [k for k in self._index_cache if k.startswith(document_id)]
                for k in keys_to_del:
                    self._index_cache.pop(k, None)
            else:
                self._index_cache.clear()


# Singleton instance
_bm25_service_instance: Optional[BM25Service] = None
_bm25_lock = threading.Lock()


def get_bm25_service() -> BM25Service:
    """Returns singleton BM25Service instance."""
    global _bm25_service_instance
    if _bm25_service_instance is None:
        with _bm25_lock:
            if _bm25_service_instance is None:
                _bm25_service_instance = BM25Service()
    return _bm25_service_instance
