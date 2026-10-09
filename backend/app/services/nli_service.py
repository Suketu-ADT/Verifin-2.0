"""
Modular Cross-Encoder Natural Language Inference (NLI) service for VERIFIN 2.0.
Implements verification, verified label mapping, premise/hypothesis ordering,
multi-passage aggregation, and explainable risk scores.
"""

from __future__ import annotations

import threading
from typing import Dict, List, Optional, Tuple
import numpy as np

from app.config import settings
from app.schemas.retrieval import EvidenceChunkResponse
from app.utils.logging import logger

try:
    from sentence_transformers import CrossEncoder
except ImportError:
    CrossEncoder = None  # type: ignore


# ─────────────────────────────────────────────────────────────────────────────
# Verified Model Architecture & Label Mapping
# ─────────────────────────────────────────────────────────────────────────────
# Model: cross-encoder/nli-deberta-v3-small (deberta-v2 architecture)
# HuggingFace id2label: {0: 'contradiction', 1: 'entailment', 2: 'neutral'}
#
# Premise / Hypothesis Ordering Convention:
#   Premise    = Evidence passage retrieved from the financial document (ground truth context)
#   Hypothesis = Claim statement being tested
#
#   Input pair = (Premise, Hypothesis) = (evidence_text, claim_text)
# ─────────────────────────────────────────────────────────────────────────────
LABEL_CONTRADICTION = 0
LABEL_ENTAILMENT = 1
LABEL_NEUTRAL = 2

VERDICT_SUPPORTED = "SUPPORTED"
VERDICT_CONTRADICTED = "CONTRADICTED"
VERDICT_UNVERIFIED = "UNVERIFIED"


class PassageNLIResult:
    """NLI evaluation result for a single evidence passage."""

    def __init__(
        self,
        evidence_text: str,
        document_id: str,
        source_filename: str,
        page_number: int,
        chunk_id: str,
        retrieval_score: float,
        p_supported: float,
        p_contradicted: float,
        p_unverified: float,
        verdict: str,
    ):
        self.evidence_text = evidence_text
        self.document_id = document_id
        self.source_filename = source_filename
        self.page_number = page_number
        self.chunk_id = chunk_id
        self.retrieval_score = retrieval_score
        self.p_supported = p_supported
        self.p_contradicted = p_contradicted
        self.p_unverified = p_unverified
        self.verdict = verdict


class ClaimNLIResult:
    """Aggregated NLI verification verdict for a financial claim."""

    def __init__(
        self,
        claim_text: str,
        claim_type: str,
        verdict: str,
        confidence: float,
        risk_level: str,
        risk_score: float,
        explanation: str,
        source_sentence: Optional[str] = None,
        deciding_passage: Optional[PassageNLIResult] = None,
        all_passages: Optional[List[PassageNLIResult]] = None,
    ):
        self.claim_text = claim_text
        self.claim_type = claim_type
        self.verdict = verdict
        self.confidence = confidence  # Uncalibrated class probability of deciding evidence
        self.risk_level = risk_level  # "LOW", "MEDIUM", "HIGH"
        self.risk_score = risk_score  # Uncalibrated risk score (0.0 to 1.0)
        self.explanation = explanation
        self.source_sentence = source_sentence or claim_text
        self.deciding_passage = deciding_passage
        self.all_passages = all_passages or []


class NLIService:
    """
    Modular NLI inference and verification service using CrossEncoder.
    """

    def __init__(
        self,
        model_name: Optional[str] = None,
        device: Optional[str] = None,
    ):
        self.model_name = model_name or settings.nli_model_name
        self.device = device or settings.nli_device
        self._model: Optional[CrossEncoder] = None
        self._lock = threading.Lock()
        self._initialized = False
        self._init_error: Optional[str] = None

    def _load_model(self) -> None:
        """Loads CrossEncoder model lazily with thread-safety and error capturing."""
        if self._initialized:
            return

        with self._lock:
            if self._initialized:
                return

            if CrossEncoder is None:
                self._init_error = "sentence-transformers CrossEncoder is not installed."
                logger.error(self._init_error)
                return

            try:
                logger.info(
                    f"Loading NLI CrossEncoder model '{self.model_name}' on device '{self.device}'..."
                )
                self._model = CrossEncoder(
                    self.model_name,
                    num_labels=3,
                    device=self.device,
                )
                self._initialized = True
                self._init_error = None
                logger.info(f"NLI CrossEncoder model '{self.model_name}' loaded successfully.")
            except Exception as exc:
                self._init_error = f"Failed to load NLI model '{self.model_name}': {exc}"
                logger.error(self._init_error)
                self._initialized = False

    @property
    def is_available(self) -> bool:
        return CrossEncoder is not None

    def is_healthy(self) -> bool:
        """Verifies if the NLI model is initialized and ready for inference."""
        if not self.is_available:
            return False
        if not self._initialized:
            self._load_model()
        return self._initialized and self._model is not None

    @property
    def status(self) -> str:
        return "healthy" if self.is_healthy() else "unavailable"

    def predict_probabilities(
        self, pairs: List[Tuple[str, str]]
    ) -> List[Dict[str, float]]:
        """
        Executes NLI cross-encoder inference for a list of (Premise, Hypothesis) pairs.
        Returns a list of dicts with mapped probabilities:
        {'SUPPORTED': p, 'CONTRADICTED': p, 'UNVERIFIED': p}
        """
        if not pairs:
            return []

        if not self.is_healthy():
            err = self._init_error or "NLI service is currently unavailable."
            raise RuntimeError(f"NLI inference failed: {err}")

        # Model predict with softmax over logits
        # pairs order: (premise, hypothesis)
        raw_probs = self._model.predict(
            pairs,
            apply_softmax=True,
            batch_size=settings.nli_batch_size,
            show_progress_bar=False,
        )

        results: List[Dict[str, float]] = []
        for probs in raw_probs:
            # Map according to verified id2label: {0: contradiction, 1: entailment, 2: neutral}
            p_contra = float(probs[LABEL_CONTRADICTION])
            p_supp = float(probs[LABEL_ENTAILMENT])
            p_unver = float(probs[LABEL_NEUTRAL])

            results.append({
                VERDICT_SUPPORTED: p_supp,
                VERDICT_CONTRADICTED: p_contra,
                VERDICT_UNVERIFIED: p_unver,
            })

        return results

    def evaluate_claim_against_evidence(
        self,
        claim_text: str,
        evidence_chunks: List[EvidenceChunkResponse],
        claim_type: str = "factual",
    ) -> ClaimNLIResult:
        """
        Evaluates a claim against retrieved evidence chunks.
        Performs multi-passage evaluation, transparent aggregation,
        and uncalibrated risk score computation.
        """
        cleaned_claim = " ".join(claim_text.strip().split())
        if not cleaned_claim:
            raise ValueError("Claim text cannot be empty.")

        # Handle missing or empty evidence retrieval
        if not evidence_chunks:
            return ClaimNLIResult(
                claim_text=cleaned_claim,
                claim_type=claim_type,
                verdict=VERDICT_UNVERIFIED,
                confidence=0.0,
                risk_level="MEDIUM",
                risk_score=0.50,
                explanation="No relevant evidence passages found in document to verify or refute this claim.",
                deciding_passage=None,
                all_passages=[],
            )

        # Prepare pairs: Premise = evidence passage, Hypothesis = claim text
        # Order is (Premise, Hypothesis)
        pairs = [(chunk.chunk_text, cleaned_claim) for chunk in evidence_chunks]
        nli_outputs = self.predict_probabilities(pairs)

        passage_results: List[PassageNLIResult] = []
        for i, chunk in enumerate(evidence_chunks):
            probs = nli_outputs[i]
            p_supp = probs[VERDICT_SUPPORTED]
            p_contra = probs[VERDICT_CONTRADICTED]
            p_unver = probs[VERDICT_UNVERIFIED]

            # Determine passage verdict
            if p_contra >= settings.nli_contradiction_threshold and p_contra > p_supp:
                p_verdict = VERDICT_CONTRADICTED
            elif p_supp >= settings.nli_support_threshold and p_supp > p_contra:
                p_verdict = VERDICT_SUPPORTED
            else:
                p_verdict = VERDICT_UNVERIFIED

            passage_results.append(
                PassageNLIResult(
                    evidence_text=chunk.chunk_text,
                    document_id=chunk.document_id,
                    source_filename=chunk.source_filename,
                    page_number=chunk.page_number,
                    chunk_id=chunk.chunk_id,
                    retrieval_score=chunk.retrieval_score,
                    p_supported=round(p_supp, 4),
                    p_contradicted=round(p_contra, 4),
                    p_unverified=round(p_unver, 4),
                    verdict=p_verdict,
                )
            )

        # ── Transparent Aggregation Strategy ────────────────────────────────
        # Rule 1: Contradiction priority for hallucination safety.
        # If any passage contradicts the claim, flag CONTRADICTED.
        contradicting = [p for p in passage_results if p.verdict == VERDICT_CONTRADICTED]
        supporting = [p for p in passage_results if p.verdict == VERDICT_SUPPORTED]

        if contradicting:
            # Sort by highest contradiction probability
            contradicting.sort(key=lambda x: x.p_contradicted, reverse=True)
            deciding = contradicting[0]
            verdict = VERDICT_CONTRADICTED
            confidence = deciding.p_contradicted
            risk_level = "HIGH"
            # Explicit uncalibrated risk score: 0.70 to 1.0 based on contradiction confidence
            risk_score = round(max(0.70, confidence), 4)
            explanation = (
                f"Contradicted by evidence on page {deciding.page_number} of '{deciding.source_filename}' "
                f"(contradiction score: {deciding.p_contradicted:.1%})."
            )

        elif supporting:
            # Sort by highest support probability
            supporting.sort(key=lambda x: x.p_supported, reverse=True)
            deciding = supporting[0]
            verdict = VERDICT_SUPPORTED
            confidence = deciding.p_supported
            risk_level = "LOW"
            # Explicit uncalibrated risk score: < 0.30
            risk_score = round(max(0.05, 1.0 - confidence), 4)
            explanation = (
                f"Supported by evidence on page {deciding.page_number} of '{deciding.source_filename}' "
                f"(entailment score: {deciding.p_supported:.1%})."
            )

        else:
            # All passages were neutral / unverified
            # NEVER present neutral evidence as proof that a claim is false!
            passage_results.sort(key=lambda x: x.retrieval_score, reverse=True)
            deciding = passage_results[0]
            verdict = VERDICT_UNVERIFIED
            confidence = deciding.p_unverified
            risk_level = "MEDIUM"
            # Neutral / uncertain risk
            risk_score = 0.50
            explanation = (
                f"Unverified: Retained evidence on page {deciding.page_number} does not provide "
                f"sufficient conclusive proof to confirm or refute the claim."
            )

        return ClaimNLIResult(
            claim_text=cleaned_claim,
            claim_type=claim_type,
            verdict=verdict,
            confidence=round(confidence, 4),
            risk_level=risk_level,
            risk_score=risk_score,
            explanation=explanation,
            source_sentence=cleaned_claim,
            deciding_passage=deciding,
            all_passages=passage_results,
        )


# Singleton pattern
_nli_service_instance: Optional[NLIService] = None
_nli_service_lock = threading.Lock()


def get_nli_service() -> NLIService:
    """Returns singleton NLIService instance."""
    global _nli_service_instance
    if _nli_service_instance is None:
        with _nli_service_lock:
            if _nli_service_instance is None:
                _nli_service_instance = NLIService()
    return _nli_service_instance
