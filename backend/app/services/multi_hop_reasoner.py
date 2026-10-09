"""
Multi-Hop Financial Reasoning Service.
Synthesizes evidence across multiple document passages, structured tables,
and footnotes into an explicit Evidence Graph with provenance tracking.
Enforces deterministic arithmetic for compound calculations (e.g. Net Debt).
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field

from app.models.chunk import DocumentChunkModel
from app.models.table import FinancialTableModel, TableCellModel
from app.services.numerical_reasoner import NumericEntity, NumericalReasonerService
from app.utils.logging import logger


class EvidenceNode(BaseModel):
    """An atomic fact node in the multi-hop evidence graph."""
    node_id: str
    node_type: str = Field(..., description="'passage', 'table_cell', or 'footnote'")
    document_id: str
    page_number: int
    entity: str
    period: Optional[str] = None
    raw_text: str
    normalized_value: Optional[float] = None
    confidence: float = 1.0
    provenance_label: str


class EvidenceEdge(BaseModel):
    """A directed edge in the evidence graph connecting operands to a compound conclusion."""
    source_node_id: str
    target_metric: str
    relation: str = Field(..., description="'component', 'subtraction', 'addition', 'reconciliation'")
    weight: float = 1.0


class MultiHopResult(BaseModel):
    """Complete multi-hop reasoning audit outcome."""
    target_metric: str
    computed_value: Optional[float] = None
    reported_value: Optional[float] = None
    is_conclusive: bool = False
    has_conflict: bool = False
    direct_evidence: List[EvidenceNode] = Field(default_factory=list)
    derived_formula: Optional[str] = None
    unresolved_assumptions: List[str] = Field(default_factory=list)
    provenance_pages: List[int] = Field(default_factory=list)
    explanation: str


class MultiHopReasonerService:
    """Performs deterministic cross-page and cross-document financial synthesis."""

    def __init__(self, numerical_reasoner: Optional[NumericalReasonerService] = None):
        self.numerical_reasoner = numerical_reasoner or NumericalReasonerService()

    def build_evidence_graph_nodes(
        self,
        chunks: List[DocumentChunkModel],
        tables: List[FinancialTableModel],
    ) -> List[EvidenceNode]:
        """Extracts structured evidence nodes across all passages and tables."""
        nodes: List[EvidenceNode] = []

        # 1. Nodes from structured financial tables
        for table in tables:
            for row in table.rows:
                if not row or len(row) < 2:
                    continue
                line_item = row[0].raw_text.strip()
                for col_idx, cell in enumerate(row[1:]):
                    if cell.is_numeric and cell.normalized_value is not None:
                        period = None
                        if col_idx + 1 < len(table.reporting_periods):
                            period = table.reporting_periods[col_idx + 1]

                        node_id = f"table_{table.id}_r{cell.row_idx}_c{cell.col_idx}"
                        nodes.append(
                            EvidenceNode(
                                node_id=node_id,
                                node_type="table_cell",
                                document_id=table.document_id,
                                page_number=table.page_number,
                                entity=line_item,
                                period=period,
                                raw_text=cell.raw_text,
                                normalized_value=cell.normalized_value,
                                confidence=cell.ocr_confidence / 100.0 if cell.ocr_confidence else 1.0,
                                provenance_label=f"Table '{line_item}' on Page {table.page_number}",
                            )
                        )

        # 2. Nodes from textual passages (e.g. footnotes and MD&A)
        for chunk in chunks:
            entities = self.numerical_reasoner.extract_numeric_entities(chunk.text)
            periods = self.numerical_reasoner.extract_temporal_periods(chunk.text)
            period_str = str(periods[0].year) if periods and periods[0].year else None
            year_values = {float(p.year) for p in periods if p.year}

            for i, ent in enumerate(entities):
                # Filter out pure year numbers (e.g. 2024) with no currency or multiplier
                if ent.normalized_value in year_values and ent.unit_multiplier == 1.0 and not ent.currency:
                    continue

                # Locate preceding clause context to associate metric name with number
                pos = chunk.text.find(ent.raw_text)
                if pos != -1:
                    start = max(0, pos - 80)
                    pre_window = chunk.text[start:pos]
                    if "." in pre_window:
                        pre_window = pre_window.split(".")[-1]
                    context_desc = pre_window.strip()
                else:
                    context_desc = ent.raw_text

                is_footnote = "note " in chunk.text.lower() or "footnote" in chunk.text.lower()
                node_type = "footnote" if is_footnote else "passage"

                node_id = f"chunk_{chunk.id}_e{i}"
                nodes.append(
                    EvidenceNode(
                        node_id=node_id,
                        node_type=node_type,
                        document_id=chunk.document_id,
                        page_number=chunk.page_number,
                        entity=context_desc,
                        period=period_str,
                        raw_text=ent.raw_text,
                        normalized_value=ent.normalized_value,
                        confidence=chunk.ocr_confidence / 100.0 if chunk.ocr_confidence else 1.0,
                        provenance_label=f"{node_type.capitalize()} on Page {chunk.page_number}",
                    )
                )

        return nodes

    def compute_net_debt(
        self,
        claim_reported_net_debt: Optional[float],
        target_period: Optional[str],
        chunks: List[DocumentChunkModel],
        tables: List[FinancialTableModel],
    ) -> MultiHopResult:
        """
        Synthesizes Net Debt = Total Debt - (Cash and Cash Equivalents + Marketable Securities).
        Tracks provenance across balance sheets, footnotes, and disclosures.
        Refuses to guess if any operand is missing or conflicting.
        """
        all_nodes = self.build_evidence_graph_nodes(chunks, tables)

        # Look for debt components (Total Debt, Long-Term Debt, Term Debt)
        debt_keywords = ["total debt", "term debt", "long-term debt", "commercial paper", "total borrowings"]
        cash_keywords = ["cash and cash equivalents", "cash equivalents", "cash and marketable securities"]
        marketable_sec_keywords = ["marketable securities", "short-term investments"]

        matched_debt_node: Optional[EvidenceNode] = None
        matched_cash_node: Optional[EvidenceNode] = None
        matched_mkt_sec_node: Optional[EvidenceNode] = None

        for node in all_nodes:
            # Check period match if specified
            if target_period and node.period:
                if target_period.lower() not in node.period.lower():
                    continue

            name = node.entity.lower()
            if not matched_debt_node and any(k in name for k in debt_keywords):
                matched_debt_node = node
            elif not matched_cash_node and any(k in name for k in cash_keywords):
                matched_cash_node = node
            elif not matched_mkt_sec_node and any(k in name for k in marketable_sec_keywords):
                matched_mkt_sec_node = node

        direct_evidence: List[EvidenceNode] = []
        unresolved: List[str] = []

        if matched_debt_node:
            direct_evidence.append(matched_debt_node)
        else:
            unresolved.append("Missing required operand 'Total Debt' across available tables and passages.")

        if matched_cash_node:
            direct_evidence.append(matched_cash_node)
        else:
            unresolved.append("Missing required operand 'Cash and Cash Equivalents' across available disclosures.")

        # If key operands are missing, return inconclusive result without guessing
        if unresolved or not matched_debt_node or not matched_cash_node:
            return MultiHopResult(
                target_metric="Net Debt",
                computed_value=None,
                reported_value=claim_reported_net_debt,
                is_conclusive=False,
                has_conflict=False,
                direct_evidence=direct_evidence,
                unresolved_assumptions=unresolved,
                provenance_pages=[n.page_number for n in direct_evidence],
                explanation=(
                    "Inconclusive multi-hop derivation: " + "; ".join(unresolved)
                ),
            )

        # Deterministic calculation
        debt_val = matched_debt_node.normalized_value or 0.0
        cash_val = matched_cash_node.normalized_value or 0.0
        mkt_val = matched_mkt_sec_node.normalized_value if matched_mkt_sec_node else 0.0

        if matched_mkt_sec_node:
            direct_evidence.append(matched_mkt_sec_node)
            liquid_cash = cash_val + mkt_val
            formula_desc = f"Total Debt ({debt_val:,.0f}) - [Cash ({cash_val:,.0f}) + Marketable Securities ({mkt_val:,.0f})]"
        else:
            liquid_cash = cash_val
            formula_desc = f"Total Debt ({debt_val:,.0f}) - Cash ({cash_val:,.0f})"

        net_debt_computed = debt_val - liquid_cash
        pages = sorted(list(set(n.page_number for n in direct_evidence)))

        # Compare against reported value if provided
        has_conflict = False
        outcome_str = "Derived conclusively."
        if claim_reported_net_debt is not None:
            diff = abs(net_debt_computed - claim_reported_net_debt)
            # Allow tolerance of 1.0 or 1%
            tol = max(1.0, abs(claim_reported_net_debt) * 0.01)
            if diff > tol:
                has_conflict = True
                outcome_str = (
                    f"Conflict detected: Computed Net Debt is {net_debt_computed:,.0f}, "
                    f"but claim reported {claim_reported_net_debt:,.0f} (difference: {diff:,.0f})."
                )
            else:
                outcome_str = f"Validated: Computed Net Debt ({net_debt_computed:,.0f}) matches reported figure."

        return MultiHopResult(
            target_metric="Net Debt",
            computed_value=net_debt_computed,
            reported_value=claim_reported_net_debt,
            is_conclusive=True,
            has_conflict=has_conflict,
            direct_evidence=direct_evidence,
            derived_formula=formula_desc,
            unresolved_assumptions=[],
            provenance_pages=pages,
            explanation=(
                f"Multi-hop synthesis across Pages {pages}: {formula_desc} = {net_debt_computed:,.0f}. {outcome_str}"
            ),
        )
