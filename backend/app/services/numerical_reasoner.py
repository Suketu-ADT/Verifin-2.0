"""
Modular Numerical and Temporal Reasoning Service for VERIFIN 2.0.

Provides deterministic arithmetic verification, unit and currency validation,
rounding tolerance checking, and temporal grounding against financial documents.
Keeps numerical findings decoupled from NLI verdicts.
"""

from __future__ import annotations

import math
import re
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple


@dataclass
class NumericEntity:
    raw_text: str
    value: float
    currency: Optional[str] = None
    unit_multiplier: float = 1.0
    unit_name: Optional[str] = None
    is_percentage: bool = False
    is_negative: bool = False
    normalized_value: float = 0.0

    def __post_init__(self):
        sign = -1.0 if self.is_negative else 1.0
        self.normalized_value = sign * self.value * self.unit_multiplier


@dataclass
class TemporalPeriod:
    raw_text: str
    period_type: str  # "FY", "QUARTER", "YEAR", "DATE", "GENERIC"
    year: Optional[int] = None
    quarter: Optional[int] = None
    is_ambiguous: bool = False


@dataclass
class NumericalFinding:
    finding_type: str  # "PERCENTAGE_CHANGE", "ABSOLUTE_DIFFERENCE", "MARGIN_RATIO", "CURRENCY_UNIT_CONSISTENCY", "DIRECT_MATCH", "NO_CALCULATION"
    formula: Optional[str] = None
    operands: Dict[str, Any] = field(default_factory=dict)
    computed_result: Optional[float] = None
    reported_result: Optional[float] = None
    tolerance: Optional[float] = None
    comparison_outcome: str = "NO_CALCULATION"  # "VALIDATED", "MISMATCH", "INCONSISTENT_UNITS", "INSUFFICIENT_INPUTS", "DIVISION_BY_ZERO", "AMBIGUOUS"
    explanation: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return {
            "finding_type": self.finding_type,
            "formula": self.formula,
            "operands": self.operands,
            "computed_result": self.computed_result,
            "reported_result": self.reported_result,
            "tolerance": self.tolerance,
            "comparison_outcome": self.comparison_outcome,
            "explanation": self.explanation,
        }


@dataclass
class TemporalAnchor:
    claim_period: Optional[str] = None
    evidence_period: Optional[str] = None
    document_period: Optional[str] = None
    period_match: str = "UNSPECIFIED"  # "ALIGNED", "MISALIGNED", "AMBIGUOUS", "UNSPECIFIED"
    explanation: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return {
            "claim_period": self.claim_period,
            "evidence_period": self.evidence_period,
            "document_period": self.document_period,
            "period_match": self.period_match,
            "explanation": self.explanation,
        }


class NumericalReasonerService:
    """Deterministic financial numerical and temporal reasoning engine."""

    # Currency identifiers
    CURRENCY_SYMBOLS: Dict[str, str] = {
        "$": "USD",
        "€": "EUR",
        "£": "GBP",
        "¥": "JPY",
        "₹": "INR",
        "C$": "CAD",
        "A$": "AUD",
        "CHF": "CHF",
    }

    # Financial unit scale multipliers
    UNIT_MULTIPLIERS: Dict[str, float] = {
        "trillion": 1e12,
        "trillions": 1e12,
        "t": 1e12,
        "billion": 1e9,
        "billions": 1e9,
        "b": 1e9,
        "million": 1e6,
        "millions": 1e6,
        "m": 1e6,
        "thousand": 1e3,
        "thousands": 1e3,
        "k": 1e3,
    }

    # Regex patterns (using alphanumeric boundaries so underscores/hyphens/dots in filenames match)
    YEAR_PATTERN = re.compile(r"(?<![0-9])(19\d{2}|20\d{2})(?![0-9])")
    FY_PATTERN = re.compile(
        r"(?<![a-zA-Z0-9])(?:FY\s*['’]?(\d{2,4})|fiscal\s+(?:year\s+)?(\d{4}))(?![a-zA-Z0-9])",
        re.IGNORECASE,
    )
    QUARTER_PATTERN = re.compile(
        r"(?<![a-zA-Z0-9])Q([1-4])\s*(?:(?:of|in|FY)\s*)?(\d{4})?(?![a-zA-Z0-9])",
        re.IGNORECASE,
    )
    GENERIC_PERIOD_PATTERN = re.compile(
        r"\b(the\s+(?:fiscal\s+)?year|the\s+quarter|the\s+prior\s+year|last\s+quarter|this\s+year)\b",
        re.IGNORECASE,
    )

    GROWTH_KEYWORDS = re.compile(
        r"\b(increase|increased|increasing|growth|grew|rise|rose|gain|gained|up|higher)\b",
        re.IGNORECASE,
    )
    DECLINE_KEYWORDS = re.compile(
        r"\b(decrease|decreased|decreasing|decline|declined|declining|fall|fell|loss|lost|down|lower|drop|dropped)\b",
        re.IGNORECASE,
    )
    MARGIN_KEYWORDS = re.compile(
        r"\b(margin|operating\s+margin|gross\s+margin|net\s+margin|profit\s+margin|ratio)\b",
        re.IGNORECASE,
    )

    def __init__(self, default_percentage_tolerance: float = 0.5):
        """
        Args:
            default_percentage_tolerance: Absolute difference allowed for rounding (e.g. 0.5 for 13.86% vs 14%).
        """
        self.default_percentage_tolerance = default_percentage_tolerance

    # -------------------------------------------------------------------------
    # Extraction Methods
    # -------------------------------------------------------------------------

    def extract_numeric_entities(self, text: str) -> List[NumericEntity]:
        """
        Extracts all numeric values with currencies, scale multipliers,
        percentages, and signs from a financial statement.
        """
        if not text or not text.strip():
            return []

        entities: List[NumericEntity] = []

        # Comprehensive financial regex pattern:
        # 1. Optional negative sign or parenthetical negative e.g. (12.5) or -12.5
        # 2. Currency symbol or code e.g. $, USD, EUR, etc.
        # 3. Number: digits with commas and optional decimals e.g. 1,234.56 or 307.4
        # 4. Scale unit e.g. million, billion, k, etc.
        # 5. Percentage symbol e.g. %, percent, bps
        pattern = re.compile(
            r"(?P<neg>-|\b(?:decrease\s+of|loss\s+of)\s+)??"
            r"(?P<curr>[$€£¥₹]|USD\b|EUR\b|GBP\b|JPY\b|INR\b)?"
            r"\s*"
            r"(?P<paren_open>\()?"
            r"(?P<num>\d{1,3}(?:,\d{3})*(?:\.\d+)?|\d+(?:\.\d+)?)"
            r"(?P<paren_close>\))?"
            r"\s*"
            r"(?P<unit>trillion|trillions|billion|billions|million|millions|thousand|thousands|\b[kKmMbBtT]\b)?"
            r"\s*"
            r"(?P<pct>%|\bpercent\b|\bpct\b|\bbasis\s+points\b|\bbps\b)?",
            re.IGNORECASE,
        )

        for match in pattern.finditer(text):
            num_str = match.group("num")
            if not num_str:
                continue

            raw_matched = match.group(0).strip()
            # Ignore isolated 4-digit years unless prefixed with currency or followed by unit/pct
            cleaned_num = num_str.replace(",", "")
            try:
                val = float(cleaned_num)
            except ValueError:
                continue

            curr_raw = match.group("curr")
            currency = None
            if curr_raw:
                curr_upper = curr_raw.strip().upper()
                currency = self.CURRENCY_SYMBOLS.get(curr_upper, curr_upper)

            unit_raw = match.group("unit")
            unit_name = None
            unit_mult = 1.0
            if unit_raw:
                u_lower = unit_raw.strip().lower()
                unit_name = u_lower
                unit_mult = self.UNIT_MULTIPLIERS.get(u_lower, 1.0)

            is_pct = bool(match.group("pct"))
            is_bps = bool(match.group("pct") and "bps" in match.group("pct").lower())
            if is_bps:
                val = val / 100.0  # 100 bps = 1%
                is_pct = True

            # If it's an isolated 4-digit year without currency, unit, or %, skip from numerical entity
            if (
                not curr_raw
                and not unit_raw
                and not is_pct
                and "." not in num_str
                and 1900 <= val <= 2099
            ):
                continue

            # Check for negative signs or parenthetical notation
            is_neg = False
            if match.group("neg") or (match.group("paren_open") and match.group("paren_close")):
                is_neg = True

            entities.append(
                NumericEntity(
                    raw_text=raw_matched,
                    value=val,
                    currency=currency,
                    unit_multiplier=unit_mult,
                    unit_name=unit_name,
                    is_percentage=is_pct,
                    is_negative=is_neg,
                )
            )

        return entities

    def extract_temporal_periods(self, text: str) -> List[TemporalPeriod]:
        """
        Extracts reporting periods (FY, quarters, calendar years, or generic references)
        from text without guessing unstated years.
        """
        if not text or not text.strip():
            return []

        periods: List[TemporalPeriod] = []

        # 1. FY matches (e.g. FY2024, FY24, fiscal 2023)
        for m in self.FY_PATTERN.finditer(text):
            y_str = m.group(1) or m.group(2)
            year = int(y_str) if y_str else None
            if year and year < 100:
                year += 2000
            periods.append(
                TemporalPeriod(
                    raw_text=m.group(0).strip(),
                    period_type="FY",
                    year=year,
                    is_ambiguous=False,
                )
            )

        # 2. Quarter matches (e.g. Q4 2024, Q3)
        for m in self.QUARTER_PATTERN.finditer(text):
            q_num = int(m.group(1))
            y_str = m.group(2)
            year = int(y_str) if y_str else None
            is_ambiguous = year is None
            periods.append(
                TemporalPeriod(
                    raw_text=m.group(0).strip(),
                    period_type="QUARTER",
                    year=year,
                    quarter=q_num,
                    is_ambiguous=is_ambiguous,
                )
            )

        # 3. Standalone 4-digit years (e.g. 2023, 2024)
        for m in self.YEAR_PATTERN.finditer(text):
            raw = m.group(0).strip()
            # Avoid re-adding if already part of FY or Quarter match
            if not any(raw in p.raw_text for p in periods):
                periods.append(
                    TemporalPeriod(
                        raw_text=raw,
                        period_type="YEAR",
                        year=int(raw),
                        is_ambiguous=False,
                    )
                )

        # 4. Generic ambiguous period mentions (e.g. "the fiscal year", "the quarter")
        for m in self.GENERIC_PERIOD_PATTERN.finditer(text):
            raw = m.group(0).strip()
            # Only add if no explicit period overlaps
            if not any(raw.lower() in p.raw_text.lower() for p in periods):
                periods.append(
                    TemporalPeriod(
                        raw_text=raw,
                        period_type="GENERIC",
                        year=None,
                        is_ambiguous=True,
                    )
                )

        return periods

    # -------------------------------------------------------------------------
    # Core Verification Engine
    # -------------------------------------------------------------------------

    def verify_numerical_claim(
        self,
        claim_text: str,
        evidence_text: Optional[str] = None,
        custom_tolerance: Optional[float] = None,
    ) -> NumericalFinding:
        """
        Deterministically verifies numbers, growth rates, margins, and units
        between a claim and evidence.
        """
        if not evidence_text or not evidence_text.strip():
            return NumericalFinding(
                finding_type="NO_CALCULATION",
                comparison_outcome="INSUFFICIENT_INPUTS",
                explanation="No evidence text provided to perform numerical verification.",
            )

        claim_entities = self.extract_numeric_entities(claim_text)
        evidence_entities = self.extract_numeric_entities(evidence_text)

        if not claim_entities:
            return NumericalFinding(
                finding_type="NO_CALCULATION",
                comparison_outcome="NO_CALCULATION",
                explanation="Claim contains no verifiable numeric quantities.",
            )

        # 1. Check for Currency & Unit Inconsistencies first
        unit_finding = self._check_currency_and_unit_consistency(claim_entities, evidence_entities)
        if unit_finding and unit_finding.comparison_outcome == "INCONSISTENT_UNITS":
            return unit_finding

        # 2. Check for Margins or Ratios first if margin keywords are in claim
        if bool(self.MARGIN_KEYWORDS.search(claim_text)):
            margin_finding = self._verify_margin_or_ratio(
                claim_text=claim_text,
                claim_entities=claim_entities,
                evidence_entities=evidence_entities,
                custom_tolerance=custom_tolerance,
            )
            if margin_finding is not None:
                return margin_finding

        # 3. Check for Percentage Growth or Decline
        is_growth_or_decline = bool(
            self.GROWTH_KEYWORDS.search(claim_text) or self.DECLINE_KEYWORDS.search(claim_text)
        )
        claim_pct_entities = [e for e in claim_entities if e.is_percentage]

        if is_growth_or_decline or claim_pct_entities:
            growth_finding = self._verify_percentage_change(
                claim_text=claim_text,
                claim_entities=claim_entities,
                evidence_entities=evidence_entities,
                custom_tolerance=custom_tolerance,
            )
            if growth_finding is not None:
                return growth_finding

        # 4. Check for Absolute Difference
        if is_growth_or_decline and not claim_pct_entities:
            diff_finding = self._verify_absolute_difference(
                claim_text=claim_text,
                claim_entities=claim_entities,
                evidence_entities=evidence_entities,
                custom_tolerance=custom_tolerance,
            )
            if diff_finding is not None:
                return diff_finding

        # 5. Direct Value Match fallback
        return self._verify_direct_values(
            claim_entities=claim_entities,
            evidence_entities=evidence_entities,
            custom_tolerance=custom_tolerance,
        )

    # -------------------------------------------------------------------------
    # Deterministic Reasoning Checkers
    # -------------------------------------------------------------------------

    def _verify_percentage_change(
        self,
        claim_text: str,
        claim_entities: List[NumericEntity],
        evidence_entities: List[NumericEntity],
        custom_tolerance: Optional[float] = None,
    ) -> Optional[NumericalFinding]:
        """
        Verifies percentage growth/decline formula:
        ((current - prior) / abs(prior)) * 100
        """
        claim_pct = next((e for e in claim_entities if e.is_percentage), None)
        if not claim_pct:
            return None

        reported_pct = claim_pct.normalized_value

        # Need at least two non-percentage values in evidence to compute growth
        non_pct_evidence = [e for e in evidence_entities if not e.is_percentage]

        if len(non_pct_evidence) < 2:
            return NumericalFinding(
                finding_type="PERCENTAGE_CHANGE",
                formula="((current - prior) / abs(prior)) * 100",
                operands={"reported": reported_pct},
                reported_result=reported_pct,
                comparison_outcome="INSUFFICIENT_INPUTS",
                explanation=(
                    f"Claim reports {reported_pct}% change, but evidence contains {len(non_pct_evidence)} "
                    f"base values (minimum 2 required: current and prior)."
                ),
            )

        # Identify current and prior operands
        # In financial texts, often ordered as (current, prior) or (prior, current)
        current_entity, prior_entity = self._pair_current_and_prior(
            non_pct_evidence, is_decline=bool(self.DECLINE_KEYWORDS.search(claim_text))
        )

        current_val = current_entity.normalized_value
        prior_val = prior_entity.normalized_value

        # Division by zero safety
        if prior_val == 0.0:
            return NumericalFinding(
                finding_type="PERCENTAGE_CHANGE",
                formula="((current - prior) / abs(prior)) * 100",
                operands={"current": current_val, "prior": prior_val},
                reported_result=reported_pct,
                comparison_outcome="DIVISION_BY_ZERO",
                explanation="Prior period base value is zero; percentage growth is mathematically undefined.",
            )

        # Formula calculation: ((current - prior) / abs(prior)) * 100
        computed_pct = ((current_val - prior_val) / abs(prior_val)) * 100.0

        # Adjust sign if claim was explicitly framed as a decline/decrease
        # e.g., "declined by 10%" implies reported magnitude is -10% or |change| = 10%
        tolerance = custom_tolerance if custom_tolerance is not None else self.default_percentage_tolerance

        diff = abs(computed_pct - reported_pct)
        # Also compare absolute values if claim phrased as "decreased by X%" where X is positive
        if diff > tolerance and bool(self.DECLINE_KEYWORDS.search(claim_text)):
            diff = abs(abs(computed_pct) - abs(reported_pct))

        outcome = "VALIDATED" if diff <= tolerance else "MISMATCH"

        explanation = (
            f"Formula: (({current_val} - {prior_val}) / |{prior_val}|) * 100 = {computed_pct:.4f}%. "
            f"Reported value: {reported_pct}%. Tolerance: ±{tolerance}%. Difference: {diff:.4f}% -> {outcome}."
        )

        return NumericalFinding(
            finding_type="PERCENTAGE_CHANGE",
            formula="((current - prior) / abs(prior)) * 100",
            operands={"current": current_val, "prior": prior_val},
            computed_result=round(computed_pct, 4),
            reported_result=reported_pct,
            tolerance=tolerance,
            comparison_outcome=outcome,
            explanation=explanation,
        )

    def _verify_absolute_difference(
        self,
        claim_text: str,
        claim_entities: List[NumericEntity],
        evidence_entities: List[NumericEntity],
        custom_tolerance: Optional[float] = None,
    ) -> Optional[NumericalFinding]:
        """
        Verifies absolute difference: current - prior.
        """
        non_pct_claims = [e for e in claim_entities if not e.is_percentage]
        non_pct_evidence = [e for e in evidence_entities if not e.is_percentage]

        if not non_pct_claims or len(non_pct_evidence) < 2:
            return None

        reported_diff = non_pct_claims[0].normalized_value
        current_entity, prior_entity = self._pair_current_and_prior(
            non_pct_evidence, is_decline=bool(self.DECLINE_KEYWORDS.search(claim_text))
        )

        current_val = current_entity.normalized_value
        prior_val = prior_entity.normalized_value

        computed_diff = current_val - prior_val
        tolerance = custom_tolerance if custom_tolerance is not None else 1.0

        diff_gap = abs(abs(computed_diff) - abs(reported_diff))
        outcome = "VALIDATED" if diff_gap <= tolerance else "MISMATCH"

        return NumericalFinding(
            finding_type="ABSOLUTE_DIFFERENCE",
            formula="current - prior",
            operands={"current": current_val, "prior": prior_val},
            computed_result=round(computed_diff, 4),
            reported_result=reported_diff,
            tolerance=tolerance,
            comparison_outcome=outcome,
            explanation=(
                f"Computed difference: {current_val} - {prior_val} = {computed_diff}. "
                f"Reported difference: {reported_diff}. Outcome: {outcome}."
            ),
        )

    def _verify_margin_or_ratio(
        self,
        claim_text: str,
        claim_entities: List[NumericEntity],
        evidence_entities: List[NumericEntity],
        custom_tolerance: Optional[float] = None,
    ) -> Optional[NumericalFinding]:
        """
        Verifies margin or ratio calculation: (numerator / denominator) * 100.
        """
        claim_pct = next((e for e in claim_entities if e.is_percentage), None)
        non_pct_evidence = [e for e in evidence_entities if not e.is_percentage]

        if not claim_pct or len(non_pct_evidence) < 2:
            return None

        reported_margin = claim_pct.normalized_value
        # Conventionally, numerator is smaller than denominator (e.g., profit / revenue)
        vals = sorted([e.normalized_value for e in non_pct_evidence])
        numerator, denominator = vals[0], vals[-1]

        if denominator == 0.0:
            return NumericalFinding(
                finding_type="MARGIN_RATIO",
                formula="(numerator / denominator) * 100",
                operands={"numerator": numerator, "denominator": denominator},
                reported_result=reported_margin,
                comparison_outcome="DIVISION_BY_ZERO",
                explanation="Denominator is zero; ratio is mathematically undefined.",
            )

        computed_margin = (numerator / denominator) * 100.0
        tolerance = custom_tolerance if custom_tolerance is not None else self.default_percentage_tolerance
        diff = abs(computed_margin - reported_margin)
        outcome = "VALIDATED" if diff <= tolerance else "MISMATCH"

        return NumericalFinding(
            finding_type="MARGIN_RATIO",
            formula="(numerator / denominator) * 100",
            operands={"numerator": numerator, "denominator": denominator},
            computed_result=round(computed_margin, 4),
            reported_result=reported_margin,
            tolerance=tolerance,
            comparison_outcome=outcome,
            explanation=(
                f"Computed margin: ({numerator} / {denominator}) * 100 = {computed_margin:.4f}%. "
                f"Reported: {reported_margin}%. Outcome: {outcome}."
            ),
        )

    def _check_currency_and_unit_consistency(
        self,
        claim_entities: List[NumericEntity],
        evidence_entities: List[NumericEntity],
    ) -> Optional[NumericalFinding]:
        """
        Verifies that currencies and unit scales do not contradict each other.
        """
        if not claim_entities or not evidence_entities:
            return None

        # Check currency contradiction
        for c in claim_entities:
            if not c.currency:
                continue
            for e in evidence_entities:
                if e.currency and e.currency != c.currency:
                    return NumericalFinding(
                        finding_type="CURRENCY_UNIT_CONSISTENCY",
                        operands={"claim_currency": c.currency, "evidence_currency": e.currency},
                        comparison_outcome="INCONSISTENT_UNITS",
                        explanation=f"Currency mismatch detected: Claim uses '{c.currency}', but evidence states '{e.currency}'.",
                    )

        # Check unit scale contradiction (e.g. claim says $50 billion, evidence says $50 million)
        for c in claim_entities:
            if c.unit_multiplier == 1.0 or c.is_percentage:
                continue
            for e in evidence_entities:
                if e.unit_multiplier == 1.0 or e.is_percentage:
                    continue
                # If numbers before scale match but units differ
                if abs(c.value - e.value) < 1e-3 and c.unit_multiplier != e.unit_multiplier:
                    return NumericalFinding(
                        finding_type="CURRENCY_UNIT_CONSISTENCY",
                        operands={
                            "claim_value": f"{c.value} {c.unit_name}",
                            "evidence_value": f"{e.value} {e.unit_name}",
                        },
                        comparison_outcome="INCONSISTENT_UNITS",
                        explanation=(
                            f"Unit scale mismatch: Claim states {c.value} {c.unit_name} "
                            f"(multiplier {c.unit_multiplier:g}), while evidence states {e.value} {e.unit_name} "
                            f"(multiplier {e.unit_multiplier:g})."
                        ),
                    )

        return None

    def _verify_direct_values(
        self,
        claim_entities: List[NumericEntity],
        evidence_entities: List[NumericEntity],
        custom_tolerance: Optional[float] = None,
    ) -> NumericalFinding:
        """
        Directly compares single reported numbers against evidence numbers.
        """
        if not evidence_entities:
            return NumericalFinding(
                finding_type="DIRECT_MATCH",
                comparison_outcome="INSUFFICIENT_INPUTS",
                explanation="No numerical quantities found in evidence passage to compare.",
            )

        c = claim_entities[0]
        # Find best matching evidence entity
        best_match = None
        min_diff = float("inf")

        for e in evidence_entities:
            if c.is_percentage != e.is_percentage:
                continue
            diff = abs(c.normalized_value - e.normalized_value)
            if diff < min_diff:
                min_diff = diff
                best_match = e

        if best_match is None:
            return NumericalFinding(
                finding_type="DIRECT_MATCH",
                operands={"claim": c.normalized_value},
                reported_result=c.normalized_value,
                comparison_outcome="INSUFFICIENT_INPUTS",
                explanation=f"No comparable {'percentage' if c.is_percentage else 'numeric'} entity in evidence.",
            )

        tolerance = custom_tolerance if custom_tolerance is not None else (
            self.default_percentage_tolerance if c.is_percentage else 0.5
        )

        outcome = "VALIDATED" if min_diff <= tolerance else "MISMATCH"

        return NumericalFinding(
            finding_type="DIRECT_MATCH",
            operands={"claim": c.normalized_value, "evidence": best_match.normalized_value},
            computed_result=best_match.normalized_value,
            reported_result=c.normalized_value,
            tolerance=tolerance,
            comparison_outcome=outcome,
            explanation=(
                f"Direct value comparison: Claim reported {c.normalized_value}, "
                f"evidence states {best_match.normalized_value}. Difference: {min_diff:.4f} -> {outcome}."
            ),
        )

    def _pair_current_and_prior(
        self,
        entities: List[NumericEntity],
        is_decline: bool = False,
    ) -> Tuple[NumericEntity, NumericEntity]:
        """
        In financial disclosures, values are presented either as [current, prior]
        (e.g. 'Revenue was $350 million compared to $307.4 million in the prior year')
        or [prior, current] ('increased from $307.4 million to $350 million').
        """
        if len(entities) == 2:
            # If explicit decline, the smaller one is current
            # If growth, the larger one is current
            if not is_decline:
                # Default assume first is current unless order is 'from X to Y'
                return entities[0], entities[1]
            else:
                return entities[0], entities[1]

        # If more than 2, pick the two most prominent
        return entities[0], entities[1]

    # -------------------------------------------------------------------------
    # Temporal Anchoring
    # -------------------------------------------------------------------------

    def verify_temporal_alignment(
        self,
        claim_text: str,
        evidence_text: Optional[str] = None,
        doc_metadata: Optional[Dict[str, Any]] = None,
    ) -> TemporalAnchor:
        """
        Extracts and compares reporting periods from claim, evidence, and document metadata.
        Strict rule: Do not infer or guess a fiscal year when evidence is insufficient.
        """
        claim_periods = self.extract_temporal_periods(claim_text)
        evidence_periods = self.extract_temporal_periods(evidence_text or "")

        # Extract document period from metadata if present (e.g. filename like 'AAPL_FY2023.pdf')
        doc_period_str = None
        if doc_metadata and "filename" in doc_metadata:
            meta_periods = self.extract_temporal_periods(doc_metadata["filename"])
            if meta_periods:
                doc_period_str = meta_periods[0].raw_text

        # Case 1: Claim does not specify any temporal period
        if not claim_periods:
            return TemporalAnchor(
                claim_period=None,
                evidence_period=evidence_periods[0].raw_text if evidence_periods else None,
                document_period=doc_period_str,
                period_match="UNSPECIFIED",
                explanation="Claim contains no explicit temporal anchor or reporting period.",
            )

        c_period = claim_periods[0]

        # Case 2: Evidence has no period and document has no period
        if not evidence_periods:
            if doc_period_str:
                # Check document metadata
                doc_match = self._compare_single_period(c_period, self.extract_temporal_periods(doc_period_str)[0])
                return TemporalAnchor(
                    claim_period=c_period.raw_text,
                    evidence_period=None,
                    document_period=doc_period_str,
                    period_match=doc_match,
                    explanation=f"Evidence text lacks explicit period; grounded via document metadata ({doc_period_str}): {doc_match}.",
                )

            return TemporalAnchor(
                claim_period=c_period.raw_text,
                evidence_period=None,
                document_period=None,
                period_match="AMBIGUOUS",
                explanation=f"Claim specifies '{c_period.raw_text}', but evidence contains no temporal anchor to verify it against.",
            )

        e_period = evidence_periods[0]

        # Case 3: Evidence is generic/ambiguous (e.g. 'the fiscal year' without stating the year)
        if e_period.is_ambiguous or e_period.period_type == "GENERIC":
            # If doc metadata provides explicit year, we can ground it; otherwise it's ambiguous
            if doc_period_str:
                doc_p = self.extract_temporal_periods(doc_period_str)[0]
                doc_match = self._compare_single_period(c_period, doc_p)
                return TemporalAnchor(
                    claim_period=c_period.raw_text,
                    evidence_period=e_period.raw_text,
                    document_period=doc_period_str,
                    period_match=doc_match,
                    explanation=(
                        f"Evidence refers generically to '{e_period.raw_text}'; "
                        f"anchored through document metadata '{doc_period_str}' -> {doc_match}."
                    ),
                )
            else:
                return TemporalAnchor(
                    claim_period=c_period.raw_text,
                    evidence_period=e_period.raw_text,
                    document_period=None,
                    period_match="AMBIGUOUS",
                    explanation=(
                        f"Evidence refers ambiguously to '{e_period.raw_text}' without stating the year; "
                        f"insufficient textual evidence to confirm alignment with claim's '{c_period.raw_text}'."
                    ),
                )

        # Case 4: Explicit comparison between claim and evidence periods
        match_result = self._compare_single_period(c_period, e_period)
        explanation = (
            f"Claim period '{c_period.raw_text}' matches evidence period '{e_period.raw_text}'."
            if match_result == "ALIGNED"
            else f"Claim specifies '{c_period.raw_text}' but retrieved evidence refers to '{e_period.raw_text}'."
        )

        return TemporalAnchor(
            claim_period=c_period.raw_text,
            evidence_period=e_period.raw_text,
            document_period=doc_period_str,
            period_match=match_result,
            explanation=explanation,
        )

    def _compare_single_period(self, p1: TemporalPeriod, p2: TemporalPeriod) -> str:
        """Compares two non-ambiguous periods."""
        if p1.year and p2.year:
            if p1.year != p2.year:
                return "MISALIGNED"
            if p1.quarter and p2.quarter and p1.quarter != p2.quarter:
                return "MISALIGNED"
            return "ALIGNED"

        # If one has no year (ambiguous)
        if p1.is_ambiguous or p2.is_ambiguous:
            return "AMBIGUOUS"

        return "ALIGNED" if p1.raw_text.lower() == p2.raw_text.lower() else "MISALIGNED"

    def verify_claim_with_tables(
        self,
        claim_text: str,
        tables: List[Any],
        custom_tolerance: Optional[float] = None,
    ) -> Optional[NumericalFinding]:
        """
        Deterministically verifies numerical claims against structured financial tables.
        Matches line items and reporting periods directly against table cells.
        """
        if not tables:
            return None

        claim_entities = self.extract_numeric_entities(claim_text)
        if not claim_entities:
            return None

        claim_periods = self.extract_temporal_periods(claim_text)
        primary_period = str(claim_periods[0].year) if (claim_periods and claim_periods[0].year) else None

        # Search across all extracted tables
        for table in tables:
            for row in table.rows:
                if not row or len(row) < 2:
                    continue
                line_item_label = row[0].raw_text.strip()
                if len(line_item_label) < 3:
                    continue

                # If claim text mentions the table's line item
                if line_item_label.lower() in claim_text.lower():
                    target_cell = None
                    if primary_period:
                        for col_idx, rep_p in enumerate(table.reporting_periods):
                            if rep_p and primary_period in rep_p:
                                if col_idx < len(row):
                                    target_cell = row[col_idx]
                                    break

                    if not target_cell:
                        target_cell = next((c for c in row[1:] if c.is_numeric), None)

                    if target_cell and target_cell.normalized_value is not None:
                        claim_num = claim_entities[0].normalized_value
                        diff = abs(claim_num - target_cell.normalized_value)
                        tolerance = custom_tolerance if custom_tolerance is not None else 0.5
                        outcome = "VALIDATED" if diff <= tolerance else "MISMATCH"

                        is_ocr = getattr(target_cell, "is_ocr", False) or getattr(table, "is_ocr", False)
                        ocr_conf = getattr(target_cell, "ocr_confidence", None)
                        needs_review = getattr(target_cell, "needs_review", False) or (
                            is_ocr and ocr_conf is not None and ocr_conf < 60.0
                        )

                        explanation_text = (
                            f"Structured table match (Page {table.page_number}): Line item '{line_item_label}' "
                            f"states verbatim '{target_cell.raw_text}' (normalized: {target_cell.normalized_value}). "
                            f"Claim reported {claim_num} -> {outcome}."
                        )
                        if is_ocr:
                            explanation_text += f" [Extracted via OCR, confidence: {ocr_conf or 'N/A'}%]"
                        if needs_review:
                            explanation_text += " [ATTENTION: Low OCR confidence. Routed for human review.]"

                        return NumericalFinding(
                            finding_type="TABLE_LOOKUP",
                            formula="structured_table_cell_match",
                            operands={
                                "line_item": line_item_label,
                                "table_period": primary_period or "default",
                                "table_cell_raw": target_cell.raw_text,
                                "table_value": target_cell.normalized_value,
                                "page_number": table.page_number,
                                "is_ocr": is_ocr,
                                "ocr_confidence": ocr_conf,
                                "needs_review": needs_review,
                                "requires_human_review": needs_review,
                            },
                            computed_result=target_cell.normalized_value,
                            reported_result=claim_num,
                            tolerance=tolerance,
                            comparison_outcome=outcome,
                            explanation=explanation_text,
                        )

        return None

