"""
Evidence Retrieval service implementing exact-cosine-similarity baseline
with Atlas Vector Search fall-through capability.
"""

from __future__ import annotations

from typing import Dict, List, Optional
from fastapi import HTTPException, status

from app.config import settings
from app.models.chunk import DocumentChunkModel
from app.repositories.chunk_repository import ChunkRepository
from app.repositories.document_repository import DocumentRepository
from app.schemas.retrieval import EvidenceChunkResponse
from app.services.embedding_service import EmbeddingService, get_embedding_service
from app.utils.logging import logger


class RetrievalService:
    """
    Retrieves supporting evidence chunks for financial claims using dense vector embeddings.
    """

    def __init__(
        self,
        embedding_service: Optional[EmbeddingService] = None,
        chunk_repository: Optional[ChunkRepository] = None,
        document_repository: Optional[DocumentRepository] = None,
    ):
        self.embedding_service = embedding_service or get_embedding_service()
        self.chunk_repository = chunk_repository or ChunkRepository()
        self.document_repository = document_repository or DocumentRepository()
        self.vector_index_name = "vector_index"

    async def retrieve_evidence(
        self,
        query: str,
        document_id: Optional[str] = None,
        top_k: Optional[int] = None,
    ) -> List[EvidenceChunkResponse]:
        """
        Retrieves top K evidence chunks for a query string.
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
            # Map known documents for source filename resolution
            try:
                all_docs = await self.document_repository.list_documents(limit=100)
                for d in all_docs:
                    doc_filename_map[d.id] = d.filename
            except Exception as exc:
                logger.warning(f"Unable to load document metadata map: {exc}")

        # 3. Verify embedding model health
        if not self.embedding_service.is_healthy():
            logger.error("Embedding service is not available for evidence retrieval.")
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Embedding service is currently unavailable or failed to initialize.",
            )

        # 4. Generate query embedding
        try:
            query_embedding = self.embedding_service.generate_embedding(query)
        except Exception as exc:
            logger.error(f"Failed to generate query embedding: {exc}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to generate query embedding: {exc}",
            )

        # 5. Attempt Atlas Vector Search or fall back to Exact Cosine Similarity
        chunks_with_scores = await self._search_vector_or_exact(
            query_embedding=query_embedding,
            document_id=document_id,
            k=k,
        )

        # 6. Format and trace results
        results: List[EvidenceChunkResponse] = []
        for chunk, score in chunks_with_scores:
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
                    retrieval_score=round(float(score), 4),
                    is_ocr=getattr(chunk, "is_ocr", False),
                    extraction_method=getattr(chunk, "extraction_method", "native"),
                    ocr_confidence=getattr(chunk, "ocr_confidence", None),
                    needs_review=getattr(chunk, "needs_review", False),
                )
            )

        logger.info(
            f"Retrieved {len(results)} evidence chunks for query '{query[:40]}...' (top_k={k})"
        )
        return results

    async def _search_vector_or_exact(
        self,
        query_embedding: List[float],
        document_id: Optional[str],
        k: int,
    ) -> List[tuple[DocumentChunkModel, float]]:
        """
        Attempts MongoDB Atlas $vectorSearch pipeline first.
        If the vector index is unconfigured or unsupported on the cluster,
        falls back to exact-cosine-similarity baseline over document chunks.
        """
        # Try Atlas $vectorSearch pipeline if possible
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

        # Exact Cosine Similarity Baseline
        return await self._exact_cosine_similarity_retrieval(
            query_embedding=query_embedding,
            document_id=document_id,
            k=k,
        )

    async def _try_atlas_vector_search(
        self,
        query_embedding: List[float],
        document_id: Optional[str],
        k: int,
    ) -> Optional[List[tuple[DocumentChunkModel, float]]]:
        """
        Runs MongoDB Atlas $vectorSearch aggregation stage if configured.
        Returns None if index does not exist or cluster doesn't support $vectorSearch.
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
        results: List[tuple[DocumentChunkModel, float]] = []
        async for doc in cursor:
            score = float(doc.pop("score", 0.0))
            doc.pop("_id", None)
            chunk = DocumentChunkModel.model_validate(doc)
            results.append((chunk, score))

        return results if results else None

    async def _exact_cosine_similarity_retrieval(
        self,
        query_embedding: List[float],
        document_id: Optional[str],
        k: int,
    ) -> List[tuple[DocumentChunkModel, float]]:
        """
        Deterministic, exact cosine-similarity baseline:
        Loads stored chunks for the target document (or all chunks),
        computes dot products of normalized vectors, and ranks top K.
        """
        if document_id:
            chunks = await self.chunk_repository.get_chunks_by_document(document_id)
        else:
            chunks = await self.chunk_repository.get_all_chunks(limit=1000)

        if not chunks:
            logger.info(f"No chunks available in repository for document '{document_id}'.")
            return []

        scored_chunks: List[tuple[DocumentChunkModel, float]] = []
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
