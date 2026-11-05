"""
User repository for MongoDB interactions with the users collection.
"""

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.database.mongodb import get_database
from app.models.user import UserModel


class UserRepository:
    def __init__(self, db: Optional[AsyncIOMotorDatabase] = None):
        self._db = db

    @property
    def db(self) -> AsyncIOMotorDatabase:
        database = self._db if self._db is not None else get_database()
        if database is None:
            raise ConnectionError("MongoDB is currently unavailable.")
        return database

    @property
    def collection(self):
        return self.db.users

    async def create_user(self, user: UserModel) -> UserModel:
        """Stores a new user in MongoDB."""
        user_dict = user.model_dump()
        await self.collection.insert_one(user_dict)
        return user

    async def get_user_by_id(self, user_id: str) -> Optional[UserModel]:
        """Retrieves a user by string ID."""
        raw = await self.collection.find_one({"id": user_id})
        if not raw:
            return None
        raw.pop("_id", None)
        return UserModel.model_validate(raw)

    async def get_user_by_email(self, email: str) -> Optional[UserModel]:
        """Retrieves a user by unique email (case-insensitive: emails are stored lower-case)."""
        raw = await self.collection.find_one({"email": email.strip().lower()})
        if not raw:
            return None
        raw.pop("_id", None)
        return UserModel.model_validate(raw)

    async def list_users_by_tenant(self, tenant_id: str, limit: int = 200) -> List[UserModel]:
        cursor = self.collection.find({"tenant_id": tenant_id}).sort("created_at", -1).limit(limit)
        out: List[UserModel] = []
        async for raw in cursor:
            raw.pop("_id", None)
            out.append(UserModel.model_validate(raw))
        return out

    async def update_user(self, user_id: str, fields: Dict[str, Any]) -> None:
        fields = {**fields, "updated_at": datetime.now(timezone.utc)}
        await self.collection.update_one({"id": user_id}, {"$set": fields})
