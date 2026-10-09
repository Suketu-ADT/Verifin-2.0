"""
Modular Financial Table Extraction Service using pdfplumber.

Extracts tabular structures from digital financial PDFs, preserving rows,
columns, headers, units, currencies, reporting periods, page coordinates,
and normalized cell figures without discarding raw verbatim strings.
"""

from __future__ import annotations

import io
import re
import uuid
from typing import Any, Dict, List, Optional, Tuple

from app.models.table import (
    FinancialTableModel,
    TableCellModel,
    TableBoundingBox,
)
from app.services.ocr_service import OCRService, get_ocr_service
from app.utils.logging import logger

try:
    import pdfplumber
except ImportError:
    pdfplumber = None  # type: ignore


class TableExtractionService:
    """Extracts, normalizes, and structures tables from digital financial PDFs."""

    UNIT_PATTERNS = [
        (re.compile(r"\b(?:in\s+)?billions\b", re.IGNORECASE), 1e9, "billion"),
        (re.compile(r"\b(?:in\s+)?millions\b", re.IGNORECASE), 1e6, "million"),
        (re.compile(r"\b(?:in\s+)?thousands\b", re.IGNORECASE), 1e3, "thousand"),
    ]

    CURRENCY_SYMBOLS = {
        "$": "USD",
        "€": "EUR",
        "£": "GBP",
        "¥": "JPY",
        "₹": "INR",
    }

    PERIOD_REGEX = re.compile(
        r"\b(19\d{2}|20\d{2}|FY\s*['’]?\d{2,4}|Q[1-4]\s*(?:20\d{2})?)\b",
        re.IGNORECASE,
    )

    def __init__(self, ocr_service: Optional[OCRService] = None):
        self.is_available = pdfplumber is not None
        self.ocr_service = ocr_service or get_ocr_service()

    def extract_tables_from_pdf_bytes(
        self,
        pdf_bytes: bytes,
        document_id: str,
    ) -> List[FinancialTableModel]:
        """
        Extracts all structured financial tables from PDF bytes.
        Handles multi-page table continuation, unit detection, and cell normalization.
        Supports OCR table extraction for scanned pages when Tesseract is available.
        """
        if not self.is_available:
            logger.error("pdfplumber is not installed; table extraction unavailable.")
            return []

        if not pdf_bytes:
            return []

        extracted_tables: List[FinancialTableModel] = []

        try:
            with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
                for page_idx, page in enumerate(pdf.pages):
                    page_number = page_idx + 1

                    # Check for scanned page
                    page_text = page.extract_text() or ""
                    image_count = len(page.images) if hasattr(page, "images") else 0
                    is_scanned = self.ocr_service.detect_scanned_page(
                        page_text, image_count=image_count
                    )

                    if is_scanned:
                        logger.info(
                            f"Page {page_number} of doc {document_id} detected as scanned image. "
                            f"Evaluating OCR table extraction path."
                        )
                        if self.ocr_service.is_available():
                            page_img = self.ocr_service.render_pdf_page_to_image(
                                pdf_bytes, page_number
                            )
                            if page_img:
                                ocr_res = self.ocr_service.ocr_page_image(page_img, page_number)
                                if ocr_res.words:
                                    ocr_units, ocr_currency = self._detect_page_units_and_currency(
                                        ocr_res.text
                                    )
                                    ocr_table = self.ocr_service.extract_table_from_ocr_words(
                                        words=ocr_res.words,
                                        page_number=page_number,
                                        document_id=document_id,
                                        default_units=ocr_units,
                                        default_currency=ocr_currency,
                                    )
                                    if ocr_table:
                                        if extracted_tables and self._is_continuation(
                                            extracted_tables[-1], ocr_table
                                        ):
                                            self._merge_continuation(extracted_tables[-1], ocr_table)
                                        else:
                                            extracted_tables.append(ocr_table)
                        else:
                            logger.warning(
                                f"Page {page_number} of doc {document_id} appears to be a scanned image. "
                                f"Digital text stream absent and OCR is unavailable; table extraction skipped."
                            )
                        continue

                    # Find tables on current digital page
                    page_tables = page.find_tables()
                    if not page_tables:
                        continue

                    # Extract context text above tables for unit and title detection
                    page_units, page_currency = self._detect_page_units_and_currency(page_text)

                    for pt in page_tables:
                        raw_table_data = pt.extract()
                        if not raw_table_data or len(raw_table_data) < 2:
                            continue

                        # Extract table bounding box
                        bbox = None
                        if hasattr(pt, "bbox") and pt.bbox:
                            bbox = TableBoundingBox(
                                x0=float(pt.bbox[0]),
                                top=float(pt.bbox[1]),
                                x1=float(pt.bbox[2]),
                                bottom=float(pt.bbox[3]),
                            )

                        parsed_table = self._process_raw_table(
                            raw_rows=raw_table_data,
                            page_number=page_number,
                            document_id=document_id,
                            bbox=bbox,
                            default_units=page_units,
                            default_currency=page_currency,
                        )

                        if parsed_table:
                            # Check if this table continues an existing table from previous page
                            if extracted_tables and self._is_continuation(extracted_tables[-1], parsed_table):
                                self._merge_continuation(extracted_tables[-1], parsed_table)
                            else:
                                extracted_tables.append(parsed_table)

        except Exception as exc:
            logger.error(f"Error extracting tables from PDF for document {document_id}: {exc}")

        return extracted_tables

    def _process_raw_table(
        self,
        raw_rows: List[List[Optional[str]]],
        page_number: int,
        document_id: str,
        bbox: Optional[TableBoundingBox] = None,
        default_units: Optional[str] = None,
        default_currency: Optional[str] = None,
    ) -> Optional[FinancialTableModel]:
        """
        Cleans headers, parses cell values, and structures table rows.
        """
        # Clean nulls into empty strings
        cleaned_grid: List[List[str]] = [
            [(cell.strip() if cell else "") for cell in row] for row in raw_rows
        ]

        # Filter completely empty rows
        cleaned_grid = [r for r in cleaned_grid if any(c for c in r)]
        if len(cleaned_grid) < 2:
            return None

        # Detect headers (row 0)
        header_row = cleaned_grid[0]
        # In financial reports, sometimes row 1 contains the actual period dates (e.g. 2024, 2023)
        headers = [h if h else f"Col_{i}" for i, h in enumerate(header_row)]

        # Extract reporting periods from headers
        reporting_periods: List[Optional[str]] = []
        for h in headers:
            match = self.PERIOD_REGEX.search(h)
            reporting_periods.append(match.group(0) if match else None)

        # Detect units and currencies
        multiplier = 1.0
        unit_name = default_units
        if default_units:
            for pat, mult, name in self.UNIT_PATTERNS:
                if pat.search(default_units):
                    multiplier = mult
                    unit_name = name
                    break

        structured_rows: List[List[TableCellModel]] = []
        data_rows = cleaned_grid[1:]

        for row_idx, r in enumerate(data_rows):
            row_cells: List[TableCellModel] = []
            for col_idx, raw_cell_text in enumerate(r):
                cell_model = self._parse_cell_value(
                    raw_text=raw_cell_text,
                    row_idx=row_idx,
                    col_idx=col_idx,
                    default_currency=default_currency,
                    default_multiplier=multiplier,
                    default_unit_name=unit_name,
                )
                row_cells.append(cell_model)
            structured_rows.append(row_cells)

        table_id = str(uuid.uuid4())
        return FinancialTableModel(
            id=table_id,
            document_id=document_id,
            page_number=page_number,
            title=headers[0] if headers and len(headers) > 0 else None,
            headers=headers,
            reporting_periods=reporting_periods,
            units=unit_name,
            currency=default_currency,
            rows=structured_rows,
            raw_rows=cleaned_grid,
            bbox=bbox,
            is_multi_page=False,
        )

    def _parse_cell_value(
        self,
        raw_text: str,
        row_idx: int,
        col_idx: int,
        default_currency: Optional[str] = None,
        default_multiplier: float = 1.0,
        default_unit_name: Optional[str] = None,
    ) -> TableCellModel:
        """
        Parses numerical value from financial table cell without altering raw verbatim text.
        Handles: "$ 350.0", "(12.5)", "14%", "—", "-", etc.
        """
        if not raw_text or not raw_text.strip() or raw_text.strip() in ("—", "-", "--", "N/A", "n/a"):
            return TableCellModel(
                raw_text=raw_text,
                normalized_value=None,
                is_numeric=False,
                currency=default_currency,
                unit_multiplier=default_multiplier,
                unit_name=default_unit_name,
                row_idx=row_idx,
                col_idx=col_idx,
            )

        text = raw_text.strip()

        # Check currency
        currency = default_currency
        for sym, code in self.CURRENCY_SYMBOLS.items():
            if sym in text:
                currency = code
                text = text.replace(sym, "").strip()
                break

        # Check negative sign or parenthesis e.g. (350.0)
        is_negative = False
        if text.startswith("(") and text.endswith(")"):
            is_negative = True
            text = text[1:-1].strip()
        elif text.startswith("-"):
            is_negative = True
            text = text[1:].strip()
        elif text.endswith("-"):
            is_negative = True
            text = text[:-1].strip()

        # Remove commas
        clean_num_str = text.replace(",", "").replace("%", "").strip()

        # Check if numeric
        try:
            val = float(clean_num_str)
            sign = -1.0 if is_negative else 1.0
            # If percentage, don't multiply by million/billion
            if "%" in raw_text:
                normalized = sign * val
            else:
                normalized = sign * val * default_multiplier

            return TableCellModel(
                raw_text=raw_text,
                normalized_value=normalized,
                is_numeric=True,
                currency=currency,
                unit_multiplier=default_multiplier,
                unit_name=default_unit_name,
                is_negative=is_negative,
                row_idx=row_idx,
                col_idx=col_idx,
            )
        except ValueError:
            return TableCellModel(
                raw_text=raw_text,
                normalized_value=None,
                is_numeric=False,
                currency=currency,
                unit_multiplier=default_multiplier,
                unit_name=default_unit_name,
                row_idx=row_idx,
                col_idx=col_idx,
            )

    def _detect_page_units_and_currency(self, text: str) -> Tuple[Optional[str], Optional[str]]:
        """Scans context text for scale units ('in millions') and currencies."""
        units = None
        for pat, _, name in self.UNIT_PATTERNS:
            if pat.search(text):
                units = name
                break

        currency = None
        for sym, code in self.CURRENCY_SYMBOLS.items():
            if sym in text:
                currency = code
                break

        return units, currency

    def _is_continuation(self, table1: FinancialTableModel, table2: FinancialTableModel) -> bool:
        """Determines if table2 is a continuation of table1 across adjacent pages."""
        if table2.page_number != table1.page_number + 1:
            return False

        # Same number of columns
        if len(table1.headers) != len(table2.headers):
            return False

        # Identical or repeated headers
        matching_headers = sum(
            1 for h1, h2 in zip(table1.headers, table2.headers) if h1.lower() == h2.lower()
        )
        return matching_headers >= max(1, len(table1.headers) // 2)

    def _merge_continuation(self, base_table: FinancialTableModel, cont_table: FinancialTableModel):
        """Merges a multi-page table continuation into the base table."""
        base_table.is_multi_page = True
        base_table.rows.extend(cont_table.rows)
        base_table.raw_rows.extend(cont_table.raw_rows)

    def lookup_line_item(
        self,
        table: FinancialTableModel,
        item_keyword: str,
        period: Optional[str] = None,
    ) -> Optional[TableCellModel]:
        """
        Looks up a specific cell in a table given a line-item keyword and optional period.
        Example: lookup_line_item(table, "revenue", "2024") -> TableCellModel
        """
        kw = item_keyword.lower()
        target_col_idx = None

        if period:
            period_clean = period.lower().replace("fy", "").strip()
            for col_idx, rep_period in enumerate(table.reporting_periods):
                if rep_period and period_clean in rep_period.lower():
                    target_col_idx = col_idx
                    break

        for row in table.rows:
            if not row:
                continue
            # First cell is typically the line item name
            line_item_name = row[0].raw_text.lower()
            if kw in line_item_name:
                if target_col_idx is not None and target_col_idx < len(row):
                    return row[target_col_idx]
                # Return first numeric cell in row
                for cell in row[1:]:
                    if cell.is_numeric:
                        return cell

        return None
