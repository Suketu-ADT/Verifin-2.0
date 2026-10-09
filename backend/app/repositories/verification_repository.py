"""
Verification repository for MongoDB interactions with verification_sessions and claims.
"""

from typing import List, Optional
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.database.mongodb import get_database
from app.models.verification import VerificationSessionModel
from app.models.claim import ClaimModel
from app.utils.logging import logger


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
