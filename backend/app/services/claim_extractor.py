"""
Claim extraction service for partitioning LLM outputs into verifiable financial claims.
Supports compound sentence decomposition, financial metric tagging, and atomic claim generation.
"""

from __future__ import annotations

import re
from typing import List, Optional, TypedDict


class ExtractedClaim(TypedDict):
    claim_text: str
    claim_type: str
    source_sentence: str
    target_metric: Optional[str]


class ClaimExtractor:
    """
    Extracts discrete verifiable financial claims from LLM output.
    Performs atomic decomposition of compound statements, metric detection,
    and conversational boilerplate filtering.
    """

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
        "in conclusion",
        "overall,",
    )

    NUMERICAL_PATTERN = re.compile(
        r"(\$\d+|\d+\%|\d+\s*(?:billion|million|trillion|thousand|cents|percent)|\b\d{4}\b|\b\d+(?:\.\d+)?\b)",
        re.IGNORECASE,
    )

    COMPARATIVE_PATTERN = re.compile(
        r"\b(increase|increased|growth|grew|rise|rose|higher|decrease|decreased|decline|declined|fell|drop|lower|compared to|year-over-year|yoy)\b",
        re.IGNORECASE,
    )

    MULTI_HOP_METRICS = re.compile(
        r"\b(net\s+debt|free\s+cash\s+flow|gross\s+margin|operating\s+margin|working\s+capital|current\s+ratio|quick\s+ratio|ebitda)\b",
        re.IGNORECASE,
    )

    METRIC_TAGS = {
        "revenue": re.compile(r"\b(revenue|revenues|sales|turnover|net\s+sales)\b", re.IGNORECASE),
        "net_income": re.compile(r"\b(net\s+income|net\s+profit|net\s+earnings|bottom\s+line)\b", re.IGNORECASE),
        "operating_income": re.compile(r"\b(operating\s+income|operating\s+profit|ebit|operating\s+loss)\b", re.IGNORECASE),
        "margin": re.compile(r"\b(gross\s+margin|operating\s+margin|profit\s+margin|ebitda\s+margin)\b", re.IGNORECASE),
        "debt": re.compile(r"\b(net\s+debt|total\s+debt|term\s+debt|long-term\s+debt|borrowings)\b", re.IGNORECASE),
        "eps": re.compile(r"\b(eps|earnings\s+per\s+share|diluted\s+eps)\b", re.IGNORECASE),
        "cash_flow": re.compile(r"\b(cash\s+flow|operating\s+cash|free\s+cash\s+flow)\b", re.IGNORECASE),
    }

    def extract_claims(self, text: str) -> List[ExtractedClaim]:
        """
        Splits LLM output into discrete financial claims with rich type classification.
        Decomposes compound sentences with multiple financial assertions into atomic claims.
        """
        if not text or not text.strip():
            return []

        # 1. Split into candidate lines
        lines = text.strip().splitlines()
        raw_sentences: List[str] = []

        for line in lines:
            cleaned_line = line.strip()
            # Strip markdown bullet characters or numbered lists e.g. "- ", "* ", "1. "
            cleaned_line = re.sub(r"^[-*•]\s*", "", cleaned_line)
            cleaned_line = re.sub(r"^\d+[\.\)]\s*", "", cleaned_line)
            cleaned_line = cleaned_line.strip()

            if not cleaned_line:
                continue

            # Split line into sentences by sentence delimiters (. ! ?)
            parts = self._split_sentences(cleaned_line)
            for p in parts:
                p_clean = p.strip()
                if p_clean:
                    raw_sentences.append(p_clean)

        extracted: List[ExtractedClaim] = []

        for sentence in raw_sentences:
            cleaned = " ".join(sentence.split())
            if len(cleaned) < 10:  # Skip trivial fragments
                continue

            # Filter conversational filler or headings ending with colon
            # Lead-in phrases such as "According to the 10-K, revenue rose 12%."
            # still carry a verifiable claim, so only discard short lead-ins that
            # contain no figures or financial metrics (or that end with a colon).
            lower_s = cleaned.lower()
            if any(lower_s.startswith(prefix) for prefix in self.DISCARD_PREFIXES) and (
                cleaned.endswith(":")
                or (len(cleaned) < 80 and not self._has_verifiable_content(cleaned))
            ):
                continue
            if cleaned.endswith(":") and len(cleaned) < 80:
                continue

            # Check if sentence is compound and contains multiple atomic assertions
            atomic_claims = self._decompose_compound_sentence(cleaned)

            for claim_text in atomic_claims:
                claim_type = self._classify_claim_type(claim_text)
                target_metric = self._detect_target_metric(claim_text)

                extracted.append({
                    "claim_text": claim_text,
                    "claim_type": claim_type,
                    "source_sentence": cleaned,
                    "target_metric": target_metric,
                })

        return extracted

    ABBREVIATIONS = {
        "n.a.", "inc.", "ltd.", "co.", "corp.", "rs.", "no.", "nos.", "u.s.", "u.k.", "approx.", "vs.",
        "mr.", "mrs.", "ms.", "dr.", "e.g.", "i.e.", "etc.", "fig.", "st.", "pvt.", "llc.", "l.p.",
        "plc.", "sr.", "jr.", "mn.", "bn.", "est.", "avg.", "dept.", "cr.",
    }

    def _split_sentences(self, line: str) -> List[str]:
        """Split on . ! ? followed by space, except after abbreviations, initials or before lowercase text."""
        sentences: List[str] = []
        start = 0
        for m in re.finditer(r"[.!?]\s+", line):
            end = m.start() + 1
            word = line[start:end].split()[-1].lower() if line[start:end].split() else ""
            nxt = line[m.end():m.end() + 1]
            if line[m.start()] == ".":
                if word in self.ABBREVIATIONS or re.fullmatch(r"(?:[a-z]\.){1,}", word):
                    continue  # "Bank, N.A. were ..." or initials such as "J. P."
                if nxt.islower():
                    continue  # no capital letter after the full stop: not a sentence start
            sentences.append(line[start:end])
            start = m.end()
        sentences.append(line[start:])
        return [x.strip() for x in sentences if x.strip()]

    LEAD_IN = re.compile(
        r"^((?:in|for|during|as of|as at|over|at|by|since|throughout|between|within)\b[^,]{3,80},)\s+",
        re.IGNORECASE,
    )
    PERIOD_WORD = re.compile(r"\b(?:year|quarter|period|month|months|fiscal|half|h1|h2|q[1-4])\b|\bfy\s?\d{2,4}\b|\b(?:19|20)\d\d\b", re.IGNORECASE)
    VERB_START = re.compile(
        r"^(?:\w+ed|was|were|is|are|has|have|had|will|would|can|could|expects?|reports?|delivers?|achieves?|remains?)$",
        re.IGNORECASE,
    )

    def _with_lead_in(self, whole: str, parts: List[str]) -> List[str]:
        """Give later parts the period lead-in of the sentence ("In FY25, ...") so each stays verifiable."""
        m = self.LEAD_IN.match(whole)
        if not m or not self.PERIOD_WORD.search(m.group(1)):
            return parts
        lead = m.group(1)
        out = [parts[0]]
        for part in parts[1:]:
            has_period = bool(self.PERIOD_WORD.search(part))
            out.append(part if has_period or part.lower().startswith(lead.lower()[:10]) else f"{lead} {part}")
        return out

    def _has_verifiable_content(self, text: str) -> bool:
        """True if the text mentions a figure or a known financial metric."""
        return bool(self.NUMERICAL_PATTERN.search(text)) or any(
            pattern.search(text) for pattern in self.METRIC_TAGS.values()
        )

    def _decompose_compound_sentence(self, sentence: str) -> List[str]:
        """
        Decomposes compound sentence connected by conjunctions (and, while, whereas, ;)
        when both clauses contain independent financial assertions.
        """
        # Semicolon splitting
        if ";" in sentence:
            subparts = [p.strip() for p in sentence.split(";") if len(p.strip()) >= 15]
            if len(subparts) > 1 and all(bool(self.NUMERICAL_PATTERN.search(p)) for p in subparts):
                return self._with_lead_in(sentence, subparts)

        # Check for conjunction patterns connecting two numerical or metric clauses
        conjunction_patterns = [
            r"\s*,\s*and\s+",
            r"\s*,\s*while\s+",
            r"\s*,\s*whereas\s+",
            r"\s*,\s*as\s+well\s+as\s+",
        ]

        for pat in conjunction_patterns:
            parts = re.split(pat, sentence, flags=re.IGNORECASE)
            if len(parts) == 2:
                p0, p1 = parts[0].strip(), parts[1].strip()
                # If both parts contain verifiable numbers or metrics, split them
                first_word = p1.split()[0].strip(",.") if p1.split() else ""
                if (
                    len(p0) >= 20 and len(p1) >= 20
                    and bool(self.NUMERICAL_PATTERN.search(p0))
                    and bool(self.NUMERICAL_PATTERN.search(p1))
                    and not self.VERB_START.match(first_word)  # a part without its own subject stays attached
                ):
                    # Ensure first part ends with period
                    if not p0.endswith("."):
                        p0 = f"{p0}."
                    # If second part lacks subject, it's safer kept as is or standalone
                    if not p1.endswith("."):
                        p1 = f"{p1}."
                    return self._with_lead_in(sentence, [p0, p1])

        # Return original sentence as single atomic claim
        return [sentence]

    def _classify_claim_type(self, text: str) -> str:
        """Determines claim type based on content."""
        if self.MULTI_HOP_METRICS.search(text):
            return "numerical"
        if self.NUMERICAL_PATTERN.search(text):
            return "numerical"
        return "factual"

    def _detect_target_metric(self, text: str) -> Optional[str]:
        """Identifies target financial metric mentioned in claim."""
        for metric_name, pattern in self.METRIC_TAGS.items():
            if pattern.search(text):
                return metric_name
        return None
