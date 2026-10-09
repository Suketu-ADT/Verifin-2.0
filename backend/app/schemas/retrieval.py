"""
Pydantic schemas for Evidence Retrieval and Embeddings.
"""

from typing import List, Optional
from pydantic import BaseModel, Field


class EvidenceChunkResponse(BaseModel):
    """A retrieved evidence chunk with source traceability and similarity score."""

    document_id: str = Field(..., description="ID of source document")
    source_filename: str = Field(..., description="Original filename of the source PDF")
    page_number: int = Field(..., description="1-indexed PDF page number where text was found")
    chunk_id: str = Field(..., description="Unique chunk identifier")
    chunk_text: str = Field(..., description="Textual passage retrieved as evidence")
    retrieval_score: float = Field(..., description="Cosine similarity score (0.0 to 1.0)")
    is_ocr: bool = Field(default=False, description="True if passage was extracted via OCR")
    extraction_method: str = Field(default="native", description="'native' or 'ocr'")
    ocr_confidence: Optional[float] = Field(default=None, description="Mean OCR confidence 0-100")
    needs_review: bool = Field(default=False, description="Flagged for manual review if low OCR confidence")


class EvidenceRetrievalRequest(BaseModel):
    """Request payload for finding supporting evidence chunks for a financial claim."""

    query: str = Field(..., min_length=1, description="Financial claim or query string")
    document_id: Optional[str] = Field(None, description="Optional target document ID to constrain search")
    top_k: Optional[int] = Field(None, ge=1, le=50, description="Number of top evidence chunks to retrieve")


class EvidenceRetrievalResponse(BaseModel):
    """Response containing retrieved top-K evidence chunks."""

    query: str = Field(..., description="The queried financial claim")
    total_retrieved: int = Field(..., description="Number of evidence chunks retrieved")
    evidence: List[EvidenceChunkResponse] = Field(default_factory=list, description="Ranked evidence chunks")


class DocumentChunksResponse(BaseModel):
    """Response containing all extracted chunks of a document."""

    document_id: str
    total_chunks: int
    chunks: List[EvidenceChunkResponse]
