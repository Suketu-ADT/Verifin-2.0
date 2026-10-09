"""
Comprehensive unit and integration tests for Phase 2: Evidence Retrieval and Embeddings.
"""

from unittest.mock import AsyncMock, MagicMock, patch
import pytest
from httpx import ASGITransport, AsyncClient

from app.config import settings
from app.main import app
from app.models.chunk import DocumentChunkModel
from app.models.document import DocumentModel
from app.schemas.retrieval import EvidenceChunkResponse
from app.services.chunking_service import ChunkingService
from app.services.embedding_service import EmbeddingService
from app.services.retrieval_service import RetrievalService


# ── EmbeddingService Unit Tests ──────────────────────────────────────────────

def test_embedding_service_preprocess():
    service = EmbeddingService()
    raw = "  Apple Inc. reported    revenue of   $94.8 billion. \n\n\n  "
    cleaned = service.preprocess_text(raw)
    assert cleaned == "Apple Inc. reported revenue of $94.8 billion."


def test_embedding_service_empty_text_error():
    service = EmbeddingService()
    with pytest.raises(ValueError, match="empty or whitespace-only"):
        service.generate_embedding("   ")


def test_embedding_service_batch_empty_list():
    service = EmbeddingService()
    assert service.generate_embeddings([]) == []


def test_embedding_service_cosine_similarity():
    service = EmbeddingService()
    vec_a = [1.0, 0.0, 0.0]
    vec_b = [1.0, 0.0, 0.0]
    vec_c = [0.0, 1.0, 0.0]
    vec_d = [-1.0, 0.0, 0.0]

    # Identical vectors
    assert pytest.approx(service.compute_cosine_similarity(vec_a, vec_b), 0.001) == 1.0
    # Orthogonal vectors
    assert pytest.approx(service.compute_cosine_similarity(vec_a, vec_c), 0.001) == 0.0
    # Opposing vectors
    assert pytest.approx(service.compute_cosine_similarity(vec_a, vec_d), 0.001) == -1.0


def test_embedding_service_mocked_generation():
    service = EmbeddingService()
    service._initialized = True
    mock_model = MagicMock()
    mock_model.encode.return_value = [0.1, 0.2, 0.3]
    service._model = mock_model

    emb = service.generate_embedding("Total revenue was $10M.")
    assert emb == [0.1, 0.2, 0.3]
    mock_model.encode.assert_called_once()


# ── ChunkingService Unit Tests ────────────────────────────────────────────────

def test_chunking_service_split_text():
    chunker = ChunkingService(chunk_size=100, chunk_overlap=20)
    text = (
        "Operating expenses decreased by 5% during the fourth quarter. "
        "Research and development investments totaled $12.4 billion for the fiscal year. "
        "Net income reached record levels across all major segments."
    )
    chunks = chunker.split_text_into_chunks(text)
    assert len(chunks) >= 2
    for c in chunks:
        assert len(c) > 0


def test_chunking_service_empty_text():
    chunker = ChunkingService()
    assert chunker.split_text_into_chunks("   \n\t  ") == []


def test_chunking_service_extract_pdf_mocked():
    mock_emb = MagicMock()
    mock_emb.is_healthy.return_value = True
    mock_emb.dimension = 3
    mock_emb.generate_embeddings.return_value = [[0.1, 0.2, 0.3], [0.4, 0.5, 0.6]]

    chunker = ChunkingService(chunk_size=100, chunk_overlap=20, embedding_service=mock_emb)

    # Mock pypdf reader
    with patch("app.services.chunking_service.PdfReader") as mock_pdf_reader:
        mock_page1 = MagicMock()
        mock_page1.extract_text.return_value = "Page 1 revenue was $50 billion."
        mock_page2 = MagicMock()
        mock_page2.extract_text.return_value = "Page 2 net margin rose to 25 percent."

        mock_instance = MagicMock()
        mock_instance.pages = [mock_page1, mock_page2]
        mock_pdf_reader.return_value = mock_instance

        chunks = chunker.extract_chunks_from_pdf_bytes(b"%PDF-1.4 mock content", "doc_123")

        assert len(chunks) == 2
        assert chunks[0].document_id == "doc_123"
        assert chunks[0].page_number == 1
        assert chunks[0].chunk_index == 0
        assert chunks[0].id == "doc_123_p1_c0"
        assert "revenue" in chunks[0].text

        assert chunks[1].document_id == "doc_123"
        assert chunks[1].page_number == 2
        assert chunks[1].chunk_index == 1
        assert chunks[1].id == "doc_123_p2_c1"
        assert "margin" in chunks[1].text


# ── RetrievalService Unit Tests & Error Handling ─────────────────────────────

@pytest.mark.asyncio
async def test_retrieval_service_empty_query():
    service = RetrievalService()
    with pytest.raises(Exception) as excinfo:
        await service.retrieve_evidence(query="")
    assert "400" in str(excinfo.value) or "empty" in str(excinfo.value)


@pytest.mark.asyncio
async def test_retrieval_service_document_not_found():
    mock_doc_repo = AsyncMock()
    mock_doc_repo.get_document_by_id.return_value = None

    service = RetrievalService(document_repository=mock_doc_repo)
    with pytest.raises(Exception) as excinfo:
        await service.retrieve_evidence(query="Net revenue", document_id="non_existent_doc")
    assert "404" in str(excinfo.value)


@pytest.mark.asyncio
async def test_retrieval_service_embedding_service_down():
    mock_doc_repo = AsyncMock()
    mock_doc = DocumentModel(
        id="doc_1", filename="annual_report.pdf", file_type="pdf", size=1024, file_path="/tmp/1"
    )
    mock_doc_repo.get_document_by_id.return_value = mock_doc

    mock_emb = MagicMock()
    mock_emb.is_healthy.return_value = False

    service = RetrievalService(
        embedding_service=mock_emb,
        document_repository=mock_doc_repo,
    )
    with pytest.raises(Exception) as excinfo:
        await service.retrieve_evidence(query="Net revenue", document_id="doc_1")
    assert "503" in str(excinfo.value)


@pytest.mark.asyncio
async def test_retrieval_service_ranking_exact_cosine():
    """Verify that retrieval accurately ranks top chunks using cosine similarity."""
    mock_doc_repo = AsyncMock()
    mock_doc = DocumentModel(
        id="doc_1", filename="q3_financials.pdf", file_type="pdf", size=2048, file_path="/tmp/doc_1"
    )
    mock_doc_repo.get_document_by_id.return_value = mock_doc

    # Query vector points along x-axis
    query_vec = [1.0, 0.0, 0.0]

    mock_emb = MagicMock()
    mock_emb.is_healthy.return_value = True
    mock_emb.generate_embedding.return_value = query_vec
    mock_emb.compute_cosine_similarity.side_effect = lambda a, b: EmbeddingService.compute_cosine_similarity(a, b)

    # Chunks with different vectors
    chunk_high = DocumentChunkModel(
        id="c_high",
        document_id="doc_1",
        page_number=3,
        chunk_index=0,
        text="Total revenue grew 15% to $42.5 billion.",
        embedding=[0.99, 0.1, 0.0],
    )
    chunk_med = DocumentChunkModel(
        id="c_med",
        document_id="doc_1",
        page_number=4,
        chunk_index=1,
        text="Cash flow from operations was $12.1 billion.",
        embedding=[0.6, 0.8, 0.0],
    )
    chunk_low = DocumentChunkModel(
        id="c_low",
        document_id="doc_1",
        page_number=12,
        chunk_index=2,
        text="Headcount increased by 1,200 employees.",
        embedding=[0.0, 1.0, 0.0],
    )

    mock_chunk_repo = AsyncMock()
    mock_chunk_repo.collection = None
    mock_chunk_repo.get_chunks_by_document.return_value = [chunk_low, chunk_high, chunk_med]

    service = RetrievalService(
        embedding_service=mock_emb,
        chunk_repository=mock_chunk_repo,
        document_repository=mock_doc_repo,
    )

    # Retrieve top 2
    results = await service.retrieve_evidence(
        query="What was total revenue?",
        document_id="doc_1",
        top_k=2,
    )

    assert len(results) == 2
    # First ranked chunk should be chunk_high
    assert results[0].chunk_id == "c_high"
    assert results[0].page_number == 3
    assert results[0].source_filename == "q3_financials.pdf"
    assert results[0].retrieval_score > results[1].retrieval_score

    # Second ranked chunk should be chunk_med
    assert results[1].chunk_id == "c_med"
    assert results[1].page_number == 4


# ── API Endpoint HTTP Tests ──────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_api_retrieve_evidence_endpoint():
    from app.api.evidence import get_retrieval_service

    mock_evidence = [
        EvidenceChunkResponse(
            document_id="doc_99",
            source_filename="10k_report.pdf",
            page_number=5,
            chunk_id="doc_99_p5_c0",
            chunk_text="EBITDA margin reached 28.4%.",
            retrieval_score=0.9234,
        )
    ]

    mock_svc = AsyncMock()
    mock_svc.retrieve_evidence.return_value = mock_evidence

    app.dependency_overrides[get_retrieval_service] = lambda: mock_svc
    try:
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            payload = {
                "query": "What was the EBITDA margin?",
                "document_id": "doc_99",
                "top_k": 3,
            }
            response = await client.post("/api/evidence/retrieve", json=payload)

        assert response.status_code == 200
        data = response.json()
        assert data["query"] == "What was the EBITDA margin?"
        assert data["total_retrieved"] == 1
        assert data["evidence"][0]["chunk_id"] == "doc_99_p5_c0"
        assert data["evidence"][0]["source_filename"] == "10k_report.pdf"
        assert data["evidence"][0]["page_number"] == 5
        assert data["evidence"][0]["retrieval_score"] == 0.9234
    finally:
        app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_api_retrieve_empty_query_rejected():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.post("/api/evidence/retrieve", json={"query": ""})
    assert response.status_code in [400, 422]

