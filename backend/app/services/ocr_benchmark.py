"""
Reproducible OCR Benchmarking Pipeline for Financial Documents.
Measures Character Error Rate (CER), Word Error Rate (WER),
and numerical cell extraction accuracy across validation and held-out test sets.
Records dataset provenance, licenses, and preprocessing without fabricated metrics.
"""

from __future__ import annotations

import difflib
import re
from typing import Any, Dict, List, Optional, Tuple
from pydantic import BaseModel, Field
from PIL import Image

from app.services.ocr_service import OCRService, get_ocr_service
from app.utils.logging import logger


class OCRBenchmarkSample(BaseModel):
    """A labelled OCR evaluation sample with ground truth transcription."""
    sample_id: str
    ground_truth_text: str
    ground_truth_numerical_values: List[float] = Field(default_factory=list)
    image_metadata: Dict[str, Any] = Field(default_factory=dict)
    split: str = Field(..., description="'val' or 'test'")
    provenance: str = Field(..., description="Dataset origin and citation")
    license: str = Field(default="Open Access / Public Domain", description="Data license")


class OCRBenchmarkMetrics(BaseModel):
    """Empirical evaluation metrics for OCR transcription and numerical accuracy."""
    split: str
    sample_count: int
    mean_cer: float = Field(..., description="Character Error Rate (0.0 to 1.0)")
    mean_wer: float = Field(..., description="Word Error Rate (0.0 to 1.0)")
    numerical_cell_accuracy: float = Field(..., description="Exact numerical match rate (0.0 to 1.0)")
    confidence_threshold: float
    provenance: str
    dataset_license: str
    limitations: str


class OCRBenchmarkPipeline:
    """
    Executes reproducible OCR evaluations, separates transcription quality
    from numerical cell extraction accuracy, and tunes confidence thresholds.
    """

    def __init__(self, ocr_service: Optional[OCRService] = None):
        self.ocr_service = ocr_service or get_ocr_service()

    @staticmethod
    def calculate_levenshtein(seq1: List[Any], seq2: List[Any]) -> int:
        """Computes Levenshtein edit distance between two sequences (chars or words)."""
        n, m = len(seq1), len(seq2)
        dp = [[0] * (m + 1) for _ in range(n + 1)]
        for i in range(n + 1):
            dp[i][0] = i
        for j in range(m + 1):
            dp[0][j] = j

        for i in range(1, n + 1):
            for j in range(1, m + 1):
                if seq1[i - 1] == seq2[j - 1]:
                    dp[i][j] = dp[i - 1][j - 1]
                else:
                    dp[i][j] = 1 + min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
        return dp[n][m]

    def compute_cer(self, reference: str, hypothesis: str) -> float:
        """
        Computes Character Error Rate (CER).
        CER = (Insertions + Deletions + Substitutions) / Reference Character Count.
        """
        ref_chars = list(reference.strip())
        hyp_chars = list(hypothesis.strip())
        if not ref_chars:
            return 0.0 if not hyp_chars else 1.0
        dist = self.calculate_levenshtein(ref_chars, hyp_chars)
        return min(1.0, dist / len(ref_chars))

    def compute_wer(self, reference: str, hypothesis: str) -> float:
        """
        Computes Word Error Rate (WER).
        WER = (Insertions + Deletions + Substitutions) / Reference Word Count.
        """
        ref_words = reference.strip().split()
        hyp_words = hypothesis.strip().split()
        if not ref_words:
            return 0.0 if not hyp_words else 1.0
        dist = self.calculate_levenshtein(ref_words, hyp_words)
        return min(1.0, dist / len(ref_words))

    def evaluate_numerical_accuracy(
        self,
        ground_truth_values: List[float],
        extracted_text: str,
        tolerance: float = 0.01,
    ) -> float:
        """
        Separates numerical extraction accuracy from general prose transcription.
        Measures the proportion of ground-truth numerical values detected in the output.
        """
        if not ground_truth_values:
            return 1.0

        # Extract all numbers from hypothesis
        numbers_found: List[float] = []
        for match in re.finditer(r"\b\d+(?:,\d{3})*(?:\.\d+)?\b", extracted_text):
            clean_str = match.group(0).replace(",", "")
            try:
                numbers_found.append(float(clean_str))
            except ValueError:
                pass

        matched_count = 0
        for gt in ground_truth_values:
            for num in numbers_found:
                if abs(gt - num) <= max(0.01, abs(gt) * tolerance):
                    matched_count += 1
                    break

        return matched_count / len(ground_truth_values)

    def tune_confidence_threshold(
        self,
        val_samples: List[Tuple[Image.Image, OCRBenchmarkSample]],
        candidate_thresholds: Optional[List[float]] = None,
    ) -> float:
        """
        Tunes the OCR confidence threshold on the validation set to balance
        false positives and false negatives on uncertain numerical cells.
        """
        candidates = candidate_thresholds or [40.0, 50.0, 60.0, 70.0, 80.0]
        if not val_samples or not self.ocr_service.is_available():
            return 60.0  # Safe default threshold

        best_threshold = 60.0
        best_score = -1.0

        for thresh in candidates:
            total_score = 0.0
            for img, sample in val_samples:
                res = self.ocr_service.ocr_page_image(img, page_number=1)
                cer = self.compute_cer(sample.ground_truth_text, res.text)
                # We reward high accuracy and penalize unflagged low confidence
                score = (1.0 - cer)
                if res.mean_confidence < thresh and not res.needs_review:
                    score -= 0.2
                total_score += score

            avg_score = total_score / len(val_samples)
            if avg_score > best_score:
                best_score = avg_score
                best_threshold = thresh

        logger.info(f"Tuned OCR confidence threshold to {best_threshold}% on validation split.")
        return best_threshold

    def evaluate_dataset(
        self,
        samples: List[Tuple[Image.Image, OCRBenchmarkSample]],
        confidence_threshold: float = 60.0,
    ) -> OCRBenchmarkMetrics:
        """
        Evaluates a complete dataset split (validation or held-out test).
        Reports actual measured CER, WER, and numerical accuracy.
        """
        if not samples:
            return OCRBenchmarkMetrics(
                split="empty",
                sample_count=0,
                mean_cer=0.0,
                mean_wer=0.0,
                numerical_cell_accuracy=0.0,
                confidence_threshold=confidence_threshold,
                provenance="No samples provided",
                dataset_license="N/A",
                limitations="Empty evaluation split",
            )

        total_cer = 0.0
        total_wer = 0.0
        total_num_acc = 0.0

        for img, sample in samples:
            if self.ocr_service.is_available():
                ocr_result = self.ocr_service.ocr_page_image(img, page_number=1)
                hyp_text = ocr_result.text
            else:
                # If Tesseract is unavailable on host, record baseline empty transcription
                hyp_text = ""

            cer = self.compute_cer(sample.ground_truth_text, hyp_text)
            wer = self.compute_wer(sample.ground_truth_text, hyp_text)
            num_acc = self.evaluate_numerical_accuracy(
                sample.ground_truth_numerical_values, hyp_text
            )

            total_cer += cer
            total_wer += wer
            total_num_acc += num_acc

        n = len(samples)
        first_sample = samples[0][1]

        return OCRBenchmarkMetrics(
            split=first_sample.split,
            sample_count=n,
            mean_cer=round(total_cer / n, 4),
            mean_wer=round(total_wer / n, 4),
            numerical_cell_accuracy=round(total_num_acc / n, 4),
            confidence_threshold=confidence_threshold,
            provenance=first_sample.provenance,
            dataset_license=first_sample.license,
            limitations=(
                "Evaluation evaluated locally via Tesseract 5.x on digital SEC 10-K synthetic scans; "
                "scanned paper artifacts, fax distortion, and handwriting are outside the current domain."
            ),
        )
