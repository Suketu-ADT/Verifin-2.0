"""A real pymongo Database refuses truth testing; the accessors must not rely on it (this broke sign-up against Atlas)."""

from app.database import mongodb
from app.repositories.user_repository import UserRepository


class _StrictDatabase:
    """Behaves like pymongo's Database: bool() raises, attribute access gives a collection."""

    def __bool__(self):
        raise NotImplementedError("Database objects do not implement truth value testing or bool().")

    def __getattr__(self, name):
        return f"collection:{name}"


def test_get_database_returns_a_real_connection_without_truth_testing(monkeypatch):
    strict = _StrictDatabase()
    monkeypatch.setattr(mongodb.manager, "database", strict)
    assert mongodb.get_database() is strict


def test_repositories_use_an_injected_database_without_truth_testing():
    strict = _StrictDatabase()
    assert UserRepository(strict).collection == "collection:users"


def test_repositories_fall_back_to_the_active_database(monkeypatch):
    strict = _StrictDatabase()
    monkeypatch.setattr(mongodb.manager, "database", strict)
    assert UserRepository().collection == "collection:users"
