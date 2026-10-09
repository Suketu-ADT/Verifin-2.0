"""
Modular OCR Service for Scanned Financial PDFs.

Integrates Tesseract OCR for image-only or scanned financial documents.
Extracts words, bounding boxes, confidence scores, preserves tabular
row/column structures, and flags uncertain numerical cells for human review.
"""

from __future__ import annotations

import io
import os
import re
import shutil
import uuid
from typing import Any, Dict, List, Optional, Tuple

from PIL import Image, ImageOps

from app.config import settings
from app.models.ocr import OCRBoundingBox, OCRPageResult, OCRWord
from app.models.table import (
    FinancialTableModel,
    TableCellModel,
    TableBoundingBox,
)
from app.utils.logging import logger

try:
    import pytesseract
except ImportError:
    pytesseract = None  # type: ignore

try:
    import pypdfium2
except ImportError:
    pypdfium2 = None  # type: ignore


class OCRService:
    """
    Handles scanned page detection, image preprocessing, Tesseract OCR invocation,
    word coordinate extraction, and structured tabular grid reconstruction.
    """

    WINDOWS_DEFAULT_PATHS = [
        r"C:\Program Files\Tesseract-OCR\tesseract.exe",
        r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe",
        os.path.expandvars(r"%LOCALAPPDATA%\Programs\Tesseract-OCR\tesseract.exe"),
    ]

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

    def __init__(self, tesseract_cmd: Optional[str] = None):
        self.cmd_path = self._resolve_tesseract_path(tesseract_cmd or settings.tesseract_cmd)
        if pytesseract is not None and self.cmd_path:
            pytesseract.pytesseract.tesseract_cmd = self.cmd_path

    def _resolve_tesseract_path(self, explicit_cmd: Optional[str]) -> Optional[str]:
        """Resolves Tesseract binary path across Windows, Linux, and macOS."""
        if explicit_cmd and os.path.exists(explicit_cmd):
            return explicit_cmd

        # Check standard PATH
        which_path = shutil.which("tesseract")
        if which_path:
            return which_path

        # Check standard Windows paths if on Windows
        if os.name == "nt":
            for win_path in self.WINDOWS_DEFAULT_PATHS:
                if os.path.exists(win_path):
                    return win_path

        return None

    def is_available(self) -> bool:
        """Returns True if Tesseract and pytesseract are installed and executable."""
        if not settings.ocr_enabled:
            return False
        if pytesseract is None:
            return False
        if not self.cmd_path or not os.path.exists(self.cmd_path):
            return False
        return True

    def detect_scanned_page(
        self,
        page_text: str,
        image_count: int = 0,
        min_char_threshold: Optional[int] = None,
    ) -> bool:
        """
        Detects whether a PDF page is scanned or image-only based on digital text sufficiency.
        If extractable text is below the threshold and page has images (or text is completely empty),
        it is marked as scanned.
        """
        threshold = min_char_threshold or settings.ocr_min_char_threshold
        cleaned_text = page_text.strip() if page_text else ""
        char_count = len(cleaned_text)

        if char_count == 0:
            return True

        if char_count < threshold and image_count > 0:
            return True

        return False

    def render_pdf_page_to_image(
        self,
        pdf_bytes: bytes,
        page_number: int,
        dpi: Optional[int] = None,
    ) -> Optional[Image.Image]:
        """
        Renders a specific PDF page (1-indexed) to a PIL Image using pypdfium2.
        """
        if pypdfium2 is None:
            logger.warning("pypdfium2 is not available for rendering PDF pages to images.")
            return None

        try:
            pdf = pypdfium2.PdfDocument(pdf_bytes)
            page_idx = page_number - 1
            if page_idx < 0 or page_idx >= len(pdf):
                return None

            page = pdf.get_page(page_idx)
            # 72 dpi is base scale=1.0; 150 dpi is ~2.08 scale
            target_dpi = dpi or settings.ocr_dpi
            scale = target_dpi / 72.0
            pil_image = page.render(scale=scale).to_pil()
            return pil_image
        except Exception as exc:
            logger.error(f"Error rendering PDF page {page_number} to image: {exc}")
            return None

    def preprocess_image(self, image: Image.Image, rotation_angle: int = 0) -> Image.Image:
        """
        Applies grayscale conversion, contrast enhancement, and optional rotation
        to improve OCR recognition accuracy on low-contrast scans.
        """
        processed = image.convert("RGB")

        # Apply rotation if specified
        if rotation_angle in (90, 180, 270):
            processed = processed.rotate(rotation_angle, expand=True)

        # Convert to grayscale
        gray = processed.convert("L")

        # Autocontrast to normalize black/white balance
        try:
            enhanced = ImageOps.autocontrast(gray, cutoff=2)
            return enhanced
        except Exception:
            return gray

    def ocr_page_image(
        self,
        image: Image.Image,
        page_number: int,
        rotation_angle: int = 0,
    ) -> OCRPageResult:
        """
        Executes Tesseract OCR on an image and extracts words with bounding boxes
        and confidence metrics.
        """
        if not self.is_available():
            logger.warning("OCR invoked but Tesseract is not available or disabled.")
            return OCRPageResult(
                page_number=page_number,
                text="",
                error="Tesseract OCR binary not found or disabled. Please install Tesseract-OCR.",
            )

        try:
            preprocessed = self.preprocess_image(image, rotation_angle=rotation_angle)
            img_width, img_height = preprocessed.size

            # Extract detailed word data with positions and confidence
            data = pytesseract.image_to_data(
                preprocessed,
                output_type=pytesseract.Output.DICT,
                timeout=settings.ocr_timeout_seconds,
            )

            words: List[OCRWord] = []
            text_tokens: List[str] = []
            confidences: List[float] = []

            n_boxes = len(data.get("text", []))
            for i in range(n_boxes):
                token = str(data["text"][i]).strip()
                try:
                    conf = float(data["conf"][i])
                except (ValueError, TypeError):
                    conf = -1.0

                # Filter out whitespace or invalid confidence
                if not token or conf < 0:
                    continue

                left = float(data["left"][i])
                top = float(data["top"][i])
                width = float(data["width"][i])
                height = float(data["height"][i])

                # Relative normalized coordinates (0.0 - 1.0)
                rel_x0 = left / max(1.0, img_width)
                rel_top = top / max(1.0, img_height)
                rel_w = width / max(1.0, img_width)
                rel_h = height / max(1.0, img_height)

                bbox = OCRBoundingBox(
                    x0=left,
                    top=top,
                    x1=left + width,
                    bottom=top + height,
                    width=width,
                    height=height,
                    rel_x0=round(rel_x0, 4),
                    rel_top=round(rel_top, 4),
                    rel_width=round(rel_w, 4),
                    rel_height=round(rel_h, 4),
                )

                word_obj = OCRWord(
                    text=token,
                    confidence=round(conf, 1),
                    bbox=bbox,
                    page_number=page_number,
                    block_num=int(data.get("block_num", [0])[i]),
                    line_num=int(data.get("line_num", [0])[i]),
                    word_num=int(data.get("word_num", [0])[i]),
                )
                words.append(word_obj)
                text_tokens.append(token)
                confidences.append(conf)

            mean_conf = round(sum(confidences) / max(1, len(confidences)), 1) if confidences else 0.0
            needs_review = mean_conf < settings.ocr_confidence_threshold or len(words) == 0
            full_text = " ".join(text_tokens)

            return OCRPageResult(
                page_number=page_number,
                text=full_text,
                words=words,
                mean_confidence=mean_conf,
                is_ocr=True,
                extraction_method="ocr",
                image_count=1,
                needs_review=needs_review,
            )

        except Exception as exc:
            logger.error(f"OCR execution failed on page {page_number}: {exc}")
            return OCRPageResult(
                page_number=page_number,
                text="",
                is_ocr=True,
                extraction_method="ocr",
                needs_review=True,
                error=str(exc),
            )

    def extract_table_from_ocr_words(
        self,
        words: List[OCRWord],
        page_number: int,
        document_id: str,
        default_units: Optional[str] = None,
        default_currency: Optional[str] = None,
    ) -> Optional[FinancialTableModel]:
        """
        Reconstructs tabular structures from spatially distributed OCR words.
        Preserves rows, columns, headers, and routes uncertain numerical cells for review.
        """
        if not words or len(words) < 4:
            return None

        # 1. Cluster words into rows by vertical alignment (top coordinate)
        # Average height of words
        avg_h = sum(w.bbox.height for w in words) / max(1, len(words))
        row_tolerance = max(8.0, avg_h * 0.7)

        # Sort words top-to-bottom, left-to-right
        sorted_words = sorted(words, key=lambda w: (w.bbox.top, w.bbox.x0))

        rows_of_words: List[List[OCRWord]] = []
        current_row: List[OCRWord] = []
        current_y = None

        for w in sorted_words:
            if current_y is None:
                current_row.append(w)
                current_y = w.bbox.top
            elif abs(w.bbox.top - current_y) <= row_tolerance:
                current_row.append(w)
            else:
                # Finish previous row
                current_row.sort(key=lambda item: item.bbox.x0)
                rows_of_words.append(current_row)
                current_row = [w]
                current_y = w.bbox.top

        if current_row:
            current_row.sort(key=lambda item: item.bbox.x0)
            rows_of_words.append(current_row)

        if len(rows_of_words) < 2:
            return None

        # 2. Cluster columns by horizontal positions across rows
        raw_rows: List[List[str]] = []
        raw_cell_words: List[List[List[OCRWord]]] = []

        # Find columns by grouping horizontally spaced words within each row
        col_gap_threshold = max(20.0, avg_h * 1.5)

        for row_w in rows_of_words:
            row_cells_text: List[str] = []
            row_cells_words: List[List[OCRWord]] = []

            curr_cell_text: List[str] = []
            curr_cell_w: List[OCRWord] = []
            last_x1 = None

            for w in row_w:
                if last_x1 is None or (w.bbox.x0 - last_x1) <= col_gap_threshold:
                    curr_cell_text.append(w.text)
                    curr_cell_w.append(w)
                else:
                    row_cells_text.append(" ".join(curr_cell_text))
                    row_cells_words.append(curr_cell_w)
                    curr_cell_text = [w.text]
                    curr_cell_w = [w]
                last_x1 = w.bbox.x1

            if curr_cell_text:
                row_cells_text.append(" ".join(curr_cell_text))
                row_cells_words.append(curr_cell_w)

            raw_rows.append(row_cells_text)
            raw_cell_words.append(row_cells_words)

        # Normalize column count to max columns found
        max_cols = max(len(r) for r in raw_rows)
        if max_cols < 2:
            return None

        padded_raw_rows: List[List[str]] = []
        for r in raw_rows:
            padded_raw_rows.append(r + [""] * (max_cols - len(r)))

        header_row = padded_raw_rows[0]
        headers = [h if h else f"Col_{i}" for i, h in enumerate(header_row)]

        # Extract reporting periods from headers
        reporting_periods: List[Optional[str]] = []
        for h in headers:
            match = self.PERIOD_REGEX.search(h)
            reporting_periods.append(match.group(0) if match else None)

        # Detect scale multiplier
        multiplier = 1.0
        unit_name = default_units
        if default_units:
            for pat, mult, name in self.UNIT_PATTERNS:
                if pat.search(default_units):
                    multiplier = mult
                    unit_name = name
                    break

        structured_rows: List[List[TableCellModel]] = []
        has_uncertain_cells = False

        for row_idx, r in enumerate(padded_raw_rows[1:]):
            row_models: List[TableCellModel] = []
            cell_words_row = raw_cell_words[row_idx + 1] if row_idx + 1 < len(raw_cell_words) else []

            for col_idx, cell_text in enumerate(r):
                cell_words = cell_words_row[col_idx] if col_idx < len(cell_words_row) else []
                cell_conf = (
                    sum(w.confidence for w in cell_words) / max(1, len(cell_words))
                    if cell_words
                    else None
                )
                min_word_conf = (
                    min(w.confidence for w in cell_words)
                    if cell_words
                    else None
                )

                # Parse numerical values
                cell_model = self._parse_ocr_cell_value(
                    raw_text=cell_text,
                    row_idx=row_idx,
                    col_idx=col_idx,
                    confidence=cell_conf,
                    min_confidence=min_word_conf,
                    default_currency=default_currency,
                    default_multiplier=multiplier,
                    default_unit_name=unit_name,
                )

                if cell_model.is_numeric and cell_model.needs_review:
                    has_uncertain_cells = True

                row_models.append(cell_model)
            structured_rows.append(row_models)

        # Overall table bounding box
        x0 = min(w.bbox.x0 for w in words)
        top = min(w.bbox.top for w in words)
        x1 = max(w.bbox.x1 for w in words)
        bottom = max(w.bbox.bottom for w in words)

        table_bbox = TableBoundingBox(x0=x0, top=top, x1=x1, bottom=bottom)
        overall_conf = sum(w.confidence for w in words) / max(1, len(words))

        return FinancialTableModel(
            id=str(uuid.uuid4()),
            document_id=document_id,
            page_number=page_number,
            title=headers[0] if headers else None,
            headers=headers,
            reporting_periods=reporting_periods,
            units=unit_name,
            currency=default_currency,
            rows=structured_rows,
            raw_rows=padded_raw_rows,
            bbox=table_bbox,
            is_multi_page=False,
            is_ocr=True,
            extraction_method="ocr",
            ocr_confidence=round(overall_conf, 1),
            has_uncertain_cells=has_uncertain_cells,
        )

    def _parse_ocr_cell_value(
        self,
        raw_text: str,
        row_idx: int,
        col_idx: int,
        confidence: Optional[float] = None,
        min_confidence: Optional[float] = None,
        default_currency: Optional[str] = None,
        default_multiplier: float = 1.0,
        default_unit_name: Optional[str] = None,
    ) -> TableCellModel:
        """Parses cell value and flags low OCR confidence for review."""
        effective_conf = min_confidence if min_confidence is not None else confidence
        needs_review_flag = (
            effective_conf is not None and effective_conf < settings.ocr_confidence_threshold
        )

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
                is_ocr=True,
                ocr_confidence=confidence,
                needs_review=False,
            )

        text = raw_text.strip()

        # Check currency
        currency = default_currency
        for sym, code in self.CURRENCY_SYMBOLS.items():
            if sym in text:
                currency = code
                text = text.replace(sym, "").strip()
                break

        # Check negative parenthetical or sign
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

        clean_num_str = text.replace(",", "").replace("%", "").strip()

        # Check if numeric
        try:
            val = float(clean_num_str)
            sign = -1.0 if is_negative else 1.0
            normalized = sign * val if "%" in raw_text else sign * val * default_multiplier

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
                is_ocr=True,
                ocr_confidence=round(confidence, 1) if confidence is not None else None,
                needs_review=needs_review_flag,
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
                is_ocr=True,
                ocr_confidence=round(confidence, 1) if confidence is not None else None,
                needs_review=False,
            )


# Singleton instance accessor
_ocr_service_instance: Optional[OCRService] = None


def get_ocr_service() -> OCRService:
    """Returns singleton instance of OCRService."""
    global _ocr_service_instance
    if _ocr_service_instance is None:
        _ocr_service_instance = OCRService()
    return _ocr_service_instance
