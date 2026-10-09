"""
Document upload and management endpoints.
"""

from fastapi import APIRouter, Depends, File, UploadFile
from app.schemas.document import DocumentResponse
from app.services.document_service import DocumentService

router = APIRouter(prefix="/api/documents", tags=["Documents"])


def get_document_service() -> DocumentService:
    return DocumentService()


@router.post("/upload", response_model=DocumentResponse)
async def upload_document(
    file: UploadFile = File(..., description="PDF document to verify"),
    service: DocumentService = Depends(get_document_service),
) -> DocumentResponse:
    """
    Uploads a financial PDF document.
    Validates MIME type, extension, size, and magic bytes before saving.
    """
    return await service.process_and_save_upload(file=file)


@router.get("/{document_id}", response_model=DocumentResponse)
async def get_document(
    document_id: str,
    service: DocumentService = Depends(get_document_service),
) -> DocumentResponse:
    """Retrieves document metadata by ID."""
    return await service.get_document(document_id)


@router.get("/{document_id}/file")
async def get_document_file(
    document_id: str,
    service: DocumentService = Depends(get_document_service),
):
    """Returns the raw PDF file for in-browser PDF viewing."""
    return await service.get_document_file(document_id)


@router.get("/{document_id}/tables")
async def get_document_tables(
    document_id: str,
    service: DocumentService = Depends(get_document_service),
):
    """Returns all structured financial tables extracted from the document."""
    return await service.get_document_tables(document_id)
