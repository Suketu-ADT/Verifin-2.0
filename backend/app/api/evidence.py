"""
API routes for Evidence Retrieval and Document Chunks.
"""

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.repositories.chunk_repository import ChunkRepository
from app.repositories.document_repository import DocumentRepository
from app.schemas.retrieval import (
    DocumentChunksResponse,
    EvidenceChunkResponse,
    EvidenceRetrievalRequest,
    EvidenceRetrievalResponse,
)
from app.services.retrieval_service import RetrievalService

router = APIRouter(tags=["Evidence & Retrieval"])


def get_retrieval_service() -> RetrievalService:
    return RetrievalService()


def get_document_repository() -> DocumentRepository:
    return DocumentRepository()


def get_chunk_repository() -> ChunkRepository:
    return ChunkRepository()


@router.post(
    "/api/evidence/retrieve",
    response_model=EvidenceRetrievalResponse,
    summary="Retrieve top-K evidence chunks for a financial claim",
)
async def retrieve_evidence(
    request: EvidenceRetrievalRequest,
    service: RetrievalService = Depends(get_retrieval_service),
) -> EvidenceRetrievalResponse:
    """
    Finds the most relevant evidence chunks for an input claim or query
    using dense vector embeddings and cosine similarity ranking.
    """
    evidence = await service.retrieve_evidence(
        query=request.query,
        document_id=request.document_id,
        top_k=request.top_k,
    )
    return EvidenceRetrievalResponse(
        query=request.query,
        total_retrieved=len(evidence),
        evidence=evidence,
    )


@router.post(
    "/api/documents/{document_id}/retrieve",
    response_model=EvidenceRetrievalResponse,
    summary="Retrieve top-K evidence chunks for a financial claim within a specific document",
)
async def retrieve_document_evidence(
    document_id: str,
    request: EvidenceRetrievalRequest,
    service: RetrievalService = Depends(get_retrieval_service),
) -> EvidenceRetrievalResponse:
    """
    Constrains evidence retrieval to the specified document ID.
    """
    evidence = await service.retrieve_evidence(
        query=request.query,
        document_id=document_id,
        top_k=request.top_k,
    )
    return EvidenceRetrievalResponse(
        query=request.query,
        total_retrieved=len(evidence),
        evidence=evidence,
    )


@router.get(
    "/api/documents/{document_id}/chunks",
    response_model=DocumentChunksResponse,
    summary="Get all extracted chunks for a document",
)
async def get_document_chunks(
    document_id: str,
    doc_repo: DocumentRepository = Depends(get_document_repository),
    chunk_repo: ChunkRepository = Depends(get_chunk_repository),
) -> DocumentChunksResponse:
    """
    Returns all extracted textual chunks and page associations for a document.
    """
    doc = await doc_repo.get_document_by_id(document_id)
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Document with ID '{document_id}' not found.",
        )

    chunks = await chunk_repo.get_chunks_by_document(document_id)
    evidence_chunks = [
        EvidenceChunkResponse(
            document_id=c.document_id,
            source_filename=doc.filename,
            page_number=c.page_number,
            chunk_id=c.id,
            chunk_text=c.text,
            retrieval_score=1.0,
            is_ocr=getattr(c, "is_ocr", False),
            extraction_method=getattr(c, "extraction_method", "native"),
            ocr_confidence=getattr(c, "ocr_confidence", None),
            needs_review=getattr(c, "needs_review", False),
        )
        for c in chunks
    ]

    return DocumentChunksResponse(
        document_id=document_id,
        total_chunks=len(evidence_chunks),
        chunks=evidence_chunks,
    )
