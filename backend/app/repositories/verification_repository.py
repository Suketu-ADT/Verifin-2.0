"""
Verification repository for MongoDB interactions with verification_sessions and claims.
"""

from datetime import datetime, timezone
from typing import List, Optional
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.database.mongodb import get_database
from app.models.verification import VerificationSessionModel
from app.models.claim import ClaimModel


class VerificationRepository:
    def __init__(self, db: Optional[AsyncIOMotorDatabase] = None):
        self._db = db

    @property
    def db(self) -> AsyncIOMotorDatabase:
        database = self._db or get_database()
        if database is None:
            raise ConnectionError("MongoDB is currently unavailable.")
        return database

    @property
    def sessions_collection(self):
        return self.db.verification_sessions

    @property
    def claims_collection(self):
        return self.db.claims

    async def create_session(
        self, session: VerificationSessionModel
    ) -> VerificationSessionModel:
        """Stores a new verification session in MongoDB."""
        sess_dict = session.model_dump()
        await self.sessions_collection.insert_one(sess_dict)
        return session

    async def update_session(self, session: VerificationSessionModel) -> None:
        """Replaces a stored session (used when a queued job finishes)."""
        await self.sessions_collection.replace_one({"id": session.id}, session.model_dump(), upsert=True)

    async def set_status(self, session_id: str, status: str, error: Optional[str] = None) -> None:
        await self.sessions_collection.update_one(
            {"id": session_id},
            {"$set": {"status": status, "error": error, "updated_at": datetime.now(timezone.utc)}},
        )

    async def fail_unfinished(self, reason: str) -> int:
        """Marks queued/running sessions as failed. Called at startup: their worker died with the old process."""
        result = await self.sessions_collection.update_many(
            {"status": {"$in": ["queued", "running"]}},
            {"$set": {"status": "failed", "error": reason, "updated_at": datetime.now(timezone.utc)}},
        )
        return int(result.modified_count)

    async def get_session_by_id(
        self, session_id: str
    ) -> Optional[VerificationSessionModel]:
        """Retrieves a verification session by session ID."""
        raw = await self.sessions_collection.find_one({"id": session_id})
        if not raw:
            return None
        raw.pop("_id", None)
        return VerificationSessionModel.model_validate(raw)

    async def save_claims(self, claims: List[ClaimModel]) -> List[ClaimModel]:
        """Bulk inserts claim records for a session."""
        if not claims:
            return []
        claim_dicts = [c.model_dump() for c in claims]
        await self.claims_collection.insert_many(claim_dicts)
        return claims

    async def get_claims_by_session_id(self, session_id: str) -> List[ClaimModel]:
        """Retrieves all claims associated with a given verification session."""
        cursor = self.claims_collection.find({"session_id": session_id})
        results: List[ClaimModel] = []
        async for item in cursor:
            item.pop("_id", None)
            results.append(ClaimModel.model_validate(item))
        return results
