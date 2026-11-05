"""
Storage for pending email sign-in codes: one document per address, so asking for a new code replaces the old one.
"""

from datetime import datetime, timezone
from typing import Optional

from app.database.mongodb import get_database


class OtpRepository:
    def __init__(self, db=None):
        self._db = db

    @property
    def collection(self):
        database = self._db if self._db is not None else get_database()
        if database is None:
            raise ConnectionError("MongoDB is currently unavailable.")
        return database.otp_challenges

    async def save(self, email: str, code_hash: str, expires_at: datetime) -> None:
        """Replace any pending code for the address; the guess counter starts again."""
        await self.collection.replace_one(
            {"email": email},
            {"email": email, "code_hash": code_hash, "expires_at": expires_at, "attempts": 0,
             "created_at": datetime.now(timezone.utc)},
            upsert=True,
        )

    async def get(self, email: str) -> Optional[dict]:
        raw = await self.collection.find_one({"email": email})
        if raw:
            raw.pop("_id", None)
        return raw or None

    async def record_failure(self, email: str) -> int:
        """Count a wrong guess and return the new total."""
        await self.collection.update_one({"email": email}, {"$inc": {"attempts": 1}})
        raw = await self.get(email)
        return int(raw["attempts"]) if raw else 0

    async def delete(self, email: str) -> None:
        await self.collection.delete_one({"email": email})
