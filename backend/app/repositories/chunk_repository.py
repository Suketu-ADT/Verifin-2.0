"""
Chunk repository for MongoDB interactions with the document_chunks collection.
"""

from typing import List, Optional
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.database.mongodb import get_database
from app.models.chunk import DocumentChunkModel
from app.utils.logging import logger


class ChunkRepository:
    def __init__(self, db: Optional[AsyncIOMotorDatabase] = None):
        self._db = db

    @property
    def db(self) -> AsyncIOMotorDatabase:
        database = self._db or get_database()
        if database is None:
            raise ConnectionError("MongoDB is currently unavailable.")
        return database

    @property
    def collection(self):
        return self.db.document_chunks

    async def create_chunks(self, chunks: List[DocumentChunkModel]) -> int:
        """Stores a batch of document chunks in MongoDB."""
        if not chunks:
            return 0
        docs_dicts = [chunk.model_dump() for chunk in chunks]
        result = await self.collection.insert_many(docs_dicts)
        return len(result.inserted_ids)

    async def get_chunks_by_document(
        self, document_id: str
    ) -> List[DocumentChunkModel]:
        """Retrieves all chunks for a specific document, ordered by chunk_index."""
        cursor = self.collection.find({"document_id": document_id}).sort("chunk_index", 1)
        results: List[DocumentChunkModel] = []
        async for item in cursor:
            item.pop("_id", None)
            results.append(DocumentChunkModel.model_validate(item))
        return results

    async def delete_chunks_by_document(self, document_id: str) -> int:
        """Deletes all chunks associated with a document ID."""
        result = await self.collection.delete_many({"document_id": document_id})
        return result.deleted_count

    async def count_chunks_by_document(self, document_id: str) -> int:
        """Returns the count of chunks for a given document ID."""
        return await self.collection.count_documents({"document_id": document_id})

    async def get_all_chunks(self, limit: int = 1000) -> List[DocumentChunkModel]:
        """Retrieves chunks across documents up to a limit."""
        cursor = self.collection.find().limit(limit)
        results: List[DocumentChunkModel] = []
        async for item in cursor:
            item.pop("_id", None)
            results.append(DocumentChunkModel.model_validate(item))
        return results
