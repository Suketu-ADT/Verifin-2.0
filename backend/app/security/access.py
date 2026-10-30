"""
Tenant isolation: a caller can only see documents and sessions of their own organisation.

A resource of another tenant is reported as "not found", never "forbidden", so its existence is not revealed.
"""

from __future__ import annotations

from typing import Optional

from fastapi import HTTPException, status

from app.models.document import DocumentModel
from app.repositories.document_repository import DocumentRepository
from app.security.principal import Principal


async def authorize_document(
    document_id: str, principal: Principal, repository: Optional[DocumentRepository] = None
) -> DocumentModel:
    repo = repository or DocumentRepository()
    try:
        document = await repo.get_document_by_id(document_id)
    except ConnectionError:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Database unavailable.")
    if document is None or document.tenant_id != principal.tenant_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Document with ID '{document_id}' not found.")
    return document
