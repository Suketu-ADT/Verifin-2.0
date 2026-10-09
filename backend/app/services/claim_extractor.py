"""
Claim extraction service for partitioning LLM outputs into verifiable financial claims.
"""

from __future__ import annotations

import re
from typing import List, TypedDict


class ExtractedClaim(TypedDict):
    claim_text: str
    claim_type: str
    source_sentence: str


class ClaimExtractor:
    """Extracts discrete verifiable financial claims from LLM output."""

    DISCARD_PREFIXES = (
        "here is",
        "here are",
        "based on",
        "according to",
        "in summary",
        "to summarize",
        "sure,",
        "certainly,",
        "hope this helps",
        "let me know",
    )

    NUMERICAL_PATTERN = re.compile(
        r"(\$\d+|\d+\%|\d+\s*(?:billion|million|trillion|thousand|cents|percent)|\b\d{4}\b|\b\d+(?:\.\d+)?\b)",
        re.IGNORECASE,
    )

    def extract_claims(self, text: str) -> List[ExtractedClaim]:
        """Splits LLM output into discrete financial claims with type classification."""
        if not text or not text.strip():
            return []

        # Split into candidate lines/sentences
        lines = text.strip().splitlines()
        raw_sentences: List[str] = []

        for line in lines:
            cleaned_line = line.strip()
            # Strip markdown bullets or numbered lists
            cleaned_line = re.sub(r"^[-*•]\s*", "", cleaned_line)
            cleaned_line = re.sub(r"^\d+[\.\)]\s*", "", cleaned_line)
            cleaned_line = cleaned_line.strip()

            if not cleaned_line:
                continue

            # Split line into sentences
            parts = re.split(r"(?<=[.!?])\s+", cleaned_line)
            for p in parts:
                p_clean = p.strip()
                if p_clean:
                    raw_sentences.append(p_clean)

        extracted: List[ExtractedClaim] = []
        for sentence in raw_sentences:
            cleaned = " ".join(sentence.split())
            if len(cleaned) < 10:  # Skip trivial fragments
                continue

            # Check if it's conversational boilerplate or header ending with colon
            lower_s = cleaned.lower()
            if any(lower_s.startswith(prefix) for prefix in self.DISCARD_PREFIXES) and (len(cleaned) < 80 or cleaned.endswith(":")):
                continue
            if cleaned.endswith(":") and len(cleaned) < 80:
                continue

            # Classify claim type
            has_numerical = bool(self.NUMERICAL_PATTERN.search(cleaned))
            claim_type = "numerical" if has_numerical else "factual"

            extracted.append({
                "claim_text": cleaned,
                "claim_type": claim_type,
                "source_sentence": cleaned,
            })

        return extracted
