"""
Document service handling file validation, storage abstraction, and metadata persistence.
"""

import io
import uuid
from pathlib import Path
from typing import Optional
from fastapi import HTTPException, UploadFile, status

from app.config import settings
from app.models.document import DocumentModel
from app.repositories.document_repository import DocumentRepository
from app.repositories.chunk_repository import ChunkRepository
from app.repositories.table_repository import TableRepository
from app.schemas.document import DocumentResponse
from app.services.chunking_service import ChunkingService
from app.services.table_extractor import TableExtractionService
from app.utils.logging import logger

try:
    from pypdf import PdfReader
except ImportError:
    PdfReader = None  # type: ignore


class StorageBackend:
    """
    Filesystem storage abstraction. Can be easily substituted or extended
    with an S3/Cloud Storage implementation in subsequent phases.
    """

    def __init__(self, upload_dir: Path):
        self.upload_dir = upload_dir

    async def save(self, file_content: bytes, filename: str) -> str:
        """Saves file content to disk and returns absolute path string."""
        destination = self.upload_dir / filename
        destination.write_bytes(file_content)
        return str(destination)

    async def exists(self, filename: str) -> bool:
        return (self.upload_dir / filename).exists()


class DocumentService:
    def __init__(
        self,
        repository: Optional[DocumentRepository] = None,
        storage: Optional[StorageBackend] = None,
        chunk_repository: Optional[ChunkRepository] = None,
        chunking_service: Optional[ChunkingService] = None,
        table_repository: Optional[TableRepository] = None,
        table_extractor: Optional[TableExtractionService] = None,
    ):
        self.repository = repository or DocumentRepository()
        self.storage = storage or StorageBackend(settings.upload_path)
        self.chunk_repository = chunk_repository or ChunkRepository()
        self.chunking_service = chunking_service or ChunkingService()
        self.table_repository = table_repository or TableRepository()
        self.table_extractor = table_extractor or TableExtractionService()


    async def process_and_save_upload(
        self, file: UploadFile, user_id: Optional[str] = None
    ) -> DocumentResponse:
        """
        Validates, stores, and registers a PDF document upload.
        """
        filename = file.filename or "unknown.pdf"
        
        # 1. Validate file extension
        if not filename.lower().endswith(".pdf"):
            logger.warning(f"Upload rejected: invalid file extension '{filename}'")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Only PDF documents are accepted.",
            )

        # 2. Validate MIME type
        allowed_mime_types = [
            "application/pdf",
            "application/x-pdf",
            "application/acrobat",
            "applications/vnd.pdf",
            "text/pdf",
        ]
        content_type = file.content_type or ""
        if content_type.lower() not in allowed_mime_types:
            logger.warning(
                f"Upload rejected: invalid MIME type '{content_type}' for '{filename}'"
            )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid MIME type '{content_type}'. Must be a valid PDF.",
            )

        # 3. Read content and validate size
        content = await file.read()
        file_size = len(content)

        if file_size == 0:
            logger.warning(f"Upload rejected: empty file '{filename}'")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Uploaded file is empty (0 bytes).",
            )

        if file_size > settings.max_upload_size_bytes:
            logger.warning(
                f"Upload rejected: size {file_size} exceeds limit {settings.max_upload_size_bytes}"
            )
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"File exceeds maximum allowed size of {settings.max_upload_size_mb} MB.",
            )

        # 4. Validate PDF magic bytes (%PDF-)
        if not content.startswith(b"%PDF-"):
            logger.warning(f"Upload rejected: corrupt/invalid PDF header for '{filename}'")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="File content does not have a valid PDF header.",
            )

        # 5. Extract page count safely
        page_count = 1
        if PdfReader is not None:
            try:
                reader = PdfReader(io.BytesIO(content))
                page_count = max(1, len(reader.pages))
            except Exception as e:
                logger.warning(f"Unable to parse page count for '{filename}': {e}")
                page_count = 1

        # 6. Generate secure document ID and store file
        document_id = str(uuid.uuid4())
        stored_filename = f"{document_id}.pdf"
        saved_path = await self.storage.save(content, stored_filename)

        # 7. Persist document metadata in MongoDB
        doc_model = DocumentModel(
            id=document_id,
            user_id=user_id,
            filename=filename,
            file_type="pdf",
            size=file_size,
            page_count=page_count,
            file_path=saved_path,
            status="uploaded",
        )

        try:
            await self.repository.create_document(doc_model)
        except Exception as exc:
            logger.error(f"Failed to persist document metadata in MongoDB: {exc}")
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Database error while saving document metadata.",
            )

        logger.info(
            f"Document uploaded successfully: ID={document_id}, name='{filename}', size={file_size} bytes, pages={page_count}"
        )

        # 8. Extract text chunks and generate embeddings (Phase 2)
        try:
            chunks = self.chunking_service.extract_chunks_from_pdf_bytes(
                pdf_bytes=content,
                document_id=document_id,
                generate_embeddings=True,
            )
            if chunks:
                inserted_count = await self.chunk_repository.create_chunks(chunks)
                logger.info(
                    f"Indexed {inserted_count} chunks with embeddings for document {document_id}."
                )
        except Exception as exc:
            logger.warning(
                f"Chunking/embedding encountered an issue for document {document_id}: {exc}"
            )

        # 9. Extract structured financial tables (Phase 5)
        try:
            tables = self.table_extractor.extract_tables_from_pdf_bytes(
                pdf_bytes=content,
                document_id=document_id,
            )
            if tables:
                saved_count = await self.table_repository.create_tables(tables)
                logger.info(
                    f"Extracted and persisted {saved_count} financial tables for document {document_id}."
                )
        except Exception as exc:
            logger.warning(
                f"Table extraction encountered an issue for document {document_id}: {exc}"
            )

        return DocumentResponse(
            id=doc_model.id,
            filename=doc_model.filename,
            file_type=doc_model.file_type,
            size=doc_model.size,
            page_count=doc_model.page_count,
            status=doc_model.status,
        )

    async def get_document(self, document_id: str) -> DocumentResponse:
        """Retrieves document metadata by ID."""
        doc = await self.repository.get_document_by_id(document_id)
        if not doc:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Document with ID '{document_id}' not found.",
            )
        return DocumentResponse(
            id=doc.id,
            filename=doc.filename,
            file_type=doc.file_type,
            size=doc.size,
            page_count=doc.page_count,
            status=doc.status,
        )

    async def get_document_file(self, document_id: str):
        """Streams the underlying PDF file for in-browser PDF viewing."""
        from fastapi.responses import FileResponse

        doc = await self.repository.get_document_by_id(document_id)
        if not doc:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Document with ID '{document_id}' not found.",
            )
        file_path = Path(doc.file_path)
        if not file_path.exists():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Underlying PDF file not found on disk.",
            )
        return FileResponse(
            path=str(file_path),
            filename=doc.filename,
            media_type="application/pdf",
        )

    async def get_document_tables(self, document_id: str):
        """Retrieves all structured financial tables extracted from document."""
        return await self.table_repository.get_tables_by_document_id(document_id)

    async def get_document_chunks(self, document_id: str):
        """Retrieves all extracted text chunks and OCR metadata for document."""
        return await self.chunk_repository.get_chunks_by_document(document_id)
