"""
In-memory database fallback implementing the Motor/MongoDB async API.
Ensures VERIFIN 2.0 can process uploads, verifications, and reviews seamlessly
even if MongoDB Atlas is temporarily unreachable (e.g. IP whitelist / network restrictions).
"""

from __future__ import annotations

import copy
import uuid
from typing import Any, Dict, List, Optional


class InsertOneResult:
    def __init__(self, inserted_id: Any):
        self.inserted_id = inserted_id


class InsertManyResult:
    def __init__(self, inserted_ids: List[Any]):
        self.inserted_ids = inserted_ids


class UpdateResult:
    def __init__(self, modified_count: int):
        self.modified_count = modified_count


class DeleteResult:
    def __init__(self, deleted_count: int):
        self.deleted_count = deleted_count


class FallbackCursor:
    def __init__(self, docs: List[Dict[str, Any]]):
        self._docs = docs
        self._sort_key: Optional[str] = None
        self._sort_dir: int = 1
        self._limit: Optional[int] = None

    def sort(self, key_or_list: Any, direction: int = 1) -> "FallbackCursor":
        if isinstance(key_or_list, list):
            if key_or_list:
                self._sort_key, self._sort_dir = key_or_list[0]
        else:
            self._sort_key = key_or_list
            self._sort_dir = direction
        return self

    def limit(self, n: int) -> "FallbackCursor":
        self._limit = n
        return self

    def _execute(self) -> List[Dict[str, Any]]:
        results = [copy.deepcopy(d) for d in self._docs]
        if self._sort_key:
            reverse = self._sort_dir == -1

            def _sort_val(x: Dict[str, Any]) -> Any:
                val = x.get(self._sort_key or "")
                if val is None:
                    return ""
                return val

            results.sort(key=_sort_val, reverse=reverse)
        if self._limit is not None:
            results = results[: self._limit]
        return results

    def __aiter__(self) -> "FallbackCursor":
        self._iter_data = iter(self._execute())
        return self

    async def __anext__(self) -> Dict[str, Any]:
        try:
            return next(self._iter_data)
        except StopIteration:
            raise StopAsyncIteration

    async def to_list(self, length: Optional[int] = None) -> List[Dict[str, Any]]:
        res = self._execute()
        if length is not None:
            return res[:length]
        return res


def _matches_filter(doc: Dict[str, Any], query: Optional[Dict[str, Any]]) -> bool:
    if not query:
        return True
    for k, v in query.items():
        doc_val = doc.get(k)
        if isinstance(v, dict):
            if "$in" in v:
                if doc_val not in v["$in"]:
                    return False
            elif "$eq" in v:
                if doc_val != v["$eq"]:
                    return False
        else:
            if doc_val != v:
                return False
    return True


class FallbackCollection:
    def __init__(self, name: str):
        self.name = name
        self._docs: List[Dict[str, Any]] = []

    async def create_index(self, *args: Any, **kwargs: Any) -> str:
        return f"{self.name}_idx"

    async def insert_one(self, document: Dict[str, Any]) -> InsertOneResult:
        doc = copy.deepcopy(document)
        if "_id" not in doc:
            doc["_id"] = str(uuid.uuid4())
        self._docs.append(doc)
        return InsertOneResult(doc["_id"])

    async def insert_many(self, documents: List[Dict[str, Any]]) -> InsertManyResult:
        ids = []
        for d in documents:
            doc = copy.deepcopy(d)
            if "_id" not in doc:
                doc["_id"] = str(uuid.uuid4())
            self._docs.append(doc)
            ids.append(doc["_id"])
        return InsertManyResult(ids)

    async def find_one(
        self, query: Optional[Dict[str, Any]] = None
    ) -> Optional[Dict[str, Any]]:
        for d in self._docs:
            if _matches_filter(d, query):
                return copy.deepcopy(d)
        return None

    def find(self, query: Optional[Dict[str, Any]] = None) -> FallbackCursor:
        matched = [d for d in self._docs if _matches_filter(d, query)]
        return FallbackCursor(matched)

    async def update_one(
        self, query: Dict[str, Any], update: Dict[str, Any]
    ) -> UpdateResult:
        count = 0
        for d in self._docs:
            if _matches_filter(d, query):
                if "$set" in update:
                    d.update(update["$set"])
                else:
                    d.update(update)
                count += 1
                break
        return UpdateResult(count)

    async def delete_one(self, query: Dict[str, Any]) -> DeleteResult:
        for idx, d in enumerate(self._docs):
            if _matches_filter(d, query):
                self._docs.pop(idx)
                return DeleteResult(1)
        return DeleteResult(0)

    async def delete_many(self, query: Dict[str, Any]) -> DeleteResult:
        initial = len(self._docs)
        self._docs = [d for d in self._docs if not _matches_filter(d, query)]
        return DeleteResult(initial - len(self._docs))

    async def count_documents(self, query: Optional[Dict[str, Any]] = None) -> int:
        return sum(1 for d in self._docs if _matches_filter(d, query))


class FallbackDatabase:
    def __init__(self):
        self._collections: Dict[str, FallbackCollection] = {}

    def __getattr__(self, name: str) -> FallbackCollection:
        if name not in self._collections:
            self._collections[name] = FallbackCollection(name)
        return self._collections[name]

    def __getitem__(self, name: str) -> FallbackCollection:
        return self.__getattr__(name)
