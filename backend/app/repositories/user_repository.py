"""
User repository for MongoDB interactions with the users collection.
"""

from typing import Optional
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.database.mongodb import get_database
from app.models.user import UserModel


class UserRepository:
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
        """Retrieves a user by unique email."""
        raw = await self.collection.find_one({"email": email})
        if not raw:
            return None
        raw.pop("_id", None)
        return UserModel.model_validate(raw)
