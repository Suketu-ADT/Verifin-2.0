"""
Figure grounding for VERIFIN 2.0.

Checks whether the figures a claim states (amounts, percentages, counts) actually appear
in the retrieved evidence, and whether the evidence states a *different* figure for the
same fact. Unlike derived-arithmetic checks, nothing is computed from numbers the claim
never mentioned, so unrelated footnote or page numbers in the evidence cannot create a
false "mismatch".

Handles Indian grouping (3,71,085), crore / lakh / lakh crore, million / billion /
trillion, percentages, and the rupee sign being extracted as "H", "I" or a backtick.
"""

from __future__ import annotations

import re
import threading
from dataclasses import dataclass, field
from typing import Dict, Iterable, List, Optional, Sequence, Set, Tuple

GROUNDED = "GROUNDED"          # every figure in the claim appears in the evidence
CONFLICT = "CONFLICT"          # evidence about the same fact states a different figure
UNGROUNDED = "UNGROUNDED"      # figures not found, and no matching fact to compare against
NO_FIGURES = "NO_FIGURES"      # the claim states no checkable figure

UNIT_SCALE: Dict[str, float] = {
    "lakh crore": 1e12, "lakh crores": 1e12,
    "crore": 1e7, "crores": 1e7,
    "lakh": 1e5, "lakhs": 1e5,
    "trillion": 1e12, "tn": 1e12, "trn": 1e12,
    "billion": 1e9, "bn": 1e9,
    "million": 1e6, "mn": 1e6,
    "thousand": 1e3,
}

_FIGURE_RE = re.compile(
    r"(?P<cur>US\$|USD|INR|Rs\.?|₹|\$|€|£|(?<![A-Za-z0-9])[HI`](?=\s?\d))?\s?"
    r"(?P<num>\d+(?:,\d+)*(?:\.\d+)?)"
    r"(?:\s?(?P<unit>lakh\s+crores?|crores?|lakhs?|trillion|billion|million|thousand|bn|mn|trn|tn)\b)?"
    r"(?P<pct>\s?(?:%|per\s?cent\b|percent\b|bps\b|basis\s+points\b))?",
    re.IGNORECASE,
)

_STOPWORDS: Set[str] = {
    "this", "that", "with", "from", "which", "were", "been", "have", "their", "there", "these",
    "those", "than", "then", "also", "such", "into", "over", "under", "during", "while", "about",
    "other", "more", "most", "some", "year", "years", "ended", "company", "firm", "bank", "total",
    "per", "cent", "percent", "crore", "crores", "lakh", "million", "billion",
}
_WORD_RE = re.compile(r"[a-z][a-z\-]{3,}")
_SENT_SPLIT = re.compile(r"(?<=[.!?])\s+(?=[A-Z0-9₹$`])")
_MONTHS = {"january", "february", "march", "april", "may", "june", "july", "august", "september",
           "october", "november", "december"}


@dataclass
class Figure:
    text: str
    value: float                 # as written (e.g. 371085 for "3,71,085 crore")
    scale: Optional[float]       # unit multiplier if a unit word was present
    is_pct: bool
    decimals: int
    is_bps: bool = False
    start: int = 0
    end: int = 0

    @property
    def normalized(self) -> float:
        return self.value * (self.scale or 1.0)


def _is_year_like(value: float, raw: str, has_unit: bool, is_pct: bool, has_cur: bool) -> bool:
    return (
        1900 <= value <= 2100 and "," not in raw and "." not in raw
        and not has_unit and not is_pct and not has_cur
    )


def extract_figures(text: str) -> List[Figure]:
    """Checkable figures in `text`: anything with a currency, unit or percent, or a large/decimal number."""
    figures: List[Figure] = []
    for m in _FIGURE_RE.finditer(text or ""):
        raw = m.group("num")
        end = m.end()
        unit = m.group("unit")
        pct = m.group("pct")
        cur = m.group("cur")
        # reject ordinals / identifiers such as "31st", "2nd", "10K" glued to letters
        if not unit and not pct and end < len(text) and text[end:end + 1].isalpha():
            continue
        # reject numbers glued to a preceding letter ("Q3", "FY25", "Tier2")
        start = m.start("num")
        if start > 0 and text[start - 1].isalpha() and not cur:
            continue
        try:
            value = float(raw.replace(",", ""))
        except ValueError:
            continue
        if _is_year_like(value, raw, bool(unit), bool(pct), bool(cur)):
            continue
        has_marker = bool(unit or pct or cur)
        if not has_marker and not ("," in raw or "." in raw or value >= 1000):
            continue  # bare small integers are dates, list numbers or counts
        scale = UNIT_SCALE.get(re.sub(r"\s+", " ", unit.lower())) if unit else None
        is_bps = bool(pct and ("bps" in pct.lower() or "basis" in pct.lower()))
        if is_bps:
            value = value / 100.0
        figures.append(Figure(
            text=m.group(0).strip(), value=value, scale=scale,
            is_pct=bool(pct), decimals=len(raw.split(".")[1]) if "." in raw else 0, is_bps=is_bps,
            start=m.start(), end=m.end(),
        ))
    return figures


def figures_match(claim: Figure, evidence: Figure) -> bool:
    if claim.is_pct != evidence.is_pct:
        return False
    if claim.is_pct:
        a, b = claim.value, evidence.value
    else:
        if claim.scale and evidence.scale:
            a, b = claim.normalized, evidence.normalized
        else:
            # one side states no unit (e.g. a table column header carries it): compare as written
            a, b = claim.value, evidence.value
    if a == b:
        return True
    if abs(a - b) <= 0.005 * max(abs(a), abs(b)):
        return True
    # the claim may round the evidence ("12%" for 12.4%, "$1.9 billion" for 1.87)
    return round(b, claim.decimals) == round(a, claim.decimals) and claim.decimals < evidence.decimals


def content_words(text: str, include_figures: bool = True) -> Set[str]:
    words = {w for w in _WORD_RE.findall((text or "").lower()) if w not in _STOPWORDS}
    if include_figures:
        # figures count as content so the sentence that states the same numbers aligns best
        for f in extract_figures(text or ""):
            words.add(f"#{f.normalized:g}")
    return words


def split_sentences(text: str) -> List[str]:
    parts = [" ".join(p.split()) for p in _SENT_SPLIT.split(text or "")]
    return [p for p in parts if len(p) > 20]


def alignment(claim_words: Set[str], passage: str) -> float:
    if not claim_words:
        return 0.0
    return len(claim_words & content_words(passage)) / len(claim_words)


def evidence_windows(passages: Sequence[str], pairs: bool = True) -> List[str]:
    """One- and two-sentence windows over the evidence (claims often span two sentences)."""
    windows: List[str] = []
    for passage in passages:
        sentences = split_sentences(passage) or [" ".join((passage or "").split())]
        windows.extend(sentences)
        if pairs:
            windows.extend(f"{a} {b}" for a, b in zip(sentences, sentences[1:]))
    return [w for w in windows if w]


def best_anchor(claim: str, passages: Sequence[str]) -> Tuple[Optional[str], float]:
    """The evidence window that most overlaps the claim (shorter wins ties), and its score."""
    claim_words = content_words(claim)
    best, best_score = None, 0.0
    for window in evidence_windows(passages):
        score = alignment(claim_words, window)
        if score > best_score + 1e-9 or (abs(score - best_score) <= 1e-9 and best and len(window) < len(best)):
            best, best_score = window, score
    return best, best_score


@dataclass
class GroundingResult:
    status: str
    explanation: str = ""
    claim_figures: List[str] = field(default_factory=list)
    matched: List[str] = field(default_factory=list)
    unmatched: List[str] = field(default_factory=list)
    conflicts: List[Tuple[str, str]] = field(default_factory=list)
    anchor_sentence: Optional[str] = None
    anchor_overlap: float = 0.0


LOCAL_MIN_OVERLAP = 0.4     # a window must share this much of the figure's local context to be compared
CONTEXT_CHARS = 70          # claim text on each side of a figure that describes what it measures


def ground_figures(claim: str, passages: Sequence[str]) -> GroundingResult:
    """
    Check each figure of `claim` against `passages` (retrieved evidence, best first).

    Each figure is compared with the evidence window that best matches the words around it
    in the claim. If that window states a different figure of the same kind the figure is in
    CONFLICT, even if the same value occurs somewhere else in the evidence.
    """
    claim_figs = extract_figures(claim)
    if not claim_figs:
        return GroundingResult(NO_FIGURES, "The claim states no checkable figure.")

    windows = [(w, extract_figures(w), content_words(w, include_figures=False)) for w in evidence_windows(passages)]
    all_evidence_figs = [f for p in passages for f in extract_figures(p)]

    matched: List[Figure] = []
    unmatched: List[Figure] = []
    conflicts: List[Tuple[str, str]] = []

    # A single evidence sentence stating every figure of the claim grounds it as a whole.
    claim_words = content_words(claim, include_figures=False)
    for sentence in evidence_windows(passages, pairs=False):
        w_figs = extract_figures(sentence)
        if not w_figs or len(claim_words & content_words(sentence, include_figures=False)) < LOCAL_MIN_OVERLAP * len(claim_words):
            continue
        if all(any(figures_match(cf, ef) for ef in w_figs) for cf in claim_figs):
            anchor, overlap = best_anchor(claim, passages)
            return GroundingResult(
                status=GROUNDED,
                claim_figures=[f.text for f in claim_figs],
                matched=[f.text for f in claim_figs],
                anchor_sentence=anchor,
                anchor_overlap=round(overlap, 3),
                explanation=f"All figures in the claim appear together in the evidence: "
                            f"{', '.join(f.text for f in claim_figs)}.",
            )

    for cf in claim_figs:
        context = claim[max(0, cf.start - CONTEXT_CHARS): cf.end + CONTEXT_CHARS]
        ctx_words = content_words(context, include_figures=False)
        local, local_score = None, 0.0
        for w, w_figs, w_words in windows:
            if not ctx_words or not w_figs:
                continue
            score = len(ctx_words & w_words) / len(ctx_words)
            if score > local_score + 1e-9 or (abs(score - local_score) <= 1e-9 and local and len(w) < len(local[0])):
                local, local_score = (w, w_figs), score

        if local and local_score >= LOCAL_MIN_OVERLAP:
            if any(figures_match(cf, ef) for ef in local[1]):
                matched.append(cf)
                continue
            rivals = [af for af in local[1] if af.is_pct == cf.is_pct]
            if rivals:
                rival = min(rivals, key=lambda a: abs(a.normalized - cf.normalized))
                conflicts.append((cf.text, rival.text))
                unmatched.append(cf)
                continue
        # no comparable local context: accept the figure if it is stated anywhere in the evidence
        if any(figures_match(cf, ef) for ef in all_evidence_figs):
            matched.append(cf)
            continue
        # same number written with a different unit ("$5 million" vs "$5 billion") is a unit error
        twin = next(
            (ef for ef in all_evidence_figs
             if ef.is_pct == cf.is_pct and ef.value == cf.value and ef.scale and cf.scale and ef.scale != cf.scale),
            None,
        )
        if twin is not None:
            conflicts.append((cf.text, twin.text))
        unmatched.append(cf)

    anchor, overlap = best_anchor(claim, passages)
    result = GroundingResult(
        status=GROUNDED,
        claim_figures=[f.text for f in claim_figs],
        matched=[f.text for f in matched],
        unmatched=[f.text for f in unmatched],
        conflicts=conflicts,
        anchor_sentence=anchor,
        anchor_overlap=round(overlap, 3),
    )
    if not unmatched:
        result.explanation = f"All figures in the claim appear in the evidence: {', '.join(result.matched)}."
    elif conflicts:
        result.status = CONFLICT
        pairs = "; ".join(f"claim says {c} but the evidence says {e}" for c, e in conflicts)
        result.explanation = f"Figure conflict with the matching evidence passage: {pairs}."
    else:
        result.status = UNGROUNDED
        result.explanation = (
            f"Figures not found in the evidence: {', '.join(result.unmatched)}; "
            "no closely matching evidence passage to compare against."
        )
    return result


# ── Reporting period alignment ───────────────────────────────────────────────

_RANGE_RE = re.compile(r"\b((?:19|20)\d\d)\s?[-\u2013/]\s?((?:19|20)?\d\d)\b")
_FY_RE = re.compile(r"\bFY\s?['\u2019]?\s?((?:19|20)?\d\d)\b", re.IGNORECASE)
_FISCAL_RE = re.compile(r"\bfiscal(?:\s+year)?\s+((?:19|20)?\d\d)\b", re.IGNORECASE)
_YEAR_RE2 = re.compile(r"(?<![\d,.])((?:19|20)\d\d)(?![\d%]|[.,]\d)")


def _full_year(token: str, pivot: int = 2000) -> int:
    n = int(token)
    return n if n >= 100 else pivot + n


def period_years(text: str) -> Set[int]:
    """
    Reporting years mentioned in `text`, as the year the period ends: FY25, FY 2025,
    2024-25, 'March 31, 2025' and plain 2025 all give 2025.
    """
    years: Set[int] = set()
    remaining = text or ""

    def take(pattern, group_to_year):
        nonlocal remaining
        for m in pattern.finditer(remaining):
            y = group_to_year(m)
            if 1990 <= y <= 2100:
                years.add(y)
        remaining = pattern.sub(" ", remaining)

    def range_end(m):
        start, end = int(m.group(1)), m.group(2)
        return _full_year(end, pivot=(start // 100) * 100) if len(end) == 2 else int(end)

    take(_RANGE_RE, range_end)
    take(_FY_RE, lambda m: _full_year(m.group(1)))
    take(_FISCAL_RE, lambda m: _full_year(m.group(1)))
    take(_YEAR_RE2, lambda m: int(m.group(1)))
    return years


def check_period(claim: str, evidence_window: Optional[str]):
    """
    Compare the claim's reporting year(s) with the evidence window that matches it.
    MISALIGNED only when both state years and they share none.
    """
    from app.services.numerical_reasoner import TemporalAnchor

    claim_years = period_years(claim)
    evidence_years = period_years(evidence_window or "")

    def fmt(ys):
        return ", ".join(str(y) for y in sorted(ys)) or None

    anchor = TemporalAnchor(claim_period=fmt(claim_years), evidence_period=fmt(evidence_years))
    if not claim_years or not evidence_years:
        anchor.period_match = "UNSPECIFIED"
        anchor.explanation = "The claim or its matching evidence states no reporting period."
    elif claim_years & evidence_years:
        anchor.period_match = "ALIGNED"
        anchor.explanation = f"Claim period {anchor.claim_period} appears in the evidence."
    else:
        anchor.period_match = "MISALIGNED"
        anchor.explanation = (
            f"Claim states period {anchor.claim_period} but the matching evidence states {anchor.evidence_period}."
        )
    return anchor


# ── Entity novelty ───────────────────────────────────────────────────────────

_CAPITALIZED_RE = re.compile(r"\b[A-Z][a-zA-Z]{3,}\b")
_vocab_cache: Dict[Tuple[str, int], Set[str]] = {}
_vocab_lock = threading.Lock()


def document_vocabulary(document_id: str, texts: Iterable[str], size_hint: int) -> Set[str]:
    key = (document_id, size_hint)
    with _vocab_lock:
        cached = _vocab_cache.get(key)
        if cached is not None:
            return cached
        vocab: Set[str] = set()
        for t in texts:
            vocab.update(re.findall(r"[a-z0-9]+", t.lower()))
        if len(_vocab_cache) >= 12:
            _vocab_cache.pop(next(iter(_vocab_cache)))
        _vocab_cache[key] = vocab
        return vocab


def novel_entities(claim: str, vocabulary: Set[str]) -> List[str]:
    """Capitalised names in the claim that occur nowhere in the document."""
    if not vocabulary:
        return []
    tokens = _CAPITALIZED_RE.findall(claim or "")
    first = (claim or "").split()[:1]
    out: List[str] = []
    for tok in tokens:
        low = tok.lower()
        if low in vocabulary or low in _MONTHS or low in out:
            continue
        if first and tok == first[0].strip(",.;:"):
            continue  # sentence-initial words are capitalised regardless
        out.append(low)
    return out
