"""
Database package for VERIFIN 2.0.
"""

from app.database.mongodb import get_database, ping_database

__all__ = ["get_database", "ping_database"]
