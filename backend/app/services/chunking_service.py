"""
Chunking service for extracting, cleaning, and partitioning text from financial PDFs.
"""

from __future__ import annotations

import io
import re
from typing import List, Optional

from app.config import settings
from app.models.chunk import DocumentChunkModel
from app.services.embedding_service import EmbeddingService, get_embedding_service
from app.services.ocr_service import OCRService, get_ocr_service
from app.utils.logging import logger

try:
    from pypdf import PdfReader
except ImportError:
    PdfReader = None  # type: ignore


class ChunkingService:
    """
    Extracts text page-by-page from PDFs and splits into overlapping chunks with metadata.
    Supports hybrid ingestion with selective OCR for scanned or image-only pages.
    """

    def __init__(
        self,
        chunk_size: Optional[int] = None,
        chunk_overlap: Optional[int] = None,
        embedding_service: Optional[EmbeddingService] = None,
        ocr_service: Optional[OCRService] = None,
    ):
        self.chunk_size = chunk_size or settings.chunk_size_chars
        self.chunk_overlap = chunk_overlap or settings.chunk_overlap_chars
        self.embedding_service = embedding_service or get_embedding_service()
        self.ocr_service = ocr_service or get_ocr_service()

    def clean_text(self, text: str) -> str:
        """Standardizes whitespace, strips null characters, and normalizes hyphens."""
        if not text:
            return ""
        # Remove null or non-printable control chars except newlines/tabs
        cleaned = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]", "", text)
        # Normalize multiple spaces and tabs to single spaces
        cleaned = re.sub(r"[ \t]+", " ", cleaned)
        # Normalize excessive newlines
        cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)
        return cleaned.strip()

    def split_text_into_chunks(self, text: str) -> List[str]:
        """
        Splits a text string into overlapping chunks respecting sentence/paragraph boundaries
        where possible, falling back to character boundaries.
        """
        cleaned = self.clean_text(text)
        if not cleaned:
            return []

        if len(cleaned) <= self.chunk_size:
            return [cleaned]

        chunks: List[str] = []
        start = 0
        text_len = len(cleaned)

        while start < text_len:
            end = start + self.chunk_size
            if end >= text_len:
                chunks.append(cleaned[start:].strip())
                break

            # Try to break at a paragraph boundary
            break_point = cleaned.rfind("\n\n", start, end)
            if break_point != -1 and break_point > start + (self.chunk_size // 2):
                end = break_point + 2
            else:
                # Try to break at sentence punctuation (.!?)
                punct_match = None
                for p in [". ", "? ", "! "]:
                    p_pos = cleaned.rfind(p, start, end)
                    if p_pos != -1 and p_pos > start + (self.chunk_size // 2):
                        if punct_match is None or p_pos > punct_match:
                            punct_match = p_pos + 1
                if punct_match is not None:
                    end = punct_match
                else:
                    # Try to break at space
                    space_pos = cleaned.rfind(" ", start, end)
                    if space_pos != -1 and space_pos > start + (self.chunk_size // 3):
                        end = space_pos

            chunk_candidate = cleaned[start:end].strip()
            if chunk_candidate:
                chunks.append(chunk_candidate)

            # Advance by step size (chunk_size - chunk_overlap)
            step = max(1, end - start - self.chunk_overlap)
            start += step

        return chunks

    def extract_chunks_from_pdf_bytes(
        self,
        pdf_bytes: bytes,
        document_id: str,
        generate_embeddings: bool = True,
    ) -> List[DocumentChunkModel]:
        """
        Reads PDF bytes page by page, extracts textual passages, partitions into chunks,
        and optionally computes embeddings.
        """
        if PdfReader is None:
            logger.error("pypdf is not available for extracting PDF chunks.")
            return []

        try:
            reader = PdfReader(io.BytesIO(pdf_bytes))
        except Exception as exc:
            logger.error(f"Failed to read PDF for document {document_id}: {exc}")
            return []

        raw_chunks: List[dict] = []
        chunk_idx = 0

        for page_idx, page in enumerate(reader.pages):
            page_number = page_idx + 1  # 1-indexed
            try:
                native_text = page.extract_text() or ""
            except Exception as exc:
                logger.warning(
                    f"Error extracting text from page {page_number} of doc {document_id}: {exc}"
                )
                native_text = ""

            image_count = len(getattr(page, "images", [])) if hasattr(page, "images") else 0
            is_scanned = self.ocr_service.detect_scanned_page(native_text, image_count=image_count)

            page_text = native_text
            is_ocr = False
            extraction_method = "native"
            ocr_conf = None
            needs_review = False
            ocr_words = None

            # Only invoke OCR if page is scanned or lacks extractable digital text
            # This explicitly prevents duplicate content when a page has a text layer and images
            if is_scanned and self.ocr_service.is_available():
                logger.info(
                    f"Page {page_number} of doc {document_id} detected as scanned image. Invoking OCR service."
                )
                page_img = self.ocr_service.render_pdf_page_to_image(pdf_bytes, page_number)
                if page_img:
                    ocr_res = self.ocr_service.ocr_page_image(page_img, page_number)
                    if ocr_res.text:
                        page_text = ocr_res.text
                        is_ocr = True
                        extraction_method = "ocr"
                        ocr_conf = ocr_res.mean_confidence
                        needs_review = ocr_res.needs_review
                        ocr_words = [w.model_dump() for w in ocr_res.words]

            page_chunks = self.split_text_into_chunks(page_text)
            for text_chunk in page_chunks:
                chunk_id = f"{document_id}_p{page_number}_c{chunk_idx}"
                raw_chunks.append({
                    "id": chunk_id,
                    "document_id": document_id,
                    "page_number": page_number,
                    "chunk_index": chunk_idx,
                    "text": text_chunk,
                    "char_count": len(text_chunk),
                    "is_ocr": is_ocr,
                    "extraction_method": extraction_method,
                    "ocr_confidence": ocr_conf,
                    "needs_review": needs_review,
                    "words": ocr_words,
                })
                chunk_idx += 1

        if not raw_chunks:
            logger.warning(f"No textual chunks extracted from document {document_id}.")
            return []

        # Generate embeddings if requested and embedding service is healthy
        embeddings: List[List[float]] = []
        if generate_embeddings and self.embedding_service.is_healthy():
            try:
                texts = [item["text"] for item in raw_chunks]
                embeddings = self.embedding_service.generate_embeddings(texts)
                logger.info(
                    f"Generated {len(embeddings)} embeddings for document {document_id}."
                )
            except Exception as exc:
                logger.warning(
                    f"Failed to generate embeddings during chunk extraction for {document_id}: {exc}"
                )
                embeddings = [[0.0] * self.embedding_service.dimension] * len(raw_chunks)
        else:
            embeddings = [[0.0] * self.embedding_service.dimension] * len(raw_chunks)

        chunk_models: List[DocumentChunkModel] = []
        for i, item in enumerate(raw_chunks):
            emb = embeddings[i] if i < len(embeddings) else [0.0] * self.embedding_service.dimension
            chunk_models.append(
                DocumentChunkModel(
                    id=item["id"],
                    document_id=item["document_id"],
                    page_number=item["page_number"],
                    chunk_index=item["chunk_index"],
                    text=item["text"],
                    embedding=emb,
                    char_count=item["char_count"],
                    is_ocr=item["is_ocr"],
                    extraction_method=item["extraction_method"],
                    ocr_confidence=item["ocr_confidence"],
                    needs_review=item["needs_review"],
                    words=item["words"],
                )
            )

        return chunk_models
