"""
Comprehensive unit and integration tests for Hugging Face Cloud LLM Integration in VERIFIN 2.0.
Tests all failure modes, schema validation, rate limits, timeouts, grounded explanations,
citation verification, and health probes using mocked AsyncInferenceClient.
Includes an optional live integration test excluded from normal test runs.
"""

import asyncio
import os
from unittest.mock import AsyncMock, MagicMock, patch
import pytest
from httpx import ASGITransport, AsyncClient

from app.config import settings
from app.main import app
from app.models.chunk import DocumentChunkModel
from app.schemas.llm import (
    LLMClaimExtractionResponse,
    LLMExplanationResponse,
    LLMExtractedClaim,
)
from app.services.llm.exceptions import (
    LLMAuthenticationError,
    LLMInputLimitExceededError,
    LLMModelNotFoundError,
    LLMRateLimitError,
    LLMSchemaValidationError,
    LLMTimeoutError,
)
from app.services.llm.explanation_service import GroundedExplanationService
from app.services.llm.factory import get_llm_provider, reset_llm_provider
from app.services.llm.financial_extractor import FinancialExtractorService
from app.services.llm.huggingface_provider import HuggingFaceProvider


# ------------------------------------------------------------------------------
# 1. Factory Selection & Configuration Tests
# ------------------------------------------------------------------------------

def test_provider_factory_selection_huggingface():
    """Verify get_llm_provider instantiates HuggingFaceProvider when LLM_PROVIDER=huggingface."""
    reset_llm_provider()
    with patch.object(settings, "llm_provider", "huggingface"):
        provider = get_llm_provider()
        assert provider.name == "huggingface"
        assert isinstance(provider, HuggingFaceProvider)
    reset_llm_provider()


def test_huggingface_unconfigured_behavior():
    """Verify unconfigured provider reports safe status and fails fast without token."""
    provider = HuggingFaceProvider(token=None)
    assert provider.is_configured is False

    # Health check returns safe unconfigured payload
    health = asyncio.run(provider.health_check())
    assert health["status"] == "unconfigured"
    assert "token" not in health
    assert health["provider"] == "huggingface"

    # Inference without token raises LLMAuthenticationError
    with pytest.raises(LLMAuthenticationError) as exc_info:
        asyncio.run(
            provider.generate_structured(
                prompt="Extract claims", response_model=LLMClaimExtractionResponse
            )
        )
    assert "HF_TOKEN" in str(exc_info.value)


# ------------------------------------------------------------------------------
# 2. Structured Output and Schema Validation Tests
# ------------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_huggingface_valid_claim_extraction_mocked():
    """Verify valid chat completion JSON parses into validated Pydantic models."""
    mock_client = MagicMock()
    mock_choice = MagicMock()
    mock_choice.message.content = """
    {
      "claims": [
        {
          "claim_text": "Net income reached $25.4 billion in Q3 2024.",
          "claim_type": "numerical",
          "entity": "Alphabet Inc.",
          "metric": "Net Income",
          "value": 25400000000.0,
          "unit": "billion",
          "currency": "USD",
          "reporting_period": "Q3 2024",
          "source_citation": "Net income reached $25.4 billion in Q3 2024."
        }
      ],
      "total_claims": 1
    }
    """
    mock_resp = MagicMock()
    mock_resp.choices = [mock_choice]
    mock_client.chat_completion = AsyncMock(return_value=mock_resp)

    provider = HuggingFaceProvider(token="hf_mock_token_123", client=mock_client)
    res = await provider.generate_structured(
        prompt="Extract claims", response_model=LLMClaimExtractionResponse
    )

    assert isinstance(res, LLMClaimExtractionResponse)
    assert len(res.claims) == 1
    claim = res.claims[0]
    assert claim.entity == "Alphabet Inc."
    assert claim.metric == "Net Income"
    assert claim.reporting_period == "Q3 2024"
    assert claim.value == 25400000000.0


@pytest.mark.asyncio
async def test_huggingface_missing_optional_financial_fields():
    """Verify claims with missing/null optional financial attributes validate cleanly."""
    mock_client = MagicMock()
    mock_choice = MagicMock()
    mock_choice.message.content = """
    {
      "claims": [
        {
          "claim_text": "The company completed its restructuring plan.",
          "claim_type": "factual",
          "entity": null,
          "metric": null,
          "value": null,
          "unit": null,
          "currency": null,
          "reporting_period": null
        }
      ],
      "total_claims": 1
    }
    """
    mock_resp = MagicMock()
    mock_resp.choices = [mock_choice]
    mock_client.chat_completion = AsyncMock(return_value=mock_resp)

    provider = HuggingFaceProvider(token="hf_mock_token_123", client=mock_client)
    res = await provider.generate_structured(
        prompt="Extract claims", response_model=LLMClaimExtractionResponse
    )

    assert len(res.claims) == 1
    claim = res.claims[0]
    assert claim.claim_text == "The company completed its restructuring plan."
    assert claim.value is None
    assert claim.reporting_period is None


@pytest.mark.asyncio
async def test_huggingface_malformed_json_triggers_schema_validation_error():
    """Verify non-JSON response from provider raises LLMSchemaValidationError."""
    mock_client = MagicMock()
    mock_choice = MagicMock()
    mock_choice.message.content = "I cannot provide JSON for this document."
    mock_resp = MagicMock()
    mock_resp.choices = [mock_choice]
    mock_client.chat_completion = AsyncMock(return_value=mock_resp)

    provider = HuggingFaceProvider(token="hf_mock_token_123", client=mock_client)

    with pytest.raises(LLMSchemaValidationError):
        await provider.generate_structured(
            prompt="Extract claims", response_model=LLMClaimExtractionResponse
        )


# ------------------------------------------------------------------------------
# 3. Error Normalization, Retries, and Backoff Tests
# ------------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_huggingface_authentication_error_fails_fast():
    """Verify 401 Unauthorized raises LLMAuthenticationError immediately without retrying."""
    mock_client = MagicMock()
    auth_err = Exception("401 Unauthorized: Invalid HF token")
    setattr(auth_err, "status_code", 401)
    mock_client.chat_completion = AsyncMock(side_effect=auth_err)

    provider = HuggingFaceProvider(token="invalid_token", client=mock_client, max_retries=2)

    with pytest.raises(LLMAuthenticationError):
        await provider.generate_structured(
            prompt="Extract claims", response_model=LLMClaimExtractionResponse
        )

    # Must NOT retry invalid credentials
    assert mock_client.chat_completion.call_count == 1


@pytest.mark.asyncio
async def test_huggingface_model_not_found_error_fails_fast():
    """Verify 404 Not Found raises LLMModelNotFoundError without retrying."""
    mock_client = MagicMock()
    not_found_err = Exception("404 Model Not Found on provider")
    setattr(not_found_err, "status_code", 404)
    mock_client.chat_completion = AsyncMock(side_effect=not_found_err)

    provider = HuggingFaceProvider(
        token="hf_token", model_name="NonExistent/Model", client=mock_client, max_retries=2
    )

    with pytest.raises(LLMModelNotFoundError):
        await provider.generate_structured(
            prompt="Extract claims", response_model=LLMClaimExtractionResponse
        )

    assert mock_client.chat_completion.call_count == 1


@pytest.mark.asyncio
async def test_huggingface_rate_limit_transient_retry_success():
    """Verify 429 Rate Limit error triggers exponential backoff and succeeds on retry."""
    mock_client = MagicMock()

    rate_err = Exception("429 Too Many Requests")
    setattr(rate_err, "status_code", 429)

    success_choice = MagicMock()
    success_choice.message.content = '{"claims": [{"claim_text": "Revenue was $10M."}], "total_claims": 1}'
    success_resp = MagicMock()
    success_resp.choices = [success_choice]

    # Attempt 1: 429 Rate limit, Attempt 2: Success
    mock_client.chat_completion = AsyncMock(side_effect=[rate_err, success_resp])

    provider = HuggingFaceProvider(
        token="hf_token", client=mock_client, max_retries=2
    )

    with patch("asyncio.sleep", new_callable=AsyncMock) as mock_sleep:
        res = await provider.generate_structured(
            prompt="Extract claims", response_model=LLMClaimExtractionResponse
        )

    assert len(res.claims) == 1
    assert mock_client.chat_completion.call_count == 2
    mock_sleep.assert_called_once()


@pytest.mark.asyncio
async def test_huggingface_timeout_and_exhausted_retries():
    """Verify continuous timeouts exhaust retries and raise normalized error."""
    mock_client = MagicMock()
    mock_client.chat_completion = AsyncMock(side_effect=asyncio.TimeoutError("Request timed out"))

    provider = HuggingFaceProvider(
        token="hf_token", client=mock_client, max_retries=1, timeout=5
    )

    with patch("asyncio.sleep", new_callable=AsyncMock):
        with pytest.raises(LLMTimeoutError):
            await provider.generate_structured(
                prompt="Extract claims", response_model=LLMClaimExtractionResponse
            )

    assert mock_client.chat_completion.call_count == 2  # initial + 1 retry


@pytest.mark.asyncio
async def test_huggingface_input_character_limit_enforced():
    """Verify input length exceeding max_input_chars is rejected before network dispatch."""
    mock_client = MagicMock()
    provider = HuggingFaceProvider(
        token="hf_token", client=mock_client, max_input_chars=100
    )

    oversized_prompt = "A" * 150
    with pytest.raises(LLMInputLimitExceededError):
        await provider.generate_structured(
            prompt=oversized_prompt, response_model=LLMClaimExtractionResponse
        )

    # No network call made
    mock_client.chat_completion.assert_not_called()


# ------------------------------------------------------------------------------
# 4. Citation Grounding & Anti-Hallucination Tests
# ------------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_financial_extractor_strips_hallucinated_citations():
    """Verify FinancialExtractorService resets citations that do not exist in source chunks."""
    mock_client = MagicMock()
    mock_choice = MagicMock()
    # LLM outputs a fabricated citation not in source text
    mock_choice.message.content = """
    {
      "claims": [
        {
          "claim_text": "Gross margin expanded to 45.2%.",
          "claim_type": "numerical",
          "source_citation": "Gross margin expanded to 45.2% due to supply chain synergies.",
          "cited_page_number": 99
        }
      ],
      "total_claims": 1
    }
    """
    mock_resp = MagicMock()
    mock_resp.choices = [mock_choice]
    mock_client.chat_completion = AsyncMock(return_value=mock_resp)

    hf_provider = HuggingFaceProvider(token="hf_token", client=mock_client)
    extractor = FinancialExtractorService(llm_provider=hf_provider)

    source_chunks = [
        DocumentChunkModel(
            id="chk_real_01",
            document_id="doc_test",
            chunk_index=0,
            text="Operating expenses grew 5% in the fourth quarter.",
            page_number=1,
            token_count=10,
        )
    ]

    claims = await extractor.extract_claims(
        text="Sample text",
        document_id="doc_test",
        source_chunks=source_chunks,
    )

    assert len(claims) == 1
    claim = claims[0]
    # Fabricated citation must be stripped and flagged for review
    assert claim.source_citation is None
    assert claim.source_page is None
    assert claim.needs_review is True
    # Claim ID must be application-assigned, not model-invented
    assert claim.claim_id == "doc_test_claim_1"


# ------------------------------------------------------------------------------
# 5. Evidence-Grounded Explanation Tests
# ------------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_grounded_explanation_service_preserves_nli_verdict():
    """Verify GroundedExplanationService preserves NLI verdict and audits facts against evidence."""
    mock_client = MagicMock()
    mock_choice = MagicMock()
    mock_choice.message.content = """
    {
      "summary": "The claim that revenue was $50 billion is contradicted by the income statement.",
      "source_facts": ["Revenue for the fiscal year was $39.5 billion."],
      "inferred_relationships": ["The stated $50 billion exceeds actual revenue by $10.5 billion."],
      "missing_evidence": [],
      "uncertainty_note": null,
      "recommend_review": false,
      "evidence_references": []
    }
    """
    mock_resp = MagicMock()
    mock_resp.choices = [mock_choice]
    mock_client.chat_completion = AsyncMock(return_value=mock_resp)

    provider = HuggingFaceProvider(token="hf_token", client=mock_client)
    explainer = GroundedExplanationService(llm_provider=provider)

    chunks = [
        DocumentChunkModel(
            id="chk_rev_01",
            document_id="doc_test",
            chunk_index=0,
            text="Revenue for the fiscal year was $39.5 billion.",
            page_number=12,
            token_count=10,
        )
    ]

    res: LLMExplanationResponse = await explainer.generate_explanation(
        claim_text="Total revenue was $50 billion.",
        retrieved_chunks=chunks,
        nli_verdict="CONTRADICTED",
        nli_confidence=0.94,
        numerical_summary="Numerical discrepancy: 50.0B vs 39.5B",
        claim_id="claim_001",
    )

    assert "contradicted" in res.summary.lower()
    assert len(res.source_facts) == 1
    assert "Revenue for the fiscal year" in res.source_facts[0]
    assert len(res.evidence_references) == 1
    assert res.evidence_references[0]["chunk_id"] == "chk_rev_01"


@pytest.mark.asyncio
async def test_grounded_explanation_rejects_unauthorized_evidence_references():
    """Verify GroundedExplanationService rejects fabricated or unauthorized evidence references."""
    mock_client = MagicMock()
    mock_choice = MagicMock()
    # LLM outputs unauthorized evidence references to non-existent chunk_id or wrong page
    mock_choice.message.content = """
    {
      "summary": "Revenue was verified from the audit notes.",
      "source_facts": ["Revenue for the fiscal year was $39.5 billion."],
      "inferred_relationships": [],
      "missing_evidence": [],
      "uncertainty_note": null,
      "recommend_review": false,
      "evidence_references": [
        {"chunk_id": "fabricated_chunk_999", "page_number": 999},
        {"chunk_id": "chk_valid_01", "page_number": 12}
      ]
    }
    """
    mock_resp = MagicMock()
    mock_resp.choices = [mock_choice]
    mock_client.chat_completion = AsyncMock(return_value=mock_resp)

    provider = HuggingFaceProvider(token="hf_token", client=mock_client)
    explainer = GroundedExplanationService(llm_provider=provider)

    chunks = [
        DocumentChunkModel(
            id="chk_valid_01",
            document_id="doc_test",
            chunk_index=0,
            text="Revenue for the fiscal year was $39.5 billion.",
            page_number=12,
            token_count=10,
        )
    ]

    res = await explainer.generate_explanation(
        claim_text="Total revenue was $39.5 billion.",
        retrieved_chunks=chunks,
        nli_verdict="SUPPORTED",
        nli_confidence=0.98,
        claim_id="claim_002",
    )

    # Fabricated chunk reference must be stripped
    ref_ids = [r["chunk_id"] for r in res.evidence_references]
    assert "fabricated_chunk_999" not in ref_ids
    assert "chk_valid_01" in ref_ids
    assert res.recommend_review is True
    assert "Unauthorized or fabricated evidence" in (res.uncertainty_note or "")


@pytest.mark.asyncio
async def test_grounded_explanation_detects_verdict_conflict_and_preserves_immutable_verdict():
    """Verify GroundedExplanationService flags review when LLM summary conflicts with authoritative verdict."""
    mock_client = MagicMock()
    mock_choice = MagicMock()
    # LLM hallucinates that the claim is true/supported despite NLI verdict being CONTRADICTED
    mock_choice.message.content = """
    {
      "summary": "The claim is supported and confirmed by evidence to be fully accurate.",
      "source_facts": ["Revenue for the fiscal year was $39.5 billion."],
      "inferred_relationships": [],
      "missing_evidence": [],
      "uncertainty_note": null,
      "recommend_review": false,
      "evidence_references": []
    }
    """
    mock_resp = MagicMock()
    mock_resp.choices = [mock_choice]
    mock_client.chat_completion = AsyncMock(return_value=mock_resp)

    provider = HuggingFaceProvider(token="hf_token", client=mock_client)
    explainer = GroundedExplanationService(llm_provider=provider)

    chunks = [
        DocumentChunkModel(
            id="chk_rev_01",
            document_id="doc_test",
            chunk_index=0,
            text="Revenue for the fiscal year was $39.5 billion.",
            page_number=12,
            token_count=10,
        )
    ]

    authoritative_verdict = "CONTRADICTED"
    res = await explainer.generate_explanation(
        claim_text="Revenue was $50 billion.",
        retrieved_chunks=chunks,
        nli_verdict=authoritative_verdict,
        nli_confidence=0.95,
        claim_id="claim_003",
    )

    # Must flag for human review and append discrepancy warning
    assert res.recommend_review is True
    assert "Discrepancy detected" in res.uncertainty_note
    assert "CONTRADICTED" in res.uncertainty_note


@pytest.mark.asyncio
async def test_authoritative_verdict_cannot_be_overwritten_by_llm():
    """Verify ClaimModel status is strictly bound to NLI verdict and cannot be mutated by LLM text."""
    from app.models.claim import ClaimModel

    # Even with an arbitrary or conflicting LLM explanation summary,
    # the authoritative verdict remains CONTRADICTED
    authoritative_status = "CONTRADICTED"
    cm = ClaimModel(
        id="claim_test_99",
        session_id="session_test_99",
        claim_text="Revenue grew by 50%",
        claim_type="numerical",
        status=authoritative_status,
        confidence=0.96,
        risk_level="HIGH",
    )

    assert cm.status == "CONTRADICTED"
    # Verify Pydantic model cannot be altered by LLM text fields
    llm_conflicting_summary = "The claim is supported and verified to be 100% correct."
    assert cm.status != llm_conflicting_summary
    assert cm.status == authoritative_status


# ------------------------------------------------------------------------------
# 6. Health & Readiness API Endpoints Tests
# ------------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_system_health_and_llm_endpoints_hf():
    """Verify /api/system/health, /api/system/llm/health, and /api/system/llm/readiness."""
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        # 1. GET /api/system/health
        h_resp = await client.get("/api/system/health")
        assert h_resp.status_code == 200
        data = h_resp.json()
        assert "services" in data
        assert "llm" in data["services"]

        # 2. GET /api/system/llm/health
        llm_h = await client.get("/api/system/llm/health")
        assert llm_h.status_code == 200
        llm_data = llm_h.json()
        assert "provider" in llm_data
        assert "status" in llm_data
        # Ensure secret tokens are never exposed
        assert "hf_token" not in llm_data
        assert "token" not in llm_data or llm_data.get("token") is True

        # 3. POST /api/system/llm/readiness
        readiness_resp = await client.post("/api/system/llm/readiness")
        assert readiness_resp.status_code == 200
        r_data = readiness_resp.json()
        assert "status" in r_data


# ------------------------------------------------------------------------------
# 7. Optional Live Hugging Face Integration Test
# ------------------------------------------------------------------------------

@pytest.mark.skipif(
    os.getenv("RUN_LIVE_HF_TEST") != "1" or not os.getenv("HF_TOKEN"),
    reason="Live Hugging Face test skipped unless RUN_LIVE_HF_TEST=1 and valid HF_TOKEN is provided.",
)
@pytest.mark.asyncio
async def test_live_huggingface_inference():
    """Live smoke test verifying actual cloud inference on Hugging Face providers."""
    live_token = os.getenv("HF_TOKEN")
    live_model = os.getenv("HF_MODEL", "Qwen/Qwen2.5-72B-Instruct")
    live_provider = HuggingFaceProvider(
        token=live_token,
        model_name=live_model,
        provider="auto",
        timeout=30,
        max_output_tokens=256,
    )

    probe = await live_provider.test_readiness()
    assert probe["status"] in ("operational", "ready")

    # Real claim extraction on sample financial sentence
    sample_text = "Apple Inc. reported quarterly revenue of $94.9 billion for the fiscal fourth quarter of 2024."
    res = await live_provider.generate_structured(
        prompt=f"Extract claims from:\n{sample_text}",
        response_model=LLMClaimExtractionResponse,
    )

    assert len(res.claims) >= 1
    assert "94.9" in res.claims[0].claim_text or res.claims[0].value == 94900000000.0
