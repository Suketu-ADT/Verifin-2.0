from typing import Optional

from app.database.mongodb import get_database
from app.models.batch import BatchModel


class BatchRepository:
    @property
    def collection(self):
        database = get_database()
        if database is None:
            raise ConnectionError("MongoDB is currently unavailable.")
        return database.verification_batches

    async def create(self, batch: BatchModel) -> BatchModel:
        await self.collection.insert_one(batch.model_dump())
        return batch

    async def get(self, batch_id: str) -> Optional[BatchModel]:
        raw = await self.collection.find_one({"id": batch_id})
        if not raw:
            return None
        raw.pop("_id", None)
        return BatchModel.model_validate(raw)
