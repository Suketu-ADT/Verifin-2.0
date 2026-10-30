"""
API routes for Evidence Retrieval and Document Chunks.
"""

from fastapi import APIRouter, Depends, HTTPException, status

from app.repositories.chunk_repository import ChunkRepository
from app.repositories.document_repository import DocumentRepository
from app.schemas.retrieval import (
    DocumentChunksResponse,
    EvidenceChunkResponse,
    EvidenceRetrievalRequest,
    EvidenceRetrievalResponse,
)
from app.config import settings
from app.security import Principal, require_role
from app.security.access import authorize_document
from app.services.retrieval_service import RetrievalService

router = APIRouter(tags=["Evidence & Retrieval"])


def get_retrieval_service() -> RetrievalService:
    return RetrievalService()


def get_document_repository() -> DocumentRepository:
    return DocumentRepository()


def get_chunk_repository() -> ChunkRepository:
    return ChunkRepository()


@router.post(
    "/evidence/retrieve",
    response_model=EvidenceRetrievalResponse,
    summary="Retrieve top-K evidence chunks for a financial claim",
)
async def retrieve_evidence(
    request: EvidenceRetrievalRequest,
    principal: Principal = Depends(require_role("viewer")),
    service: RetrievalService = Depends(get_retrieval_service),
) -> EvidenceRetrievalResponse:
    """
    Finds the most relevant evidence chunks for an input claim or query
    using dense vector embeddings and cosine similarity ranking.
    """
    if settings.auth_enabled:
        if not request.document_id:
            # searching every document would cross tenant boundaries
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="document_id is required.")
        await authorize_document(request.document_id, principal)
    evidence = await service.retrieve_evidence(
        query=request.query,
        document_id=request.document_id,
        top_k=request.top_k,
        mode=request.mode,
        alpha=request.alpha,
        fusion_method=request.fusion_method,
    )
    return EvidenceRetrievalResponse(
        query=request.query,
        total_retrieved=len(evidence),
        evidence=evidence,
    )


@router.post(
    "/documents/{document_id}/retrieve",
    response_model=EvidenceRetrievalResponse,
    summary="Retrieve top-K evidence chunks for a financial claim within a specific document",
)
async def retrieve_document_evidence(
    document_id: str,
    request: EvidenceRetrievalRequest,
    principal: Principal = Depends(require_role("viewer")),
    service: RetrievalService = Depends(get_retrieval_service),
) -> EvidenceRetrievalResponse:
    """
    Constrains evidence retrieval to the specified document ID.
    """
    if settings.auth_enabled:
        await authorize_document(document_id, principal)
    evidence = await service.retrieve_evidence(
        query=request.query,
        document_id=document_id,
        top_k=request.top_k,
        mode=request.mode,
        alpha=request.alpha,
        fusion_method=request.fusion_method,
    )
    return EvidenceRetrievalResponse(
        query=request.query,
        total_retrieved=len(evidence),
        evidence=evidence,
    )


@router.get(
    "/documents/{document_id}/chunks",
    response_model=DocumentChunksResponse,
    summary="Get all extracted chunks for a document",
)
async def get_document_chunks(
    document_id: str,
    principal: Principal = Depends(require_role("viewer")),
    doc_repo: DocumentRepository = Depends(get_document_repository),
    chunk_repo: ChunkRepository = Depends(get_chunk_repository),
) -> DocumentChunksResponse:
    """
    Returns all extracted textual chunks and page associations for a document.
    """
    doc = await authorize_document(document_id, principal, doc_repo)
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
