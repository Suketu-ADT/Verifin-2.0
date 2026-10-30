"""
Evaluation corpus: loads the report manifest, extracts page text, chunks it with
the same ChunkingService used in production and caches the result (including
dense embeddings) so repeated evaluation runs are fast and deterministic.
"""

from __future__ import annotations

import json
import logging
import pickle
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, List

from pypdf import PdfReader

from app.config import settings
from app.models.chunk import DocumentChunkModel
from app.services.chunking_service import ChunkingService
from app.services.embedding_service import get_embedding_service

logging.getLogger("pypdf").setLevel(logging.ERROR)

REPORTS_DIR = settings.data_dir / "reports"
MANIFEST_PATH = REPORTS_DIR / "manifest.json"
CACHE_DIR = settings.data_dir / "eval" / "cache"


@dataclass
class CorpusDoc:
    doc_key: str
    meta: dict
    pages: List[str]
    chunks: List[DocumentChunkModel] = field(default_factory=list)

    @property
    def full_text(self) -> str:
        return "\n".join(self.pages)


def load_manifest() -> List[dict]:
    return json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))["documents"]


def _cache_path(doc_key: str) -> Path:
    return CACHE_DIR / f"{doc_key}.pkl"


def ingest(meta: dict, force: bool = False) -> CorpusDoc:
    """Extract, chunk and embed one report (cached on disk)."""
    cache = _cache_path(meta["doc_key"])
    if cache.exists() and not force:
        with open(cache, "rb") as f:
            payload = pickle.load(f)
        chunks = [DocumentChunkModel.model_validate(c) for c in payload["chunks"]]
        return CorpusDoc(meta["doc_key"], meta, payload["pages"], chunks)

    start = time.time()
    reader = PdfReader(str(REPORTS_DIR / meta["file"]))
    pages: List[str] = []
    for page in reader.pages:
        try:
            pages.append(page.extract_text() or "")
        except Exception:
            pages.append("")
    print(f"[{meta['doc_key']}] extracted {len(pages)} pages in {time.time() - start:.0f}s", flush=True)

    # Same splitting logic and id format as ChunkingService.extract_chunks_from_pdf_bytes
    # (OCR is skipped: no scanned-page handling is evaluated here).
    chunker = ChunkingService()
    raw: List[dict] = []
    chunk_idx = 0
    for page_idx, text in enumerate(pages):
        for piece in chunker.split_text_into_chunks(text):
            raw.append({
                "id": f"{meta['doc_key']}_p{page_idx + 1}_c{chunk_idx}",
                "document_id": meta["doc_key"],
                "page_number": page_idx + 1,
                "chunk_index": chunk_idx,
                "text": piece,
                "char_count": len(piece),
            })
            chunk_idx += 1

    embedder = get_embedding_service()
    embeddings = embedder.generate_embeddings([r["text"] for r in raw])
    chunks = [
        DocumentChunkModel(embedding=emb, **r) for r, emb in zip(raw, embeddings)
    ]
    print(f"[{meta['doc_key']}] {len(chunks)} chunks embedded in {time.time() - start:.0f}s total", flush=True)

    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    with open(cache, "wb") as f:
        pickle.dump({"pages": pages, "chunks": [c.model_dump() for c in chunks]}, f)
    return CorpusDoc(meta["doc_key"], meta, pages, chunks)


def load_corpus(force: bool = False) -> Dict[str, CorpusDoc]:
    return {m["doc_key"]: ingest(m, force=force) for m in load_manifest()}


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Ingest and cache the evaluation corpus.")
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()
    corpus = load_corpus(force=args.force)
    for key, doc in corpus.items():
        empty = sum(1 for p in doc.pages if len(p.strip()) < 40)
        print(f"{key}: pages={len(doc.pages)} chunks={len(doc.chunks)} near-empty pages={empty}")
