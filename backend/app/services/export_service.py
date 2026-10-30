"""
Verification report export: CSV for analysis, PDF for sign-off and filing.

CSV cells that begin with a spreadsheet formula character are prefixed with an apostrophe, so text taken from a
document or an LLM answer cannot execute when the file is opened in Excel or Sheets (CSV injection).
"""

from __future__ import annotations

import csv
import io
from datetime import datetime, timezone
from typing import Any, Iterable, List, Optional

from fpdf import FPDF

from app.schemas.verification import ClaimResponse, VerificationResultResponse

_FORMULA_PREFIXES = ("=", "+", "-", "@", "\t", "\r")
CSV_COLUMNS = [
    "claim_id", "claim", "claim_type", "verdict", "risk_level", "decided_by", "confidence",
    "hallucination_type", "reasoning", "evidence_page", "evidence", "reported_value", "computed_value",
    "period_match",
]


def safe_cell(value: Any) -> Any:
    if isinstance(value, str) and value.startswith(_FORMULA_PREFIXES):
        return "'" + value
    return value


def _claim_row(c: ClaimResponse) -> List[Any]:
    num, temp, ev = c.numerical_finding, c.temporal_anchor, c.evidence
    return [
        c.id, c.claim_text, c.claim_type, c.status, c.risk_level, c.decided_by,
        None if c.confidence is None else round(c.confidence, 3), c.hallucination_type, c.reasoning_summary,
        ev.page_number if ev else None, ev.text if ev else None,
        num.reported_result if num else None, num.computed_result if num else None,
        temp.period_match if temp else None,
    ]


def build_csv(result: VerificationResultResponse) -> str:
    out = io.StringIO(newline="")
    writer = csv.writer(out, lineterminator="\r\n")
    writer.writerow(CSV_COLUMNS)
    for claim in result.claims:
        writer.writerow([safe_cell(v) for v in _claim_row(claim)])
    return out.getvalue()


# ── PDF ──────────────────────────────────────────────────────────────────────

_STATUS_COLOURS = {"SUPPORTED": (22, 128, 60), "CONTRADICTED": (190, 30, 45), "UNVERIFIED": (180, 110, 0)}
_REPLACEMENTS = {"₹": "Rs.", "€": "EUR", "£": "GBP", "–": "-", "—": "-", "‘": "'", "’": "'", "“": '"', "”": '"',
                 "…": "...", "•": "-", " ": " ", "→": "->", "≈": "~", "×": "x"}


def pdf_text(value: Any) -> str:
    """The built-in PDF fonts are Latin-1 only: map common symbols, and replace anything else."""
    text = "" if value is None else str(value)
    for src, dst in _REPLACEMENTS.items():
        text = text.replace(src, dst)
    return text.encode("latin-1", "replace").decode("latin-1")


class _Report(FPDF):
    def __init__(self, footer_note: str):
        super().__init__(format="A4")
        self.footer_note = footer_note
        self.set_auto_page_break(auto=True, margin=16)

    def footer(self) -> None:
        self.set_y(-12)
        self.set_font("Helvetica", "", 7)
        self.set_text_color(110, 110, 110)
        self.cell(0, 5, pdf_text(self.footer_note), align="L")
        self.cell(0, 5, f"Page {self.page_no()}", align="R")


def build_pdf(
    result: VerificationResultResponse,
    *,
    document_name: Optional[str] = None,
    generated_by: Optional[str] = None,
) -> bytes:
    prov = result.provenance or {}
    generated = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    pdf = _Report(f"VERIFIN verification report {result.id} - generated {generated}")
    pdf.set_margins(16, 16, 16)
    pdf.add_page()
    width = pdf.w - pdf.l_margin - pdf.r_margin

    pdf.set_font("Helvetica", "B", 18)
    pdf.set_text_color(20, 30, 60)
    pdf.cell(0, 10, "VERIFIN verification report", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "", 9)
    pdf.set_text_color(80, 80, 80)
    for label, value in (
        ("Report ID", result.id),
        ("Document", f"{document_name or result.document_id}"),
        ("Generated", f"{generated}" + (f" by {generated_by}" if generated_by else "")),
    ):
        pdf.cell(28, 5, label)
        pdf.cell(0, 5, pdf_text(value), new_x="LMARGIN", new_y="NEXT")
    pdf.ln(3)

    counts = {"SUPPORTED": 0, "CONTRADICTED": 0, "UNVERIFIED": 0}
    for c in result.claims:
        counts[c.status] = counts.get(c.status, 0) + 1
    pdf.set_fill_color(240, 243, 248)
    pdf.set_font("Helvetica", "B", 11)
    pdf.set_text_color(20, 30, 60)
    pdf.cell(width, 8, pdf_text(
        f"  Score {result.overall_score:.1f}%    Risk {result.risk_level}    Claims {len(result.claims)}"
        f"    Supported {counts['SUPPORTED']}  Contradicted {counts['CONTRADICTED']}  Unverified {counts['UNVERIFIED']}"
    ), fill=True, new_x="LMARGIN", new_y="NEXT")
    pdf.ln(4)

    for i, claim in enumerate(result.claims, 1):
        _claim_block(pdf, i, claim, width)

    if prov:
        _provenance_block(pdf, prov, width)

    pdf.set_font("Helvetica", "I", 7.5)
    pdf.set_text_color(110, 110, 110)
    pdf.multi_cell(
        width, 3.8,
        pdf_text(
            "Verdicts are produced by an automated pipeline and are decision support, not an audit opinion. "
            "Confidence values on rule-based verdicts measure alignment with the evidence; they are not calibrated probabilities."
        ),
        new_x="LMARGIN", new_y="NEXT",
    )
    return bytes(pdf.output())


def _claim_block(pdf: FPDF, index: int, c: ClaimResponse, width: float) -> None:
    if pdf.get_y() > pdf.h - 55:
        pdf.add_page()
    colour = _STATUS_COLOURS.get(c.status, (60, 60, 60))
    pdf.set_font("Helvetica", "B", 9)
    pdf.set_text_color(*colour)
    pdf.cell(34, 5, pdf_text(f"{index}. {c.status}"))
    pdf.set_text_color(90, 90, 90)
    pdf.set_font("Helvetica", "", 8)
    meta = " | ".join(p for p in (
        f"risk {c.risk_level}" if c.risk_level else "", f"rule {c.decided_by}" if c.decided_by else "",
        f"type {c.hallucination_type}" if c.hallucination_type and c.hallucination_type != "NONE" else "",
    ) if p)
    pdf.cell(0, 5, pdf_text(meta), new_x="LMARGIN", new_y="NEXT")

    pdf.set_text_color(20, 20, 20)
    pdf.set_font("Helvetica", "", 9.5)
    pdf.multi_cell(width, 4.8, pdf_text(c.claim_text), new_x="LMARGIN", new_y="NEXT")

    if c.reasoning_summary:
        pdf.set_font("Helvetica", "", 8.5)
        pdf.set_text_color(60, 60, 60)
        pdf.multi_cell(width, 4.2, pdf_text("Why: " + c.reasoning_summary), new_x="LMARGIN", new_y="NEXT")
    if c.evidence and c.evidence.text:
        excerpt = c.evidence.text if len(c.evidence.text) <= 420 else c.evidence.text[:417] + "..."
        pdf.set_font("Helvetica", "I", 8)
        pdf.set_text_color(90, 90, 90)
        pdf.multi_cell(width, 4.0, pdf_text(f'Evidence (page {c.evidence.page_number}): "{excerpt}"'),
                       new_x="LMARGIN", new_y="NEXT")
    pdf.ln(2.5)
    pdf.set_draw_color(220, 220, 220)
    pdf.line(pdf.l_margin, pdf.get_y(), pdf.l_margin + width, pdf.get_y())
    pdf.ln(2.5)


def _provenance_block(pdf: FPDF, prov: dict, width: float) -> None:
    if pdf.get_y() > pdf.h - 60:
        pdf.add_page()
    pdf.set_font("Helvetica", "B", 10)
    pdf.set_text_color(20, 30, 60)
    pdf.cell(0, 7, "Provenance", new_x="LMARGIN", new_y="NEXT")
    models, inp, timing = prov.get("models", {}), prov.get("input", {}), prov.get("timing", {})
    rows: Iterable = (
        ("Pipeline", prov.get("pipeline_version")),
        ("NLI model", models.get("nli")),
        ("Embedding model", models.get("embedding")),
        ("Document SHA-256", inp.get("document_sha256")),
        ("Statement SHA-256", inp.get("statement_sha256")),
        ("Duration", f"{timing.get('duration_s')} s" if timing.get("duration_s") is not None else None),
    )
    pdf.set_font("Courier", "", 7.5)
    pdf.set_text_color(70, 70, 70)
    for label, value in rows:
        if value:
            pdf.cell(36, 4.4, pdf_text(label))
            pdf.multi_cell(width - 36, 4.4, pdf_text(value), new_x="LMARGIN", new_y="NEXT")
    pdf.ln(3)
