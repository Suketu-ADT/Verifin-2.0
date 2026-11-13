"""The in-memory fallback database sorts timestamps whether they are datetimes or the strings a reloaded store holds."""

from datetime import datetime, timezone

from app.database.fallback_db import FallbackCursor


def _ids(docs, direction):
    return [d["id"] for d in FallbackCursor(docs).sort("created_at", direction)._execute()]


def test_sorts_datetimes_together_with_strings_from_a_reloaded_store():
    docs = [
        {"id": "old", "created_at": "2026-11-01 09:00:00+00:00"},  # what json.dump(default=str) writes
        {"id": "new", "created_at": datetime(2026, 11, 13, 9, 0, tzinfo=timezone.utc)},
        {"id": "mid", "created_at": "2026-11-10T09:00:00+00:00"},
        {"id": "naive", "created_at": datetime(2026, 11, 12, 9, 0)},
    ]
    assert _ids(docs, -1) == ["new", "naive", "mid", "old"]
    assert _ids(docs, 1) == ["old", "mid", "naive", "new"]


def test_missing_values_and_mixed_kinds_do_not_raise():
    docs = [{"id": "a", "created_at": None}, {"id": "b"}, {"id": "c", "created_at": 5}, {"id": "d", "created_at": "text"}]
    assert sorted(_ids(docs, 1)) == ["a", "b", "c", "d"]
