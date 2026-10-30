"""Audit event storage. Append and read only: there is deliberately no update or delete."""

from typing import List, Optional

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.database.mongodb import get_database
from app.models.audit import AuditEventModel


class AuditRepository:
    def __init__(self, db: Optional[AsyncIOMotorDatabase] = None):
        self._db = db

    @property
    def collection(self):
        database = self._db or get_database()
        if database is None:
            raise ConnectionError("MongoDB is currently unavailable.")
        return database.audit_events

    async def last_event(self, tenant_id: str) -> Optional[AuditEventModel]:
        rows = await self.collection.find({"tenant_id": tenant_id}).sort("seq", -1).limit(1).to_list(1)
        return self._model(rows[0]) if rows else None

    async def append(self, event: AuditEventModel) -> None:
        await self.collection.insert_one(event.model_dump())

    async def list_events(
        self,
        tenant_id: str,
        action: Optional[str] = None,
        actor_id: Optional[str] = None,
        resource_id: Optional[str] = None,
        limit: int = 100,
        before_seq: Optional[int] = None,
    ) -> List[AuditEventModel]:
        """Newest first. ``before_seq`` pages backwards."""
        query = {"tenant_id": tenant_id}
        for key, value in (("action", action), ("actor_id", actor_id), ("resource_id", resource_id)):
            if value:
                query[key] = value
        rows = await self.collection.find(query).sort("seq", -1).to_list(None)
        events = [self._model(r) for r in rows]
        if before_seq is not None:
            events = [e for e in events if e.seq < before_seq]
        return events[:limit]

    async def all_in_order(self, tenant_id: str) -> List[AuditEventModel]:
        rows = await self.collection.find({"tenant_id": tenant_id}).sort("seq", 1).to_list(None)
        return [self._model(r) for r in rows]

    @staticmethod
    def _model(raw: dict) -> AuditEventModel:
        raw = dict(raw)
        raw.pop("_id", None)
        return AuditEventModel.model_validate(raw)
