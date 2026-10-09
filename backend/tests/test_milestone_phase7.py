"""
Unit and integration tests for VERIFIN 2.0 Phase 7 milestone:
- Part A: LLM Provider Integration, Citation Validation, Health Status
- Part B: Multi-Hop Financial Reasoning and Cross-Page Net Debt Synthesis
- Part C: OCR Benchmark Pipeline (CER, WER, Numerical Accuracy, Threshold Tuning)
- Part D: Human-in-the-Loop Review Queue, Decision Audit Trails, and User Scoping
"""

from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch
import pytest
from httpx import ASGITransport, AsyncClient
from PIL import Image, ImageDraw

from app.main import app
from app.models.chunk import DocumentChunkModel
from app.models.review import ReviewAuditRecord, ReviewItem
from app.models.table import FinancialTableModel, TableCellModel
from app.schemas.llm import (
    LLMClaimExtractionResponse,
    LLMExtractedClaim,
    LLMExplanationResponse,
    LLMMultiHopSynthesis,
)
from app.services.llm.base import LLMProvider
from app.services.llm.citation_validator import CitationValidator
from app.services.llm.factory import get_llm_provider
from app.services.llm.financial_extractor import FinancialExtractorService
from app.services.llm.gemini_provider import GeminiProvider
from app.services.llm.mock_provider import MockLLMProvider
from app.services.llm.openai_provider import OpenAIProvider
from app.services.multi_hop_reasoner import (
    EvidenceNode,
    MultiHopReasonerService,
    MultiHopResult,
)
from app.services.ocr_benchmark import (
    OCRBenchmarkMetrics,
    OCRBenchmarkPipeline,
    OCRBenchmarkSample,
)
from app.services.review_service import ReviewService


# ==============================================================================
# PART A: LLM INTEGRATION TESTS
# ==============================================================================

@pytest.mark.asyncio
async def test_mock_llm_provider_generation_and_health():
    """Verify MockLLMProvider fulfills abstract contract and handles canned schemas."""
    mock_p = MockLLMProvider()
    assert mock_p.name == "mock"
    assert mock_p.is_configured is True

    health = await mock_p.health_check()
    assert health["status"] == "ready"
    assert health["is_mock"] is True

    canned = LLMClaimExtractionResponse(
        claims=[
            LLMExtractedClaim(
                claim_text="Total revenue was $96.8 billion in FY2024.",
                claim_type="numerical",
                entities=["Apple Inc."],
                reporting_period="FY2024",
                currency="USD",
                unit="billion",
                source_citation="Total revenue was $96.8 billion in FY2024.",
                cited_page_number=1,
            )
        ],
        total_claims=1,
    )
    mock_p.set_canned_response(canned)

    result = await mock_p.generate_structured(
        prompt="Extract claims", response_model=LLMClaimExtractionResponse
    )
    assert len(result.claims) == 1
    assert result.claims[0].reporting_period == "FY2024"


@pytest.mark.asyncio
async def test_llm_provider_error_handling_and_fallback():
    """Verify provider errors are caught gracefully and trigger deterministic fallback."""
    failing_mock = MockLLMProvider(should_fail=True)
    extractor = FinancialExtractorService(llm_provider=failing_mock)

    # Text contains a financial sentence
    sample_text = "Net income increased by 15.2% to $25.4 billion in Q3 2024."
    claims = await extractor.extract_claims(sample_text)

    # Should fall back to rule-based ClaimExtractor
    assert len(claims) >= 1
    assert "Net income" in claims[0].claim_text or "increased" in claims[0].claim_text


@pytest.mark.asyncio
async def test_citation_validator_verbatim_and_fuzzy():
    """Verify CitationValidator confirms verbatim and fuzzy quotes against source chunks."""
    validator = CitationValidator()

    chunks = [
        DocumentChunkModel(
            id="chk_p1",
            document_id="doc_1",
            chunk_index=0,
            text="In the fiscal year ended September 28, 2024, Apple Inc. generated total net sales of $391.0 billion.",
            page_number=1,
            token_count=20,
        ),
        DocumentChunkModel(
            id="chk_p2",
            document_id="doc_1",
            chunk_index=1,
            text="Operating expenses for the quarter were $14,294 million compared to $13,415 million in the prior year.",
            page_number=2,
            token_count=20,
        ),
    ]

    # 1. Exact match on correct page
    res_exact = validator.validate_citation(
        citation_text="total net sales of $391.0 billion",
        cited_page=1,
        source_chunks=chunks,
    )
    assert res_exact.is_valid is True
    assert res_exact.matched_page_number == 1
    assert res_exact.matched_chunk_id == "chk_p1"
    assert res_exact.similarity_score == 1.0

    # 2. Page mismatch rejection
    res_page_mismatch = validator.validate_citation(
        citation_text="total net sales of $391.0 billion",
        cited_page=2,  # Wrong page
        source_chunks=chunks,
    )
    assert res_page_mismatch.is_valid is False

    # 3. Hallucinated quote rejection
    res_hallucinated = validator.validate_citation(
        citation_text="The company announced a special dividend of $50 per share payable immediately.",
        cited_page=1,
        source_chunks=chunks,
    )
    assert res_hallucinated.is_valid is False
    assert "rejection" in res_hallucinated.reason.lower()


@pytest.mark.asyncio
async def test_citation_validator_table_grounding():
    """Verify citations contained within structured table line items are validated."""
    validator = CitationValidator()

    tables = [
        FinancialTableModel(
            id="tbl_bs",
            document_id="doc_1",
            page_number=5,
            table_index=0,
            headers=["Line Item", "2024", "2023"],
            rows=[
                [
                    TableCellModel(raw_text="Total Term Debt", normalized_value=None),
                    TableCellModel(raw_text="106,629", normalized_value=106629.0, is_numeric=True),
                    TableCellModel(raw_text="111,088", normalized_value=111088.0, is_numeric=True),
                ]
            ],
            reporting_periods=["2024", "2023"],
        )
    ]

    res = validator.validate_citation(
        citation_text="Total Term Debt",
        cited_page=5,
        source_chunks=[],
        source_tables=tables,
    )
    assert res.is_valid is True
    assert res.matched_page_number == 5


@pytest.mark.asyncio
async def test_llm_system_health_endpoint():
    """Verify /api/system/llm/health returns safe configuration status without secrets."""
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        resp = await client.get("/api/system/llm/health")

    assert resp.status_code == 200
    data = resp.json()
    assert "status" in data
    assert "provider" in data
    # Ensure raw API keys are never exposed in JSON output
    assert "api_key" not in data or data.get("api_key") is True


# ==============================================================================
# PART B: MULTI-HOP FINANCIAL REASONING TESTS
# ==============================================================================

def test_multihop_net_debt_conclusive_cross_page():
    """
    Verify cross-page deterministic synthesis for Net Debt:
    - Debt extracted from Balance Sheet on Page 10
    - Cash extracted from Liquidity Note on Page 14
    """
    reasoner = MultiHopReasonerService()

    # Table on Page 10: Balance Sheet
    table_bs = FinancialTableModel(
        id="tbl_bs",
        document_id="doc_sec",
        page_number=10,
        table_index=0,
        headers=["Item", "FY2024"],
        rows=[
            [
                TableCellModel(raw_text="Total Debt", normalized_value=None),
                TableCellModel(raw_text="$95,000 million", normalized_value=95000000000.0, is_numeric=True, col_idx=1, row_idx=0),
            ]
        ],
        reporting_periods=["FY2024"],
    )

    # Footnote on Page 14: Cash and Short-term investments
    chunk_note = DocumentChunkModel(
        id="chk_liquidity",
        document_id="doc_sec",
        chunk_index=3,
        text="Note 4: Cash and cash equivalents stood at $30,000 million as of fiscal year end 2024.",
        page_number=14,
        token_count=18,
    )

    res: MultiHopResult = reasoner.compute_net_debt(
        claim_reported_net_debt=65000000000.0,
        target_period="2024",
        chunks=[chunk_note],
        tables=[table_bs],
    )

    assert res.is_conclusive is True
    assert res.computed_value == 65000000000.0
    assert res.has_conflict is False
    assert 10 in res.provenance_pages
    assert 14 in res.provenance_pages
    assert "95,000,000,000" in res.derived_formula
    assert "30,000,000,000" in res.derived_formula


def test_multihop_net_debt_missing_operand_refusal():
    """Verify reasoner returns inconclusive result and refuses to guess when Cash is missing."""
    reasoner = MultiHopReasonerService()

    table_bs = FinancialTableModel(
        id="tbl_bs",
        document_id="doc_sec",
        page_number=10,
        table_index=0,
        headers=["Item", "FY2024"],
        rows=[
            [
                TableCellModel(raw_text="Total Debt", normalized_value=None),
                TableCellModel(raw_text="$95,000M", normalized_value=95000.0, is_numeric=True),
            ]
        ],
        reporting_periods=["FY2024"],
    )

    # No cash disclosure provided
    res: MultiHopResult = reasoner.compute_net_debt(
        claim_reported_net_debt=65000.0,
        target_period="2024",
        chunks=[],
        tables=[table_bs],
    )

    assert res.is_conclusive is False
    assert res.computed_value is None
    assert len(res.unresolved_assumptions) > 0
    assert any("Cash" in assump for assump in res.unresolved_assumptions)


def test_multihop_net_debt_detected_numerical_conflict():
    """Verify reasoner flags has_conflict when computed value differs from reported value."""
    reasoner = MultiHopReasonerService()

    table_bs = FinancialTableModel(
        id="tbl_bs",
        document_id="doc_sec",
        page_number=8,
        table_index=0,
        headers=["Item", "FY2024"],
        rows=[
            [
                TableCellModel(raw_text="Long-term debt", normalized_value=None),
                TableCellModel(raw_text="50,000", normalized_value=50000.0, is_numeric=True),
            ],
            [
                TableCellModel(raw_text="Cash and cash equivalents", normalized_value=None),
                TableCellModel(raw_text="20,000", normalized_value=20000.0, is_numeric=True),
            ],
        ],
        reporting_periods=["FY2024"],
    )

    # Correct Net Debt is 30,000, but claim alleges 15,000
    res = reasoner.compute_net_debt(
        claim_reported_net_debt=15000.0,
        target_period="2024",
        chunks=[],
        tables=[table_bs],
    )

    assert res.is_conclusive is True
    assert res.computed_value == 30000.0
    assert res.has_conflict is True
    assert "Conflict detected" in res.explanation


# ==============================================================================
# PART C: OCR BENCHMARK TESTS
# ==============================================================================

def test_ocr_benchmark_cer_wer_computation():
    """Verify CER and WER computation on reference vs hypothesis strings."""
    pipeline = OCRBenchmarkPipeline()

    ref = "Total revenue was $120.5 million"
    hyp_identical = "Total revenue was $120.5 million"
    assert pipeline.compute_cer(ref, hyp_identical) == 0.0
    assert pipeline.compute_wer(ref, hyp_identical) == 0.0

    # 1 character typo: "revemue"
    hyp_typo = "Total revemue was $120.5 million"
    cer = pipeline.compute_cer(ref, hyp_typo)
    assert 0.0 < cer < 0.1  # 1 substitution out of 32 chars (~0.031)
    wer = pipeline.compute_wer(ref, hyp_typo)
    assert wer == 0.2  # 1 word wrong out of 5 (20%)


def test_ocr_benchmark_numerical_accuracy_separation():
    """Verify numerical extraction accuracy is measured independently of prose words."""
    pipeline = OCRBenchmarkPipeline()

    ground_truth_vals = [120.5, 45.2, 75.3]

    # Hypothesis has noisy prose ("Totall revvenue") but numbers are exact
    hyp_noisy_prose = "Totall revvenue waz 120.5 with costz 45.2 and net profitt 75.3"
    acc = pipeline.evaluate_numerical_accuracy(ground_truth_vals, hyp_noisy_prose)
    assert acc == 1.0  # All 3 numerical figures correctly extracted

    # Hypothesis missing 1 number
    hyp_missing = "Revenue was 120.5 with net profit 75.3"
    acc_partial = pipeline.evaluate_numerical_accuracy(ground_truth_vals, hyp_missing)
    assert round(acc_partial, 2) == 0.67  # 2 of 3


def test_ocr_benchmark_pipeline_evaluation_mock():
    """Verify OCRBenchmarkPipeline evaluates samples and records metrics metadata."""
    pipeline = OCRBenchmarkPipeline()

    dummy_img = Image.new("RGB", (100, 50), color="white")
    sample = OCRBenchmarkSample(
        sample_id="sec_10k_sample_01",
        ground_truth_text="Operating income $4,500 million",
        ground_truth_numerical_values=[4500.0],
        split="test",
        provenance="Synthetic SEC 10-K Evaluation Corpus v1",
        license="CC-BY-4.0",
    )

    with patch.object(pipeline.ocr_service, "is_available", return_value=True), \
         patch.object(pipeline.ocr_service, "ocr_page_image") as mock_ocr:
        mock_res = MagicMock()
        mock_res.text = "Operating income $4,500 million"
        mock_res.mean_confidence = 94.0
        mock_res.needs_review = False
        mock_ocr.return_value = mock_res

        metrics: OCRBenchmarkMetrics = pipeline.evaluate_dataset(
            samples=[(dummy_img, sample)], confidence_threshold=65.0
        )

        assert metrics.split == "test"
        assert metrics.sample_count == 1
        assert metrics.mean_cer == 0.0
        assert metrics.mean_wer == 0.0
        assert metrics.numerical_cell_accuracy == 1.0
        assert "SEC 10-K" in metrics.provenance
        assert "CC-BY-4.0" in metrics.dataset_license


# ==============================================================================
# PART D: HUMAN-IN-THE-LOOP REVIEW QUEUE AND AUDIT TRAIL TESTS
# ==============================================================================

@pytest.mark.asyncio
async def test_review_service_enqueue_and_decision_lifecycle():
    """Verify review queue enqueuing, accept, correct, reject, and immutable audit trail."""
    mock_review_repo = MagicMock()
    review_store = {}

    async def fake_create(item: ReviewItem):
        review_store[item.id] = item
        return item.id

    async def fake_get(item_id: str):
        return review_store.get(item_id)

    async def fake_update(item: ReviewItem):
        review_store[item.id] = item
        return True

    mock_review_repo.create_review_item = AsyncMock(side_effect=fake_create)
    mock_review_repo.get_review_by_id = AsyncMock(side_effect=fake_get)
    mock_review_repo.update_review = AsyncMock(side_effect=fake_update)

    service = ReviewService(review_repository=mock_review_repo)

    # 1. Enqueue uncertain cell from table
    table = FinancialTableModel(
        id="tbl_uncertain",
        document_id="doc_audit_1",
        page_number=3,
        table_index=0,
        headers=["Metric", "Value"],
        rows=[
            [
                TableCellModel(raw_text="Capital Expenditures", normalized_value=None),
                TableCellModel(
                    raw_text="3,2O0",  # OCR typo 'O' instead of '0'
                    normalized_value=3200.0,
                    is_numeric=True,
                    ocr_confidence=42.0,  # Below threshold
                    needs_review=True,
                    row_idx=0,
                    col_idx=1,
                ),
            ]
        ],
        reporting_periods=["Value"],
    )

    enqueued = await service.enqueue_uncertain_table_cells(table, user_id="analyst_alice")
    assert enqueued == 1
    item_id = list(review_store.keys())[0]
    enqueued_item = review_store[item_id]
    assert enqueued_item.status == "pending"
    assert enqueued_item.ocr_confidence == 42.0
    assert enqueued_item.original_text == "3,2O0"

    # 2. Analyst submits correction
    corrected_item = await service.submit_decision(
        item_id=item_id,
        reviewer_id="analyst_alice",
        action="correct",
        reason="Corrected OCR letter 'O' to number '0'",
        corrected_value=3200.0,
        corrected_text="3,200",
        user_id="analyst_alice",
    )

    assert corrected_item.status == "corrected"
    assert corrected_item.current_value == 3200.0
    assert corrected_item.current_text == "3,200"
    # Original OCR output must be preserved!
    assert corrected_item.original_text == "3,2O0"
    assert len(corrected_item.audit_trail) == 1

    audit_entry = corrected_item.audit_trail[0]
    assert audit_entry.reviewer_id == "analyst_alice"
    assert audit_entry.action == "correct"
    assert audit_entry.previous_text == "3,2O0"
    assert audit_entry.new_text == "3,200"


@pytest.mark.asyncio
async def test_review_user_scoping_security():
    """Verify reviewer queue rejects unauthorized cross-user modifications."""
    mock_review_repo = MagicMock()
    alice_item = ReviewItem(
        id="item_alice_01",
        document_id="doc_alice",
        user_id="alice",
        page_number=1,
        line_item_name="Revenue",
        original_text="100",
        current_text="100",
        ocr_confidence=30.0,
        reason_for_review="Low confidence",
    )

    mock_review_repo.get_review_by_id = AsyncMock(return_value=alice_item)
    service = ReviewService(review_repository=mock_review_repo)

    # Bob tries to access or alter Alice's review item
    with pytest.raises(Exception) as exc_info:
        await service.submit_decision(
            item_id="item_alice_01",
            reviewer_id="bob",
            action="accept",
            reason="Illegal cross-tenant edit",
            user_id="bob",  # Mismatch with alice
        )

    assert "403" in str(exc_info.value) or "Unauthorized" in str(exc_info.value)


@pytest.mark.asyncio
async def test_review_api_endpoints_via_client():
    """Verify review queue API routes (/queue, /decide, /audit) with dependency override."""
    from app.api.review import get_review_service

    mock_service = MagicMock()
    test_item = ReviewItem(
        id="rev_123",
        document_id="doc_xyz",
        page_number=2,
        line_item_name="Gross Margin",
        original_text="42.8%",
        original_value=42.8,
        current_text="42.8%",
        current_value=42.8,
        ocr_confidence=55.0,
        reason_for_review="Low OCR confidence",
        status="pending",
        audit_trail=[],
    )
    mock_service.get_queue = AsyncMock(return_value=[test_item])

    decided_item = ReviewItem(
        id="rev_123",
        document_id="doc_xyz",
        page_number=2,
        line_item_name="Gross Margin",
        original_text="42.8%",
        original_value=42.8,
        current_text="42.8%",
        current_value=42.8,
        ocr_confidence=55.0,
        reason_for_review="Low OCR confidence",
        status="accepted",
        audit_trail=[
            ReviewAuditRecord(
                reviewer_id="lead_analyst",
                action="accept",
                previous_text="42.8%",
                new_text="42.8%",
                reason="Confirmed against PDF view",
            )
        ],
    )
    mock_service.submit_decision = AsyncMock(return_value=decided_item)
    mock_service.review_repo.get_review_by_id = AsyncMock(return_value=decided_item)

    app.dependency_overrides[get_review_service] = lambda: mock_service

    try:
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            # 1. GET /api/review/queue
            q_res = await client.get("/api/review/queue")
            assert q_res.status_code == 200
            assert len(q_res.json()) == 1
            assert q_res.json()[0]["id"] == "rev_123"

            # 2. POST /api/review/{item_id}/decide
            d_res = await client.post(
                "/api/review/rev_123/decide",
                json={
                    "reviewer_id": "lead_analyst",
                    "action": "accept",
                    "reason": "Confirmed against PDF view",
                },
            )
            assert d_res.status_code == 200
            assert d_res.json()["status"] == "accepted"

            # 3. GET /api/review/{item_id}/audit
            a_res = await client.get("/api/review/rev_123/audit")
            assert a_res.status_code == 200
            assert len(a_res.json()) == 1
            assert a_res.json()[0]["reviewer_id"] == "lead_analyst"

    finally:
        app.dependency_overrides.pop(get_review_service, None)
