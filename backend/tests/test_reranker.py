"""Optional cross-encoder reranking of retrieval candidates."""

import pytest

from app.config import settings
from app.models.chunk import DocumentChunkModel
from app.services import retrieval_service
from app.services.bm25_service import BM25Service
from app.services.retrieval_service import RetrievalService


class _Docs:
    async def get_document_by_id(self, doc_id):
        return type("Doc", (), {"id": doc_id, "filename": "report.pdf"})()


class _Chunks:
    def __init__(self, chunks):
        self.chunks = chunks

    async def get_chunks_by_document(self, doc_id):
        return self.chunks


class _FakeReranker:
    """Prefers the passage that mentions a dividend, whatever the first stage ranked first."""

    def score(self, query, passages):
        return [0.9 if "dividend" in p else 0.1 for p in passages]


def _service():
    texts = [
        "Revenue per share grew strongly during the year across all segments of the business.",
        "Revenue per share and profit were discussed by the board in its revenue review.",
        "The board declared a dividend per share for the year.",
    ]
    chunks = [
        DocumentChunkModel(id=f"c{i}", document_id="d1", page_number=i + 1, chunk_index=i, text=t)
        for i, t in enumerate(texts)
    ]
    return RetrievalService(
        embedding_service=object(),
        chunk_repository=_Chunks(chunks),
        document_repository=_Docs(),
        bm25_service=BM25Service(),
    )


@pytest.mark.asyncio
async def test_reranker_reorders_first_stage_candidates(monkeypatch):
    monkeypatch.setattr(settings, "reranker_enabled", True)
    monkeypatch.setattr(settings, "reranker_candidates", 3)
    monkeypatch.setattr(retrieval_service, "get_reranker_service", lambda: _FakeReranker())

    results = await _service().retrieve_evidence("revenue per share", document_id="d1", top_k=1, mode="bm25")

    assert len(results) == 1
    assert "dividend" in results[0].chunk_text
    assert results[0].retrieval_method.endswith("+rerank")


@pytest.mark.asyncio
async def test_reranker_is_off_by_default(monkeypatch):
    monkeypatch.setattr(settings, "reranker_enabled", False)

    def _must_not_load():
        raise AssertionError("reranker should not be loaded when disabled")

    monkeypatch.setattr(retrieval_service, "get_reranker_service", _must_not_load)
    results = await _service().retrieve_evidence("revenue per share", document_id="d1", top_k=2, mode="bm25")

    assert len(results) == 2
    assert all(not r.retrieval_method.endswith("+rerank") for r in results)
