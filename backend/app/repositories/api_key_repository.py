"""Repository for API keys (hash only; the plaintext key is shown once at creation)."""

from datetime import datetime, timezone
from typing import List, Optional
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.database.mongodb import get_database
from app.models.api_key import ApiKeyModel


class ApiKeyRepository:
    def __init__(self, db: Optional[AsyncIOMotorDatabase] = None):
        self._db = db

    @property
    def collection(self):
        database = self._db if self._db is not None else get_database()
        if database is None:
            raise ConnectionError("MongoDB is currently unavailable.")
        return database.api_keys

    async def create(self, key: ApiKeyModel) -> ApiKeyModel:
        await self.collection.insert_one(key.model_dump())
        return key

    async def get_by_hash(self, key_hash: str) -> Optional[ApiKeyModel]:
        raw = await self.collection.find_one({"key_hash": key_hash})
        if not raw:
            return None
        raw.pop("_id", None)
        return ApiKeyModel.model_validate(raw)

    async def get(self, key_id: str) -> Optional[ApiKeyModel]:
        raw = await self.collection.find_one({"id": key_id})
        if not raw:
            return None
        raw.pop("_id", None)
        return ApiKeyModel.model_validate(raw)

    async def list_for_tenant(self, tenant_id: str, user_id: Optional[str] = None) -> List[ApiKeyModel]:
        query = {"tenant_id": tenant_id}
        if user_id:
            query["user_id"] = user_id
        out: List[ApiKeyModel] = []
        async for raw in self.collection.find(query).sort("created_at", -1).limit(200):
            raw.pop("_id", None)
            out.append(ApiKeyModel.model_validate(raw))
        return out

    async def revoke(self, key_id: str) -> None:
        await self.collection.update_one({"id": key_id}, {"$set": {"is_active": False}})

    async def touch(self, key_id: str) -> None:
        await self.collection.update_one({"id": key_id}, {"$set": {"last_used_at": datetime.now(timezone.utc)}})
