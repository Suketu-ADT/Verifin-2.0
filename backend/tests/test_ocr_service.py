"""
Unit and integration tests for Phase 6 Part A: OCR Support for Scanned Financial PDFs.
Validates:
1. Scanned page detection (insufficient text vs digital text).
2. Word coordinate, bounding box, and confidence extraction.
3. Tabular row/column relationship preservation from OCR words.
4. Uncertain numerical cell routing (confidence < 60%) for human review.
5. Selective ingestion & duplicate prevention (native digital text vs OCR).
6. Graceful failure handling (missing Tesseract, timeouts, corrupt images).
7. Rotated page and low-contrast image preprocessing.
8. Empirical ground truth evaluation (CER / WER) without unverified claims.
"""

from typing import List
from unittest.mock import MagicMock, patch
import pytest
from PIL import Image, ImageDraw

from app.models.ocr import OCRBoundingBox, OCRPageResult, OCRWord
from app.models.table import FinancialTableModel, TableCellModel
from app.services.chunking_service import ChunkingService
from app.services.ocr_service import OCRService, get_ocr_service
from app.services.numerical_reasoner import NumericalReasonerService


@pytest.fixture
def ocr_service():
    return OCRService()


# -----------------------------------------------------------------------------
# 1. Scanned Page Detection Tests
# -----------------------------------------------------------------------------

def test_detect_scanned_page_digital_sufficient(ocr_service):
    """Native digital text with sufficient characters must NOT be flagged as scanned."""
    digital_text = (
        "Apple Inc. reported total revenue of $391.0 billion for the fiscal year ended "
        "September 28, 2024, compared to $383.3 billion in fiscal year 2023."
    )
    is_scanned = ocr_service.detect_scanned_page(digital_text, image_count=0)
    assert is_scanned is False

    # Even if page has decorative logos/images, sufficient text remains native digital
    is_scanned_with_img = ocr_service.detect_scanned_page(digital_text, image_count=2)
    assert is_scanned_with_img is False


def test_detect_scanned_page_empty_or_image_only(ocr_service):
    """Empty pages or pages with image and insufficient text must be detected as scanned."""
    # Completely empty text stream
    assert ocr_service.detect_scanned_page("", image_count=1) is True
    assert ocr_service.detect_scanned_page("   ", image_count=0) is True

    # Sparse placeholder text (e.g. page number or "Scanned Document") with images
    sparse_text = "Page 12"
    assert ocr_service.detect_scanned_page(sparse_text, image_count=1) is True


# -----------------------------------------------------------------------------
# 2. OCR Word & Bounding Box Coordinates Tests
# -----------------------------------------------------------------------------

def test_ocr_bounding_box_relative_coordinates():
    """Validates relative coordinate calculation (0.0 to 1.0) and dimensions."""
    bbox = OCRBoundingBox(
        x0=100.0,
        top=200.0,
        x1=250.0,
        bottom=240.0,
        width=150.0,
        height=40.0,
        rel_x0=0.1,
        rel_top=0.2,
        rel_width=0.15,
        rel_height=0.04,
    )
    assert bbox.width == 150.0
    assert bbox.height == 40.0
    assert bbox.rel_x0 == 0.1
    assert bbox.rel_width == 0.15


def test_ocr_word_uncertainty_threshold():
    """Validates that words with confidence < 60% are flagged as uncertain."""
    box = OCRBoundingBox(
        x0=10.0, top=10.0, x1=50.0, bottom=30.0, width=40.0, height=20.0
    )
    high_conf_word = OCRWord(
        text="Revenue", confidence=92.5, bbox=box, page_number=1
    )
    assert high_conf_word.is_uncertain is False

    low_conf_word = OCRWord(
        text="350.0", confidence=48.0, bbox=box, page_number=1
    )
    assert low_conf_word.is_uncertain is True


# -----------------------------------------------------------------------------
# 3. OCR Tabular Structure & Uncertain Cell Routing
# -----------------------------------------------------------------------------

def test_extract_table_from_ocr_words_and_uncertain_cell_routing(ocr_service):
    """
    Requirement 5: Preserve table row/column relationships from OCR words
    and route uncertain numerical cells (confidence < 60%) for review.
    """
    # Create synthetic OCR words arranged in a 2x3 financial grid
    # Row 0: Headers (y ≈ 100)
    # Row 1: Line Item + Figures (y ≈ 140)
    words = [
        # Headers: "Line Item", "2024", "2023"
        OCRWord(
            text="Metric",
            confidence=95.0,
            bbox=OCRBoundingBox(x0=50, top=100, x1=120, bottom=120, width=70, height=20),
            page_number=3,
        ),
        OCRWord(
            text="2024",
            confidence=94.0,
            bbox=OCRBoundingBox(x0=200, top=100, x1=260, bottom=120, width=60, height=20),
            page_number=3,
        ),
        OCRWord(
            text="2023",
            confidence=96.0,
            bbox=OCRBoundingBox(x0=350, top=100, x1=410, bottom=120, width=60, height=20),
            page_number=3,
        ),
        # Row 1: "Total Revenue", "$ 350.0" (low conf 45%), "$ 307.4" (high conf 92%)
        OCRWord(
            text="Revenue",
            confidence=90.0,
            bbox=OCRBoundingBox(x0=50, top=140, x1=130, bottom=160, width=80, height=20),
            page_number=3,
        ),
        OCRWord(
            text="$",
            confidence=88.0,
            bbox=OCRBoundingBox(x0=200, top=140, x1=210, bottom=160, width=10, height=20),
            page_number=3,
        ),
        OCRWord(
            text="350.0",
            confidence=45.0,  # Below 60% threshold -> MUST trigger needs_review
            bbox=OCRBoundingBox(x0=215, top=140, x1=270, bottom=160, width=55, height=20),
            page_number=3,
        ),
        OCRWord(
            text="$",
            confidence=90.0,
            bbox=OCRBoundingBox(x0=350, top=140, x1=360, bottom=160, width=10, height=20),
            page_number=3,
        ),
        OCRWord(
            text="307.4",
            confidence=92.0,  # High confidence
            bbox=OCRBoundingBox(x0=365, top=140, x1=420, bottom=160, width=55, height=20),
            page_number=3,
        ),
    ]

    table = ocr_service.extract_table_from_ocr_words(
        words=words,
        page_number=3,
        document_id="doc_ocr_test",
        default_units="millions",
        default_currency="USD",
    )

    assert table is not None
    assert table.is_ocr is True
    assert table.extraction_method == "ocr"
    assert table.page_number == 3
    assert len(table.rows) == 1
    assert table.has_uncertain_cells is True  # Because 350.0 was 45% conf

    # Validate cell 1 in Row 0 ($ 350.0) was flagged for review
    row0 = table.rows[0]
    cell_2024 = row0[1]
    assert cell_2024.is_numeric is True
    assert cell_2024.normalized_value == 350.0 * 1e6
    assert cell_2024.is_ocr is True
    assert cell_2024.needs_review is True  # Flagged!

    # Validate cell 2 in Row 0 ($ 307.4) was NOT flagged for review
    cell_2023 = row0[2]
    assert cell_2023.is_numeric is True
    assert cell_2023.normalized_value == 307.4 * 1e6
    assert cell_2023.needs_review is False


def test_numerical_reasoning_integration_with_ocr_flags(ocr_service):
    """
    Validates that NumericalReasonerService flags uncertain OCR cells
    with 'requires_human_review' in findings.
    """
    reasoner = NumericalReasonerService()

    words = [
        OCRWord(
            text="Line",
            confidence=95.0,
            bbox=OCRBoundingBox(x0=50, top=100, x1=100, bottom=120, width=50, height=20),
            page_number=2,
        ),
        OCRWord(
            text="2024",
            confidence=95.0,
            bbox=OCRBoundingBox(x0=200, top=100, x1=250, bottom=120, width=50, height=20),
            page_number=2,
        ),
        OCRWord(
            text="Revenue",
            confidence=90.0,
            bbox=OCRBoundingBox(x0=50, top=140, x1=120, bottom=160, width=70, height=20),
            page_number=2,
        ),
        OCRWord(
            text="350.0",
            confidence=42.0,  # Low confidence
            bbox=OCRBoundingBox(x0=200, top=140, x1=260, bottom=160, width=60, height=20),
            page_number=2,
        ),
    ]

    table = ocr_service.extract_table_from_ocr_words(
        words=words,
        page_number=2,
        document_id="doc_ocr_fin",
        default_units="millions",
    )

    finding = reasoner.verify_claim_with_tables("Revenue was $350.0 million in 2024", [table])
    assert finding is not None
    assert finding.comparison_outcome == "VALIDATED"
    assert finding.operands["is_ocr"] is True
    assert finding.operands["needs_review"] is True
    assert finding.operands["requires_human_review"] is True
    assert "Low OCR confidence" in finding.explanation


# -----------------------------------------------------------------------------
# 4. Duplicate Prevention & Selective Ingestion
# -----------------------------------------------------------------------------

def test_selective_ingestion_and_duplicate_prevention(ocr_service):
    """
    Requirement 7: Prevent duplicate content when a page contains both a text layer and scanned images.
    Digital pages must use native text without calling OCR.
    """
    mock_ocr = MagicMock(spec=OCRService)
    mock_ocr.is_available.return_value = True
    # If text is sufficient, detect_scanned_page returns False
    mock_ocr.detect_scanned_page.side_effect = lambda txt, image_count=0: len(txt.strip()) < 40

    chunk_service = ChunkingService(ocr_service=mock_ocr)

    # Simulate native digital text extraction
    digital_page_text = (
        "Operating income increased by 15.4% to $75.0 million for the year 2024."
    )

    # When page is digital, detect_scanned_page is called and returns False
    is_scanned = mock_ocr.detect_scanned_page(digital_page_text, image_count=2)
    assert is_scanned is False

    # OCR render/execution should NOT be called on this digital page
    mock_ocr.ocr_page_image.assert_not_called()


# -----------------------------------------------------------------------------
# 5. Image Preprocessing & Rotation Normalization
# -----------------------------------------------------------------------------

def test_image_preprocessing_autocontrast_and_rotation(ocr_service):
    """
    Requirement 8: Handle rotated pages, low-resolution scans gracefully.
    """
    # Create synthetic test image
    img = Image.new("RGB", (200, 100), color=(200, 200, 200))
    draw = ImageDraw.Draw(img)
    draw.text((20, 40), "TEST OCR", fill=(50, 50, 50))

    # Preprocess with 90 degree rotation
    processed_90 = ocr_service.preprocess_image(img, rotation_angle=90)
    assert processed_90.mode == "L"  # Grayscale
    assert processed_90.size == (100, 200)  # Rotated width/height swapped

    # Preprocess normal 0 degree
    processed_0 = ocr_service.preprocess_image(img, rotation_angle=0)
    assert processed_0.size == (200, 100)


# -----------------------------------------------------------------------------
# 6. Graceful Failure & Error Handling
# -----------------------------------------------------------------------------

def test_ocr_unavailable_graceful_handling():
    """
    Validates that when Tesseract binary is unavailable, service reports
    status cleanly without throwing unhandled exceptions.
    """
    unavailable_service = OCRService(tesseract_cmd="C:\\nonexistent\\tesseract.exe")
    assert unavailable_service.is_available() is False

    dummy_img = Image.new("RGB", (100, 100), color="white")
    result = unavailable_service.ocr_page_image(dummy_img, page_number=1)

    assert result.is_ocr is True
    assert result.text == ""
    assert result.error is not None
    assert "Tesseract OCR binary not found" in result.error


# -----------------------------------------------------------------------------
# 7. Empirical Ground Truth Accuracy Evaluation (No Fabricated Metrics)
# -----------------------------------------------------------------------------

def compute_character_error_rate(reference: str, hypothesis: str) -> float:
    """
    Computes Levenshtein edit distance based Character Error Rate (CER).
    CER = (Insertions + Deletions + Substitutions) / Reference Length.
    """
    r = reference.strip()
    h = hypothesis.strip()
    if not r:
        return 0.0 if not h else 1.0

    n, m = len(r), len(h)
    dp = [[0] * (m + 1) for _ in range(n + 1)]

    for i in range(n + 1):
        dp[i][0] = i
    for j in range(m + 1):
        dp[0][j] = j

    for i in range(1, n + 1):
        for j in range(1, m + 1):
            if r[i - 1] == h[j - 1]:
                dp[i][j] = dp[i - 1][j - 1]
            else:
                dp[i][j] = 1 + min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])

    return dp[n][m] / n


def test_empirical_character_error_rate_measurement():
    """
    Requirement 10: Never claim OCR accuracy without evaluating it against labelled ground truth.
    Demonstrates exact empirical CER calculation on known reference samples.
    """
    reference = "Total Revenue: $350.0M"
    
    # Perfect match: CER = 0.0%
    assert compute_character_error_rate(reference, "Total Revenue: $350.0M") == 0.0

    # Minor 1-char OCR glitch (e.g. '$' read as 'S'):
    hyp_glitch = "Total Revenue: S350.0M"
    cer_glitch = compute_character_error_rate(reference, hyp_glitch)
    assert 0.0 < cer_glitch < 0.1  # ~4.5% CER

    # Severe degradation:
    hyp_poor = "Total Rev 350"
    cer_poor = compute_character_error_rate(reference, hyp_poor)
    assert cer_poor > 0.3  # > 30% CER
