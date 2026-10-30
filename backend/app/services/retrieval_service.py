"""
Evidence Retrieval service implementing BM25 Sparse Lexical Search,
Dense Vector Embeddings, and Hybrid Reciprocal Rank Fusion (RRF).
"""

from __future__ import annotations

import asyncio
from typing import Dict, List, Optional, Tuple
from fastapi import HTTPException, status

from app.config import settings
from app.services.reranker_service import get_reranker_service
from app.models.chunk import DocumentChunkModel
from app.repositories.chunk_repository import ChunkRepository
from app.repositories.document_repository import DocumentRepository
from app.schemas.retrieval import EvidenceChunkResponse
from app.services.bm25_service import BM25Service, get_bm25_service
from app.services.embedding_service import EmbeddingService, get_embedding_service
from app.utils.logging import logger


class RetrievalService:
    """
    Retrieves supporting evidence chunks for financial claims using
    BM25 Hybrid RAG (Dense Vector Search + BM25 Sparse Lexical Search + RRF/Weighted Fusion).
    """

    def __init__(
        self,
        embedding_service: Optional[EmbeddingService] = None,
        chunk_repository: Optional[ChunkRepository] = None,
        document_repository: Optional[DocumentRepository] = None,
        bm25_service: Optional[BM25Service] = None,
    ):
        self.embedding_service = embedding_service or get_embedding_service()
        self.chunk_repository = chunk_repository or ChunkRepository()
        self.document_repository = document_repository or DocumentRepository()
        self.bm25_service = bm25_service or get_bm25_service()
        self.vector_index_name = "vector_index"

    async def retrieve_evidence(
        self,
        query: str,
        document_id: Optional[str] = None,
        top_k: Optional[int] = None,
        mode: Optional[str] = None,
        alpha: Optional[float] = None,
        fusion_method: Optional[str] = None,
    ) -> List[EvidenceChunkResponse]:
        """
        Retrieves top K evidence chunks for a query string using hybrid, dense, or BM25 search.
        """
        # 1. Validate query
        if not query or not query.strip():
            logger.warning("Retrieval rejected: empty query string.")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Query text cannot be empty or whitespace.",
            )

        k = top_k or settings.retrieval_top_k
        if k < 1:
            k = 1
        # first-stage depth: the reranker needs more candidates than are finally returned
        fetch_k = max(k, settings.reranker_candidates) if settings.reranker_enabled else k

        retrieval_mode = (mode or settings.retrieval_mode).lower()
        if retrieval_mode not in ("hybrid", "dense", "bm25"):
            retrieval_mode = "hybrid"

        hybrid_alpha = alpha if alpha is not None else settings.retrieval_hybrid_alpha
        hybrid_alpha = max(0.0, min(1.0, float(hybrid_alpha)))

        method = (fusion_method or settings.retrieval_fusion_method).lower()
        if method not in ("rrf", "weighted"):
            method = "rrf"

        # 2. Validate document existence and fetch filename
        doc_filename_map: Dict[str, str] = {}
        if document_id:
            doc = await self.document_repository.get_document_by_id(document_id)
            if doc is None:
                logger.warning(f"Retrieval target document '{document_id}' not found.")
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Document with ID '{document_id}' not found.",
                )
            doc_filename_map[doc.id] = doc.filename
        else:
            try:
                all_docs = await self.document_repository.list_documents(limit=100)
                for d in all_docs:
                    doc_filename_map[d.id] = d.filename
            except Exception as exc:
                logger.warning(f"Unable to load document metadata map: {exc}")

        # 3. Check embedding service health if dense/hybrid retrieval is active
        if retrieval_mode in ("hybrid", "dense"):
            if not self.embedding_service.is_healthy():
                logger.error("Embedding service is not available for evidence retrieval.")
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail="Embedding service is currently unavailable or failed to initialize.",
                )

        # 4. Load candidate chunks from repository
        if document_id:
            all_chunks = await self.chunk_repository.get_chunks_by_document(document_id)
        else:
            all_chunks = await self.chunk_repository.get_all_chunks(limit=1000)

        if not all_chunks:
            logger.info(f"No chunks available in repository for document '{document_id}'.")
            return []

        # 5. Dense Retrieval
        dense_results: List[Tuple[DocumentChunkModel, float]] = []
        if retrieval_mode in ("hybrid", "dense"):

            try:
                query_embedding = await asyncio.to_thread(self.embedding_service.generate_embedding, query)
            except Exception as exc:
                logger.error(f"Failed to generate query embedding: {exc}")
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Failed to generate query embedding: {exc}",
                )

            # Retrieve dense candidates
            dense_candidates = len(all_chunks) if retrieval_mode == "hybrid" else fetch_k
            dense_results = await self._search_vector_or_exact(
                query_embedding=query_embedding,
                document_id=document_id,
                chunks=all_chunks,
                k=dense_candidates,
            )

        # 5. Sparse BM25 Retrieval
        bm25_results: List[Tuple[DocumentChunkModel, float, List[str]]] = []
        if retrieval_mode in ("hybrid", "bm25"):
            bm25_candidates = len(all_chunks) if retrieval_mode == "hybrid" else fetch_k
            bm25_results = await asyncio.to_thread(
                self.bm25_service.search,
                query=query,
                chunks=all_chunks,
                document_id=document_id,
                top_k=bm25_candidates,
            )

        # 6. Apply Hybrid Fusion or Direct Selection
        final_ranked_chunks: List[Dict[str, any]] = []

        if retrieval_mode == "dense":
            for chunk, score in dense_results[:fetch_k]:
                final_ranked_chunks.append({
                    "chunk": chunk,
                    "retrieval_score": round(float(score), 4),
                    "dense_score": round(float(score), 4),
                    "bm25_score": None,
                    "retrieval_method": "dense",
                    "matched_keywords": [],
                })

        elif retrieval_mode == "bm25":
            max_bm25 = max([item[1] for item in bm25_results], default=1.0)
            for chunk, raw_score, matched in bm25_results[:fetch_k]:
                norm_score = (raw_score / max_bm25) if max_bm25 > 0 else 0.0
                final_ranked_chunks.append({
                    "chunk": chunk,
                    "retrieval_score": round(float(norm_score), 4),
                    "dense_score": None,
                    "bm25_score": round(float(raw_score), 4),
                    "retrieval_method": "bm25",
                    "matched_keywords": matched,
                })

        else:
            # Hybrid Fusion (RRF or Weighted)
            final_ranked_chunks = self._fuse_hybrid_results(
                dense_results=dense_results,
                bm25_results=bm25_results,
                alpha=hybrid_alpha,
                method=method,
                top_k=fetch_k,
            )

        if settings.reranker_enabled and len(final_ranked_chunks) > 1:
            scores = get_reranker_service().score(query, [it["chunk"].text for it in final_ranked_chunks])
            for it, s in zip(final_ranked_chunks, scores):
                it["retrieval_score"] = round(s, 4)
                it["retrieval_method"] = f"{it.get('retrieval_method', retrieval_mode)}+rerank"
            final_ranked_chunks.sort(key=lambda it: it["retrieval_score"], reverse=True)

        # 7. Format Evidence Chunk Responses
        results: List[EvidenceChunkResponse] = []
        for item in final_ranked_chunks[:k]:
            chunk: DocumentChunkModel = item["chunk"]
            filename = doc_filename_map.get(
                chunk.document_id, f"doc_{chunk.document_id[:8]}.pdf"
            )
            results.append(
                EvidenceChunkResponse(
                    document_id=chunk.document_id,
                    source_filename=filename,
                    page_number=chunk.page_number,
                    chunk_id=chunk.id,
                    chunk_text=chunk.text,
                    retrieval_score=item["retrieval_score"],
                    dense_score=item.get("dense_score"),
                    bm25_score=item.get("bm25_score"),
                    retrieval_method=item.get("retrieval_method", "hybrid"),
                    matched_keywords=item.get("matched_keywords", []),
                    is_ocr=getattr(chunk, "is_ocr", False),
                    extraction_method=getattr(chunk, "extraction_method", "native"),
                    ocr_confidence=getattr(chunk, "ocr_confidence", None),
                    needs_review=getattr(chunk, "needs_review", False),
                )
            )

        logger.info(
            f"Retrieved {len(results)} evidence chunks using {retrieval_mode.upper()} "
            f"for query '{query[:40]}...' (top_k={k})"
        )
        return results

    def _fuse_hybrid_results(
        self,
        dense_results: List[Tuple[DocumentChunkModel, float]],
        bm25_results: List[Tuple[DocumentChunkModel, float, List[str]]],
        alpha: float,
        method: str,
        top_k: int,
    ) -> List[Dict[str, any]]:
        """
        Fuses dense and sparse rankings using Reciprocal Rank Fusion (RRF)
        or Min-Max Normalized Weighted Combination.
        """
        chunk_map: Dict[str, DocumentChunkModel] = {}
        dense_scores_map: Dict[str, float] = {}
        dense_rank_map: Dict[str, int] = {}

        for rank, (chunk, score) in enumerate(dense_results, start=1):
            chunk_map[chunk.id] = chunk
            dense_scores_map[chunk.id] = float(score)
            dense_rank_map[chunk.id] = rank

        bm25_scores_map: Dict[str, float] = {}
        bm25_rank_map: Dict[str, int] = {}
        matched_kw_map: Dict[str, List[str]] = {}

        for rank, (chunk, score, matched) in enumerate(bm25_results, start=1):
            chunk_map[chunk.id] = chunk
            bm25_scores_map[chunk.id] = float(score)
            bm25_rank_map[chunk.id] = rank
            matched_kw_map[chunk.id] = matched

        all_chunk_ids = list(chunk_map.keys())
        if not all_chunk_ids:
            return []

        rrf_k = settings.retrieval_rrf_k
        max_dense = max(dense_scores_map.values(), default=1.0)
        max_bm25 = max(bm25_scores_map.values(), default=1.0)

        scored_items: List[Dict[str, any]] = []

        for cid in all_chunk_ids:
            chunk = chunk_map[cid]
            d_score = dense_scores_map.get(cid, 0.0)
            b_score = bm25_scores_map.get(cid, 0.0)
            matched = matched_kw_map.get(cid, [])

            if method == "rrf":
                # Reciprocal Rank Fusion
                rrf_dense = (
                    alpha / (rrf_k + dense_rank_map[cid])
                    if cid in dense_rank_map
                    else 0.0
                )
                rrf_bm25 = (
                    (1.0 - alpha) / (rrf_k + bm25_rank_map[cid])
                    if cid in bm25_rank_map
                    else 0.0
                )
                fused_raw = rrf_dense + rrf_bm25
                scored_items.append({
                    "chunk": chunk,
                    "fused_raw": fused_raw,
                    "dense_score": round(d_score, 4),
                    "bm25_score": round(b_score, 4),
                    "matched_keywords": matched,
                })
            else:
                # Weighted Linear Combination with normalized scores
                norm_d = max(0.0, d_score / max_dense) if max_dense > 0 else 0.0
                norm_b = max(0.0, b_score / max_bm25) if max_bm25 > 0 else 0.0
                fused = alpha * norm_d + (1.0 - alpha) * norm_b
                scored_items.append({
                    "chunk": chunk,
                    "fused_raw": fused,
                    "dense_score": round(d_score, 4),
                    "bm25_score": round(b_score, 4),
                    "matched_keywords": matched,
                })

        # Sort descending by fused score
        scored_items.sort(key=lambda item: item["fused_raw"], reverse=True)

        # Normalize fused scores for transparent UI display (0.0 to 1.0)
        max_fused = max([item["fused_raw"] for item in scored_items], default=1.0)
        for item in scored_items:
            norm_retrieval = (item["fused_raw"] / max_fused) if max_fused > 0 else 0.0
            item["retrieval_score"] = round(float(norm_retrieval), 4)
            item["retrieval_method"] = "hybrid"

        return scored_items[:top_k]

    async def _search_vector_or_exact(
        self,
        query_embedding: List[float],
        document_id: Optional[str],
        chunks: List[DocumentChunkModel],
        k: int,
    ) -> List[Tuple[DocumentChunkModel, float]]:
        """
        Attempts MongoDB Atlas $vectorSearch pipeline first.
        If the vector index is unconfigured or unsupported on the cluster,
        falls back to exact-cosine-similarity baseline over document chunks.
        """
        try:
            vector_results = await self._try_atlas_vector_search(
                query_embedding=query_embedding,
                document_id=document_id,
                k=k,
            )
            if vector_results is not None:
                return vector_results
        except Exception as exc:
            logger.debug(
                f"Atlas $vectorSearch unavailable ({exc}); using exact cosine similarity baseline."
            )

        # Exact Cosine Similarity Baseline over preloaded chunks
        return await asyncio.to_thread(
            self._exact_cosine_similarity_retrieval,
            query_embedding=query_embedding,
            chunks=chunks,
            k=k,
        )

    async def _try_atlas_vector_search(
        self,
        query_embedding: List[float],
        document_id: Optional[str],
        k: int,
    ) -> Optional[List[Tuple[DocumentChunkModel, float]]]:
        """
        Runs MongoDB Atlas $vectorSearch aggregation stage if configured.
        """
        if not getattr(self.chunk_repository, "collection", None):
            return None

        filter_dict: dict = {}
        if document_id:
            filter_dict["document_id"] = document_id

        pipeline = [
            {
                "$vectorSearch": {
                    "index": self.vector_index_name,
                    "path": "embedding",
                    "queryVector": query_embedding,
                    "numCandidates": k * 10,
                    "limit": k,
                    **({"filter": filter_dict} if filter_dict else {}),
                }
            },
            {
                "$project": {
                    "id": 1,
                    "document_id": 1,
                    "page_number": 1,
                    "chunk_index": 1,
                    "text": 1,
                    "embedding": 1,
                    "char_count": 1,
                    "score": {"$meta": "vectorSearchScore"},
                }
            },
        ]

        cursor = self.chunk_repository.collection.aggregate(pipeline)
        results: List[Tuple[DocumentChunkModel, float]] = []
        async for doc in cursor:
            score = float(doc.pop("score", 0.0))
            doc.pop("_id", None)
            chunk = DocumentChunkModel.model_validate(doc)
            results.append((chunk, score))

        return results if results else None

    def _exact_cosine_similarity_retrieval(
        self,
        query_embedding: List[float],
        chunks: List[DocumentChunkModel],
        k: int,
    ) -> List[Tuple[DocumentChunkModel, float]]:
        """
        Deterministic, exact cosine-similarity baseline:
        Computes dot products of normalized vectors and ranks top K.
        """
        if not chunks:
            return []

        scored_chunks: List[Tuple[DocumentChunkModel, float]] = []
        for chunk in chunks:
            if not chunk.embedding or len(chunk.embedding) != len(query_embedding):
                score = 0.0
            else:
                score = self.embedding_service.compute_cosine_similarity(
                    query_embedding, chunk.embedding
                )
            scored_chunks.append((chunk, score))

        # Sort by similarity score descending
        scored_chunks.sort(key=lambda pair: pair[1], reverse=True)
        return scored_chunks[:k]
