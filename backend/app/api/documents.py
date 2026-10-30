"""
Document upload and management endpoints. Every document belongs to the caller's tenant.
"""

from typing import List

from fastapi import APIRouter, Depends, File, UploadFile
from app.repositories.document_repository import DocumentRepository
from app.schemas.document import DocumentResponse, DocumentExtractFactsResponse
from app.services.audit_service import audit
from app.security import Principal, require_role
from app.security.access import authorize_document
from app.security.rate_limit import limit_heavy
from app.services.document_service import DocumentService

router = APIRouter(prefix="/documents", tags=["Documents"])


def get_document_service() -> DocumentService:
    return DocumentService()


@router.get("", response_model=List[DocumentResponse])
async def list_documents(principal: Principal = Depends(require_role("viewer"))) -> List[DocumentResponse]:
    """Lists the organisation's documents, newest first."""
    docs = await DocumentRepository().list_documents(tenant_id=principal.tenant_id, limit=100)
    return [
        DocumentResponse(id=d.id, filename=d.filename, file_type=d.file_type, size=d.size,
                         page_count=d.page_count, status=d.status)
        for d in docs
    ]


@router.post("/upload", response_model=DocumentResponse, dependencies=[Depends(limit_heavy)])
async def upload_document(
    file: UploadFile = File(..., description="PDF document to verify"),
    principal: Principal = Depends(require_role("analyst")),
    service: DocumentService = Depends(get_document_service),
) -> DocumentResponse:
    """
    Uploads a financial PDF document.
    Validates MIME type, extension, size, and magic bytes before saving.
    """
    result = await service.process_and_save_upload(file=file, user_id=principal.user_id, tenant_id=principal.tenant_id)
    await audit.record_for(principal, "document.upload", resource_type="document", resource_id=result.id,
                           details={"filename": result.filename, "size": getattr(result, "size", None)})
    return result


@router.get("/{document_id}", response_model=DocumentResponse)
async def get_document(
    document_id: str,
    principal: Principal = Depends(require_role("viewer")),
    service: DocumentService = Depends(get_document_service),
) -> DocumentResponse:
    """Retrieves document metadata by ID."""
    await authorize_document(document_id, principal)
    return await service.get_document(document_id)


@router.get("/{document_id}/file")
async def get_document_file(
    document_id: str,
    principal: Principal = Depends(require_role("viewer")),
    service: DocumentService = Depends(get_document_service),
):
    """Returns the raw PDF file for in-browser PDF viewing."""
    await authorize_document(document_id, principal)
    await audit.record_for(principal, "document.download", resource_type="document", resource_id=document_id)
    return await service.get_document_file(document_id)


@router.get("/{document_id}/tables")
async def get_document_tables(
    document_id: str,
    principal: Principal = Depends(require_role("viewer")),
    service: DocumentService = Depends(get_document_service),
):
    """Returns all structured financial tables extracted from the document."""
    await authorize_document(document_id, principal)
    return await service.get_document_tables(document_id)


@router.post("/{document_id}/extract-facts", response_model=DocumentExtractFactsResponse,
             dependencies=[Depends(limit_heavy)])
async def extract_document_facts(
    document_id: str,
    principal: Principal = Depends(require_role("analyst")),
    service: DocumentService = Depends(get_document_service),
) -> DocumentExtractFactsResponse:
    """
    Extracts key financial facts and statements from the uploaded document using the configured LLM.
    """
    await authorize_document(document_id, principal)
    return await service.extract_facts_from_document(document_id)
