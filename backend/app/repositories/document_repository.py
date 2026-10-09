"""
Document repository for MongoDB interactions with the documents collection.
"""

from typing import List, Optional
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.database.mongodb import get_database
from app.models.document import DocumentModel
from app.utils.logging import logger


class DocumentRepository:
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
        return self.db.documents

    async def create_document(self, doc: DocumentModel) -> DocumentModel:
        """Stores a new document record in MongoDB."""
        doc_dict = doc.model_dump()
        await self.collection.insert_one(doc_dict)
        return doc

    async def get_document_by_id(self, doc_id: str) -> Optional[DocumentModel]:
        """Retrieves document metadata by unique document string ID."""
        raw = await self.collection.find_one({"id": doc_id})
        if not raw:
            return None
        raw.pop("_id", None)
        return DocumentModel.model_validate(raw)

    async def list_documents(
        self, user_id: Optional[str] = None, limit: int = 50
    ) -> List[DocumentModel]:
        """Lists recent documents, optionally filtered by user_id."""
        query = {}
        if user_id:
            query["user_id"] = user_id
        cursor = self.collection.find(query).sort("created_at", -1).limit(limit)
        results: List[DocumentModel] = []
        async for item in cursor:
            item.pop("_id", None)
            results.append(DocumentModel.model_validate(item))
        return results
