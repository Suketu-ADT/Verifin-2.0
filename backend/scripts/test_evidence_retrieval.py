"""
Reproducible demonstration script for Evidence Retrieval against financial document passages.
Executes real sentence embedding inference using sentence-transformers/all-MiniLM-L6-v2
and verifies top-K cosine similarity ranking.
"""

import sys
import os
from pathlib import Path

# Add backend directory to sys.path so app modules import cleanly
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.services.embedding_service import EmbeddingService
from app.models.chunk import DocumentChunkModel


def run_evidence_retrieval_demo():
    print("=" * 80)
    print("VERIFIN 2.0 — Phase 2 Evidence Retrieval & Embeddings Demonstration")
    print("=" * 80)

    # 1. Initialize EmbeddingService
    print("\n[1] Initializing Sentence Transformer embedding service...")
    service = EmbeddingService()
    if not service.is_healthy():
        print(f"ERROR: Embedding service is not healthy. Status: {service.status}")
        return 1

    print(f"    Model Name: {service.model_name}")
    print(f"    Vector Dimension: {service.dimension}")
    print(f"    Service Status: {service.status}")

    # 2. Define financial test passages
    financial_passages = [
        {
            "id": "chunk_rev_01",
            "page": 14,
            "text": (
                "In fiscal year 2024, Alphabet reported consolidated revenues of $350.0 billion, "
                "reflecting an increase of 14% year-over-year compared to $307.4 billion in fiscal year 2023."
            ),
            "topic": "Revenue",
        },
        {
            "id": "chunk_opinc_02",
            "page": 18,
            "text": (
                "Operating income for the Google Services segment was $105.2 billion, "
                "representing an operating margin of 35.8% compared to 31.9% in the prior year."
            ),
            "topic": "Operating Income / Margin",
        },
        {
            "id": "chunk_capex_03",
            "page": 24,
            "text": (
                "Capital expenditures for the fourth quarter reached $13.1 billion, driven primarily "
                "by investments in technical infrastructure including servers, data centers, and AI hardware."
            ),
            "topic": "CapEx & Infrastructure",
        },
        {
            "id": "chunk_buyback_04",
            "page": 31,
            "text": (
                "The company repurchased and retired $62.2 billion of Class A and Class C shares "
                "during the twelve months ended December 31, 2024 under its share repurchase authorization."
            ),
            "topic": "Share Buybacks",
        },
        {
            "id": "chunk_fcf_05",
            "page": 35,
            "text": (
                "Free cash flow generated during the year was $72.8 billion, representing a robust cash "
                "conversion rate from net operating cash flow of $108.5 billion."
            ),
            "topic": "Free Cash Flow",
        },
    ]

    print(f"\n[2] Embedding {len(financial_passages)} financial report passages...")
    passage_texts = [p["text"] for p in financial_passages]
    embeddings = service.generate_embeddings(passage_texts)

    chunks: list[DocumentChunkModel] = []
    for i, p in enumerate(financial_passages):
        chunk = DocumentChunkModel(
            id=p["id"],
            document_id="alphabet_10k_2024",
            page_number=p["page"],
            chunk_index=i,
            text=p["text"],
            embedding=embeddings[i],
            char_count=len(p["text"]),
        )
        chunks.append(chunk)
        print(f"    Chunk {chunk.id} (Page {chunk.page_number}): {len(chunk.embedding)} dimensions embedded.")

    # 3. Test claims / queries
    test_cases = [
        {
            "query": "Alphabet total annual revenue in 2024 was 350 billion dollars.",
            "expected_top_chunk": "chunk_rev_01",
        },
        {
            "query": "How much was spent on capital expenditures, servers, and AI data centers?",
            "expected_top_chunk": "chunk_capex_03",
        },
        {
            "query": "Google Services operating profit margin and segment income.",
            "expected_top_chunk": "chunk_opinc_02",
        },
        {
            "query": "Share repurchase program and stock buybacks in 2024.",
            "expected_top_chunk": "chunk_buyback_04",
        },
        {
            "query": "Operating cash flows and free cash flow generation.",
            "expected_top_chunk": "chunk_fcf_05",
        },
    ]

    print("\n[3] Running top-K retrieval tests across financial claims...")
    print("-" * 80)

    all_passed = True
    for idx, tc in enumerate(test_cases, 1):
        query = tc["query"]
        expected = tc["expected_top_chunk"]

        query_emb = service.generate_embedding(query)

        # Rank by cosine similarity
        ranked: list[tuple[DocumentChunkModel, float]] = []
        for c in chunks:
            sim = service.compute_cosine_similarity(query_emb, c.embedding)
            ranked.append((c, sim))

        ranked.sort(key=lambda x: x[1], reverse=True)
        top_result, top_score = ranked[0]

        is_match = top_result.id == expected
        status_tag = "PASS" if is_match else "FAIL"
        if not is_match:
            all_passed = False

        print(f"Test {idx} [{status_tag}]:")
        print(f"  Claim Query: \"{query}\"")
        print(f"  Top Match ID: {top_result.id} (Page {top_result.page_number}) | Score: {top_score:.4f}")
        print(f"  Snippet: \"{top_result.text[:90]}...\"")
        print(f"  Expected ID: {expected} | Actual Top ID: {top_result.id}")
        print("-" * 80)

    if all_passed:
        print("\nAll 5 financial claim retrieval tests passed with top-1 precision!")
        return 0
    else:
        print("\nOne or more retrieval test cases failed.")
        return 1


if __name__ == "__main__":
    exit_code = run_evidence_retrieval_demo()
    sys.exit(exit_code)
