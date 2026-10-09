"""
Document chunk model representing extracted text passages and their vector embeddings.
"""

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class DocumentChunkModel(BaseModel):
    id: str = Field(..., description="Unique chunk ID e.g. doc123_p1_c0")
    document_id: str = Field(..., description="Foreign key to DocumentModel.id")
    page_number: int = Field(..., description="1-indexed PDF page number")
    chunk_index: int = Field(..., description="0-indexed chunk position within document/page")
    text: str = Field(..., description="Cleaned textual passage content")
    embedding: List[float] = Field(default_factory=list, description="Dense vector embedding")
    char_count: int = Field(default=0, description="Length of text chunk in characters")
    is_ocr: bool = Field(default=False, description="True if extracted via OCR instead of native PDF text")
    extraction_method: str = Field(default="native", description="'native' or 'ocr'")
    ocr_confidence: Optional[float] = Field(default=None, description="Average OCR confidence 0-100 if OCR")
    needs_review: bool = Field(default=False, description="Flagged for manual review if low OCR confidence")
    words: Optional[List[Dict[str, Any]]] = Field(default=None, description="Word tokens with positions and confidence")
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
