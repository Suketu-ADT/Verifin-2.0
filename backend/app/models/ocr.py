"""
OCR models representing extracted text, word-level coordinates, confidence scores,
and page-level OCR outcomes for scanned financial documents.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class OCRBoundingBox(BaseModel):
    """Coordinates of an OCR extracted word or region."""
    x0: float = Field(..., description="Left coordinate in PDF points or pixels")
    top: float = Field(..., description="Top coordinate in PDF points or pixels")
    x1: float = Field(..., description="Right coordinate in PDF points or pixels")
    bottom: float = Field(..., description="Bottom coordinate in PDF points or pixels")
    width: float = Field(..., description="Width")
    height: float = Field(..., description="Height")
    # Normalized coordinates (0.0 to 1.0) for resolution-independent rendering
    rel_x0: float = Field(default=0.0, description="Normalized 0-1 left coordinate")
    rel_top: float = Field(default=0.0, description="Normalized 0-1 top coordinate")
    rel_width: float = Field(default=0.0, description="Normalized 0-1 width")
    rel_height: float = Field(default=0.0, description="Normalized 0-1 height")


class OCRWord(BaseModel):
    """Individual word extracted via OCR with position and confidence."""
    text: str = Field(..., description="Verbatim extracted word token")
    confidence: float = Field(..., description="Tesseract confidence score 0-100")
    bbox: OCRBoundingBox
    page_number: int = Field(..., description="1-indexed PDF page number")
    block_num: int = Field(default=0, description="OCR block index")
    line_num: int = Field(default=0, description="OCR line index within block")
    word_num: int = Field(default=0, description="OCR word index within line")

    @property
    def is_uncertain(self) -> bool:
        """True if confidence is below 60%."""
        return self.confidence < 60.0


class OCRPageResult(BaseModel):
    """Aggregated OCR result for a single scanned PDF page."""
    page_number: int
    text: str = Field(default="", description="Full reconstructed page text")
    words: List[OCRWord] = Field(default_factory=list, description="Word tokens with positions")
    mean_confidence: float = Field(default=0.0, description="Average OCR confidence across words")
    is_ocr: bool = Field(default=True, description="True since derived via OCR")
    extraction_method: str = Field(default="ocr", description="'ocr' vs 'native'")
    image_count: int = Field(default=1, description="Number of images found on page")
    needs_review: bool = Field(default=False, description="Flagged for manual review if low confidence")
    error: Optional[str] = Field(default=None, description="Error message if OCR failed")
