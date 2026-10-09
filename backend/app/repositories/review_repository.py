"""
Review repository for MongoDB persistence of human-in-the-loop review items.
"""

from __future__ import annotations

from typing import List, Optional
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.database.mongodb import get_database
from app.models.review import ReviewItem


class ReviewRepository:
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
        return self.db.review_items

    async def create_review_item(self, item: ReviewItem) -> str:
        """Stores a new review queue item."""
        doc = item.model_dump()
        await self.collection.insert_one(doc)
        return item.id

    async def get_review_by_id(self, item_id: str) -> Optional[ReviewItem]:
        """Retrieves a review item by its ID."""
        doc = await self.collection.find_one({"id": item_id})
        if not doc:
            return None
        doc.pop("_id", None)
        return ReviewItem.model_validate(doc)

    async def get_pending_reviews(
        self,
        document_id: Optional[str] = None,
        user_id: Optional[str] = None,
    ) -> List[ReviewItem]:
        """Retrieves pending review items filtered by user_id or document_id."""
        query: dict = {"status": "pending"}
        if document_id:
            query["document_id"] = document_id
        if user_id:
            query["user_id"] = user_id

        cursor = self.collection.find(query).sort("created_at", -1)
        items: List[ReviewItem] = []
        async for doc in cursor:
            doc.pop("_id", None)
            items.append(ReviewItem.model_validate(doc))
        return items

    async def update_review(self, item: ReviewItem) -> bool:
        """Updates a review item with reviewer decision and audit trail."""
        result = await self.collection.replace_one(
            {"id": item.id},
            item.model_dump(),
        )
        return result.modified_count > 0
