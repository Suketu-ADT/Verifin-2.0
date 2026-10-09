"""
Table repository for MongoDB Atlas interactions with the financial_tables collection.
"""

from typing import List, Optional
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.database.mongodb import get_database
from app.models.table import FinancialTableModel
from app.utils.logging import logger


class TableRepository:
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
        return self.db.financial_tables

    async def create_table(self, table: FinancialTableModel) -> FinancialTableModel:
        """Stores a single financial table record in MongoDB."""
        table_dict = table.model_dump()
        await self.collection.insert_one(table_dict)
        return table

    async def create_tables(self, tables: List[FinancialTableModel]) -> int:
        """Bulk inserts financial table records into MongoDB."""
        if not tables:
            return 0
        table_dicts = [t.model_dump() for t in tables]
        result = await self.collection.insert_many(table_dicts)
        return len(result.inserted_ids)

    async def get_tables_by_document_id(self, document_id: str) -> List[FinancialTableModel]:
        """Retrieves all tables extracted from a given document."""
        cursor = self.collection.find({"document_id": document_id}).sort("page_number", 1)
        tables: List[FinancialTableModel] = []
        async for item in cursor:
            item.pop("_id", None)
            tables.append(FinancialTableModel.model_validate(item))
        return tables

    async def get_table_by_id(self, table_id: str) -> Optional[FinancialTableModel]:
        """Retrieves a single table by table ID."""
        raw = await self.collection.find_one({"id": table_id})
        if not raw:
            return None
        raw.pop("_id", None)
        return FinancialTableModel.model_validate(raw)
