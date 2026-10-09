"""
Financial table models representing structured tables extracted from financial PDFs.
Preserves rows, columns, headers, units, currencies, reporting periods, page numbers,
and cell bounding boxes.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class TableBoundingBox(BaseModel):
    x0: float
    top: float
    x1: float
    bottom: float

    @property
    def width(self) -> float:
        return max(0.0, self.x1 - self.x0)

    @property
    def height(self) -> float:
        return max(0.0, self.bottom - self.top)


class TableCellModel(BaseModel):
    raw_text: str
    normalized_value: Optional[float] = None
    is_numeric: bool = False
    currency: Optional[str] = None
    unit_multiplier: float = 1.0
    unit_name: Optional[str] = None
    is_negative: bool = False
    row_idx: int = 0
    col_idx: int = 0
    bbox: Optional[TableBoundingBox] = None
    is_ocr: bool = False
    ocr_confidence: Optional[float] = None
    needs_review: bool = False


class FinancialTableModel(BaseModel):
    id: str = Field(..., description="Unique table ID")
    document_id: str
    page_number: int
    title: Optional[str] = None
    headers: List[str] = Field(default_factory=list)
    reporting_periods: List[Optional[str]] = Field(default_factory=list)
    units: Optional[str] = None
    currency: Optional[str] = None
    rows: List[List[TableCellModel]] = Field(default_factory=list)
    raw_rows: List[List[str]] = Field(default_factory=list)
    bbox: Optional[TableBoundingBox] = None
    is_multi_page: bool = False
    is_ocr: bool = False
    extraction_method: str = "native"
    ocr_confidence: Optional[float] = None
    has_uncertain_cells: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    def to_markdown(self) -> str:
        """Converts table to readable markdown representation for retrieval and reasoning."""
        if not self.headers and not self.rows:
            return ""

        lines = []
        if self.title:
            lines.append(f"### {self.title}")
        if self.units:
            lines.append(f"*(Units: {self.units})*")

        headers = self.headers if self.headers else [f"Col {i+1}" for i in range(len(self.raw_rows[0]) if self.raw_rows else 0)]
        lines.append("| " + " | ".join(headers) + " |")
        lines.append("| " + " | ".join(["---"] * len(headers)) + " |")

        for r in self.raw_rows:
            clean_row = [cell.replace("\n", " ").strip() if cell else "" for cell in r]
            lines.append("| " + " | ".join(clean_row) + " |")

        return "\n".join(lines)
