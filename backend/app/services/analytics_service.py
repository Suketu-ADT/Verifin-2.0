"""
Aggregate statistics over an organisation's finished verifications.

Pure functions: the endpoint loads the sessions and claims, this module turns them into the numbers behind the Analytics page.
A claim that is CONTRADICTED is counted as a hallucination, UNVERIFIED as unsupported (no evidence found), and SUPPORTED as
grounded. Rates are shares of all claims in the window, and every share is None-safe (an empty window gives zeros, not errors).
"""

from __future__ import annotations

from collections import Counter, defaultdict
from datetime import datetime, time, timedelta, timezone
from typing import Any, Dict, Iterable, List, Optional

from app.models.claim import ClaimModel
from app.models.verification import VerificationSessionModel

SUPPORTED, CONTRADICTED, UNVERIFIED = "SUPPORTED", "CONTRADICTED", "UNVERIFIED"
TOP_DOCUMENTS = 8
TOP_CLAIMS = 10
SCORE_BIN_WIDTH = 20


def _utc(value: datetime) -> datetime:
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


def _share(part: int, whole: int) -> float:
    return round(part / whole, 4) if whole else 0.0


def _verdict(claim: ClaimModel) -> str:
    return (claim.status or "").upper()


def _tally(claims: Iterable[ClaimModel]) -> Dict[str, int]:
    verdicts = Counter(_verdict(c) for c in claims)
    return {"claims": sum(verdicts.values()), "supported": verdicts[SUPPORTED], "contradicted": verdicts[CONTRADICTED],
            "unverified": verdicts[UNVERIFIED]}


def _totals(sessions: List[VerificationSessionModel], claims: List[ClaimModel]) -> Dict[str, Any]:
    tally = _tally(claims)
    scores = [s.overall_score for s in sessions]
    return {
        "verifications": len(sessions),
        **tally,
        "hallucination_rate": _share(tally["contradicted"], tally["claims"]),
        "unverified_rate": _share(tally["unverified"], tally["claims"]),
        "support_rate": _share(tally["supported"], tally["claims"]),
        "average_score": round(sum(scores) / len(scores), 1) if scores else 0.0,
    }


def _label(value: Optional[str]) -> str:
    return (value or "none").strip() or "none"


def build_overview(
    sessions: List[VerificationSessionModel],
    claims: List[ClaimModel],
    document_names: Dict[str, Optional[str]],
    days: int,
    now: Optional[datetime] = None,
) -> Dict[str, Any]:
    """``sessions`` and ``claims`` cover this window and the one before it (for the comparison); ``days`` is the window length."""
    now = _utc(now or datetime.now(timezone.utc))
    # `days` whole calendar days ending today (UTC), so the daily trend adds up to the totals
    start = datetime.combine(now.date() - timedelta(days=days - 1), time.min, tzinfo=timezone.utc)
    previous_start = start - timedelta(days=days)

    current_sessions = [s for s in sessions if _utc(s.created_at) >= start]
    previous_sessions = [s for s in sessions if previous_start <= _utc(s.created_at) < start]
    by_session: Dict[str, List[ClaimModel]] = defaultdict(list)
    for claim in claims:
        by_session[claim.session_id].append(claim)
    current_claims = [c for s in current_sessions for c in by_session.get(s.id, [])]
    previous_claims = [c for s in previous_sessions for c in by_session.get(s.id, [])]

    # ── trend: one point per day, empty days kept so the line does not skip them
    session_day = {s.id: _utc(s.created_at).date() for s in current_sessions}
    per_day: Dict[Any, Dict[str, int]] = defaultdict(lambda: {"verifications": 0, "claims": 0, "supported": 0, "contradicted": 0, "unverified": 0})
    for s in current_sessions:
        per_day[session_day[s.id]]["verifications"] += 1
    for c in current_claims:
        day = per_day[session_day[c.session_id]]
        day["claims"] += 1
        verdict = _verdict(c)
        if verdict in (SUPPORTED, CONTRADICTED, UNVERIFIED):
            day[verdict.lower()] += 1
    trend = []
    first_day = start.date()
    for offset in range(days):
        day = first_day + timedelta(days=offset)
        row = per_day.get(day) or {"verifications": 0, "claims": 0, "supported": 0, "contradicted": 0, "unverified": 0}
        trend.append({"date": day.isoformat(), **row, "hallucination_rate": _share(row["contradicted"], row["claims"])})

    # ── documents with the highest share of contradicted claims
    session_document = {s.id: s.document_id for s in current_sessions}
    per_document: Dict[str, List[ClaimModel]] = defaultdict(list)
    document_runs: Counter = Counter(s.document_id for s in current_sessions)
    for c in current_claims:
        per_document[session_document[c.session_id]].append(c)
    documents = []
    for doc_id, doc_claims in per_document.items():
        tally = _tally(doc_claims)
        documents.append({
            "document_id": doc_id, "document_name": document_names.get(doc_id) or "Unnamed document",
            "verifications": document_runs[doc_id], **tally,
            "hallucination_rate": _share(tally["contradicted"], tally["claims"]),
            "unverified_rate": _share(tally["unverified"], tally["claims"]),
        })
    documents.sort(key=lambda d: (-d["hallucination_rate"], -d["unverified_rate"], -d["claims"], d["document_name"]))

    # ── claim types, hallucination types, deciding rules
    by_type: Dict[str, List[ClaimModel]] = defaultdict(list)
    for c in current_claims:
        by_type[_label(c.claim_type)].append(c)
    claim_types = []
    for name, group in by_type.items():
        tally = _tally(group)
        claim_types.append({"claim_type": name, **tally, "hallucination_rate": _share(tally["contradicted"], tally["claims"]),
                            "unverified_rate": _share(tally["unverified"], tally["claims"])})
    claim_types.sort(key=lambda t: (-t["claims"], t["claim_type"]))

    flagged = [c for c in current_claims if _verdict(c) != SUPPORTED]
    hallucination_types = Counter(_label(c.hallucination_type) for c in flagged if _label(c.hallucination_type).upper() != "NONE")
    rules = Counter(_label(c.decided_by) for c in current_claims)

    # ── verifications by overall risk and by how many of their claims were supported
    risk = Counter((s.risk_level or "UNKNOWN").upper() for s in current_sessions)
    bins = [0] * (100 // SCORE_BIN_WIDTH)
    for s in current_sessions:
        bins[min(int(s.overall_score // SCORE_BIN_WIDTH), len(bins) - 1)] += 1
    score_bins = [{"lower": i * SCORE_BIN_WIDTH, "upper": (i + 1) * SCORE_BIN_WIDTH, "verifications": n} for i, n in enumerate(bins)]

    # ── the claims most worth a reviewer's time
    def risk_score(c: ClaimModel) -> float:
        return float(c.hallucination_risk_score or 0.0)

    session_lookup = {s.id: s for s in current_sessions}
    top_claims = [
        {
            "session_id": c.session_id, "claim_id": c.id,
            "claim_text": c.claim_text if len(c.claim_text) <= 180 else c.claim_text[:177] + "...",
            "verdict": _verdict(c), "claim_type": _label(c.claim_type), "hallucination_type": _label(c.hallucination_type),
            "risk_score": round(risk_score(c), 3),
            "document_name": document_names.get(session_lookup[c.session_id].document_id) or "Unnamed document",
        }
        for c in sorted(flagged, key=lambda c: (_verdict(c) != CONTRADICTED, -risk_score(c), c.id))[:TOP_CLAIMS]
    ]

    return {
        "days": days,
        "since": start.isoformat(),
        "totals": _totals(current_sessions, current_claims),
        "previous": _totals(previous_sessions, previous_claims),
        "trend": trend,
        "documents": documents[:TOP_DOCUMENTS],
        "claim_types": claim_types,
        "hallucination_types": [{"name": k, "claims": v} for k, v in hallucination_types.most_common()],
        "rules": [{"name": k, "claims": v} for k, v in rules.most_common(8)],
        "risk_levels": [{"name": k, "verifications": v} for k, v in sorted(risk.items())],
        "score_bins": score_bins,
        "top_claims": top_claims,
    }
