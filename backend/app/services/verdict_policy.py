"""
Final verdict policy for a verified claim.

Combines the NLI verdict with deterministic evidence checks (figure grounding, entity
novelty, structured-table arithmetic, temporal alignment, multi-hop calculation). The
rules run in a fixed priority order so every verdict can be traced to one named reason.

Confidence values on rule-derived verdicts are *evidence-alignment scores*, not
calibrated probabilities.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, List, Optional

from app.services.nli_service import (
    VERDICT_CONTRADICTED,
    VERDICT_SUPPORTED,
    VERDICT_UNVERIFIED,
    ClaimNLIResult,
)
from app.services.numeric_grounding import CONFLICT, GROUNDED, GroundingResult

# Claims whose figures are all in the evidence and whose closest evidence sentence shares at
# least this share of the claim's content words are accepted even if NLI stays neutral.
GROUNDED_SUPPORT_MIN_OVERLAP = 0.6
# Several specific figures found together make a coincidental match unlikely, so less wording overlap is needed.
MULTI_FIGURE_SUPPORT_MIN_OVERLAP = 0.35


@dataclass
class Verdict:
    status: str
    risk_level: str
    hallucination_type: str
    risk_score: float
    confidence: float
    reasoning: str
    decided_by: str


def synthesize_verdict(
    nli: ClaimNLIResult,
    grounding: GroundingResult,
    novel_entities: List[str],
    table_finding: Optional[Any] = None,
    temporal: Optional[Any] = None,
    multi_hop: Optional[Dict[str, Any]] = None,
) -> Verdict:
    # 1. Names that appear nowhere in the document cannot be verified.
    if novel_entities and grounding.status != GROUNDED:
        names = ", ".join(novel_entities[:4])
        return Verdict(
            VERDICT_UNVERIFIED, "MEDIUM", "UNSUPPORTED_FABRICATION", 0.50, 1.0,
            f"The claim mentions {names}, which do not appear anywhere in the document, "
            "so it cannot be verified.",
            "entity_novelty",
        )

    # 2. The evidence states a different figure for the same fact.
    if grounding.status == CONFLICT:
        return Verdict(
            VERDICT_CONTRADICTED, "HIGH", "NUMERICAL_DISCREPANCY", 0.88,
            max(grounding.anchor_overlap, 0.5),
            f"Numerical discrepancy: {grounding.explanation}",
            "figure_conflict",
        )

    # 3. Arithmetic on structured tables, or on evidence figures for derived values (growth, margin).
    if table_finding is not None and table_finding.comparison_outcome in ("MISMATCH", "INCONSISTENT_UNITS"):
        return Verdict(
            VERDICT_CONTRADICTED, "HIGH", "NUMERICAL_DISCREPANCY", 0.88, 0.9,
            f"Numerical discrepancy: Reported {table_finding.reported_result} vs computed "
            f"{table_finding.computed_result} ({table_finding.explanation})",
            "table_mismatch",
        )

    # 4. Reporting period differs from the evidence.
    if temporal is not None and temporal.period_match == "MISALIGNED":
        return Verdict(
            VERDICT_CONTRADICTED, "HIGH", "TEMPORAL_MISALIGNMENT", 0.80, 0.8,
            f"Temporal misalignment: claim references {temporal.claim_period} but evidence context is "
            f"{temporal.evidence_period or temporal.document_period}.",
            "temporal",
        )

    # 5. Multi-hop calculation conflict (e.g. net debt).
    if multi_hop and multi_hop.get("has_conflict"):
        return Verdict(
            VERDICT_CONTRADICTED, "HIGH", "MULTI_HOP_CALCULATION_CONFLICT", 0.85, 0.85,
            multi_hop.get("explanation", ""), "multi_hop",
        )

    # 6. Pure NLI outcomes.
    if nli.verdict == VERDICT_CONTRADICTED:
        return Verdict(
            VERDICT_CONTRADICTED, "HIGH", "FACTUAL_CONTRADICTION",
            max(0.75, nli.confidence), nli.confidence, nli.explanation, "nli",
        )

    if nli.verdict == VERDICT_UNVERIFIED:
        needed = MULTI_FIGURE_SUPPORT_MIN_OVERLAP if len(grounding.matched) >= 2 else GROUNDED_SUPPORT_MIN_OVERLAP
        if grounding.status == GROUNDED and grounding.anchor_overlap >= needed:
            return Verdict(
                VERDICT_SUPPORTED, "LOW", "NONE", round(max(0.05, 1.0 - grounding.anchor_overlap), 4),
                grounding.anchor_overlap,
                f"Supported by grounding: {grounding.explanation} The closest evidence sentence "
                f"shares {grounding.anchor_overlap:.0%} of the claim's content.",
                "grounded_support",
            )
        return Verdict(
            VERDICT_UNVERIFIED, "MEDIUM", "UNSUPPORTED_FABRICATION", 0.50, nli.confidence,
            nli.explanation, "nli",
        )

    # 7. Supported by NLI.
    note = nli.explanation
    if grounding.status == GROUNDED and grounding.matched:
        note += f" Figures verified in the evidence: {', '.join(grounding.matched)}."
    if temporal is not None and temporal.period_match == "ALIGNED":
        note += f" Period aligned with {temporal.claim_period}."
    return Verdict(
        VERDICT_SUPPORTED, "LOW", "NONE", round(max(0.05, 1.0 - nli.confidence), 4),
        nli.confidence, note, "nli",
    )
