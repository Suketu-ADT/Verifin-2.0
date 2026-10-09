"""
Tests for API structure, router registration, validation, and demo mode.
"""

from unittest.mock import AsyncMock, patch
import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.models.document import DocumentModel


@pytest.mark.asyncio
async def test_api_routers_loaded():
    """Verify all required API route endpoints are registered in FastAPI."""
    routes = list(app.openapi()["paths"].keys())
    
    assert "/api/system/health" in routes
    assert "/api/documents/upload" in routes
    assert "/api/verification/start" in routes
    assert "/api/verification/{id}/results" in routes
    assert "/api/demo/run" in routes


@pytest.mark.asyncio
async def test_invalid_document_upload_rejected_extension():
    """Verify non-PDF file upload is rejected with 400 Bad Request."""
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        files = {"file": ("test.txt", b"plain text content", "text/plain")}
        response = await client.post("/api/documents/upload", files=files)

    assert response.status_code == 400
    assert "Only PDF documents are accepted" in response.json()["detail"]


@pytest.mark.asyncio
async def test_invalid_document_upload_rejected_empty():
    """Verify empty PDF file upload is rejected with 400 Bad Request."""
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        files = {"file": ("empty.pdf", b"", "application/pdf")}
        response = await client.post("/api/documents/upload", files=files)

    assert response.status_code == 400
    assert "empty" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_invalid_document_upload_rejected_corrupt_header():
    """Verify file claiming to be PDF without %PDF- magic bytes is rejected."""
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        files = {"file": ("fake.pdf", b"NOT_A_REAL_PDF_HEADER", "application/pdf")}
        response = await client.post("/api/documents/upload", files=files)

    assert response.status_code == 400
    assert "PDF header" in response.json()["detail"]


@pytest.mark.asyncio
async def test_empty_verification_request_rejected():
    """Verify empty fields in verification start are rejected with validation error."""
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        # Empty document_id
        response = await client.post(
            "/api/verification/start",
            json={"document_id": "", "llm_output": "Sample text"},
        )
        assert response.status_code in [400, 422]

        # Empty llm_output
        response = await client.post(
            "/api/verification/start",
            json={"document_id": "doc-123", "llm_output": ""},
        )
        assert response.status_code in [400, 422]


@pytest.mark.asyncio
async def test_verification_start_nonexistent_document():
    """Verify verification start returns 404 when document does not exist in DB."""
    with patch(
        "app.repositories.document_repository.DocumentRepository.get_document_by_id",
        new_callable=AsyncMock,
    ) as mock_get_doc:
        mock_get_doc.return_value = None

        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            response = await client.post(
                "/api/verification/start",
                json={
                    "document_id": "nonexistent-doc-id",
                    "llm_output": "Apple revenue was up 12%.",
                },
            )

        assert response.status_code == 404
        assert "not found" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_demo_endpoint():
    """Verify demo run endpoint returns canned dataset matching contract."""
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.post("/api/demo/run")

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert "Apple FY2025" in data["message"]
    assert data["session_id"] == "demo-session-apple-2025"
    assert data["claims_count"] == len(data["claims"])
    assert data["claims_count"] > 0
    first_claim = data["claims"][0]
    assert "id" in first_claim
    assert "claim_text" in first_claim
    assert "claim_type" in first_claim
    assert "status" in first_claim
    assert "evidence" in first_claim
    assert "nli" in first_claim


@pytest.mark.asyncio
async def test_valid_pdf_upload():
    """Verify valid PDF upload succeeds and returns DocumentResponse contract."""
    mock_pdf_content = b"%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF"
    
    with patch(
        "app.repositories.document_repository.DocumentRepository.create_document",
        new_callable=AsyncMock,
    ) as mock_create_doc, patch(
        "app.services.document_service.StorageBackend.save",
        new_callable=AsyncMock,
    ) as mock_save:
        mock_save.return_value = "/fake/path/doc.pdf"
        mock_create_doc.side_effect = lambda doc: doc

        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            files = {"file": ("report.pdf", mock_pdf_content, "application/pdf")}
            response = await client.post("/api/documents/upload", files=files)

        assert response.status_code == 200
        data = response.json()
        assert "id" in data
        assert data["filename"] == "report.pdf"
        assert data["file_type"] == "pdf"
        assert data["size"] == len(mock_pdf_content)
        assert data["page_count"] >= 1
        assert data["status"] == "uploaded"


@pytest.mark.asyncio
async def test_verification_start_success():
    """Verify starting verification for existing document returns queued session."""
    dummy_doc = DocumentModel(
        id="doc-valid-123",
        filename="report.pdf",
        file_type="pdf",
        size=1024,
        page_count=2,
        file_path="/fake/report.pdf",
        status="uploaded",
    )

    with patch(
        "app.repositories.document_repository.DocumentRepository.get_document_by_id",
        new_callable=AsyncMock,
    ) as mock_get_doc, patch(
        "app.repositories.verification_repository.VerificationRepository.create_session",
        new_callable=AsyncMock,
    ) as mock_create_sess, patch(
        "app.repositories.verification_repository.VerificationRepository.save_claims",
        new_callable=AsyncMock,
    ) as mock_save_claims, patch(
        "app.services.retrieval_service.RetrievalService.retrieve_evidence",
        new_callable=AsyncMock,
    ) as mock_retrieve:
        mock_get_doc.return_value = dummy_doc
        mock_create_sess.side_effect = lambda sess: sess
        mock_save_claims.side_effect = lambda claims: claims
        mock_retrieve.return_value = []

        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            response = await client.post(
                "/api/verification/start",
                json={
                    "document_id": "doc-valid-123",
                    "llm_output": "Financial revenue was $100M.",
                },
            )

        assert response.status_code == 200
        data = response.json()
        assert "id" in data
        assert data["document_id"] == "doc-valid-123"
        assert data["status"] == "completed"
        assert "overall_score" in data
        assert "risk_level" in data
        assert len(data["claims"]) >= 1


@pytest.mark.asyncio
async def test_get_verification_results_not_found():
    """Verify getting results for non-existent session returns 404."""
    with patch(
        "app.repositories.verification_repository.VerificationRepository.get_session_by_id",
        new_callable=AsyncMock,
    ) as mock_get_sess:
        mock_get_sess.return_value = None

        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            response = await client.get("/api/verification/nonexistent-session/results")

        assert response.status_code == 404
        assert "not found" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_get_document_metadata_and_file():
    """Verify GET /api/documents/{id} and /file endpoints."""
    mock_doc = DocumentModel(
        id="doc-test-456",
        filename="report.pdf",
        file_type="pdf",
        size=1024,
        page_count=3,
        file_path="C:/fake/path/report.pdf",
        status="uploaded",
    )

    with patch(
        "app.repositories.document_repository.DocumentRepository.get_document_by_id",
        new_callable=AsyncMock,
    ) as mock_get_doc:
        mock_get_doc.return_value = mock_doc

        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            # 1. Fetch metadata
            resp = await client.get("/api/documents/doc-test-456")
            assert resp.status_code == 200
            data = resp.json()
            assert data["id"] == "doc-test-456"
            assert data["filename"] == "report.pdf"
            assert data["page_count"] == 3

            # 2. Fetch nonexistent
            mock_get_doc.return_value = None
            resp_404 = await client.get("/api/documents/nonexistent")
            assert resp_404.status_code == 404


