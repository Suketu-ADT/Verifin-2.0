"""
Centralized MongoDB connection management using Motor (async driver).
"""

from typing import Optional
import certifi
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from app.config import settings
from app.utils.logging import logger
from app.database.indexes import ensure_indexes

class MongoDBManager:
    client: Optional[AsyncIOMotorClient] = None
    database: Optional[AsyncIOMotorDatabase] = None

manager = MongoDBManager()


async def connect_to_mongo() -> None:
    """
    Connect to MongoDB on startup. Gracefully handles connection failures
    so the application can start even if MongoDB is not immediately reachable.
    """
    logger.info("Initializing MongoDB connection...")
    try:
        client_kwargs = {
            "serverSelectionTimeoutMS": settings.mongodb_server_selection_timeout_ms,
            "connectTimeoutMS": settings.mongodb_connect_timeout_ms,
        }
        
        # Configure trusted root CA bundle for TLS / Atlas clusters
        uri = settings.mongodb_uri.lower()
        if uri.startswith("mongodb+srv://") or "tls=true" in uri or "ssl=true" in uri:
            client_kwargs["tlsCAFile"] = certifi.where()

        manager.client = AsyncIOMotorClient(
            settings.mongodb_uri,
            **client_kwargs,
        )
        manager.database = manager.client[settings.mongodb_database]
        
        # Test connection with a quick ping
        await manager.client.admin.command("ping")
        logger.info(f"Successfully connected to MongoDB database: {settings.mongodb_database}")
        
        # Ensure indexes on startup
        await ensure_indexes(manager.database)
    except Exception as exc:
        err_msg = str(exc)
        if "TLSV1_ALERT_INTERNAL_ERROR" in err_msg or "tlsv1 alert internal error" in err_msg:
            logger.warning(
                "MongoDB TLS handshake rejected by remote server. "
                "Ensure your current public IP is whitelisted in MongoDB Atlas Network Access and the cluster is not paused."
            )
        else:
            logger.warning(
                f"MongoDB connection failed during startup (system will report database as unhealthy): {type(exc).__name__}: {err_msg[:200]}"
            )


async def close_mongo_connection() -> None:
    """Closes MongoDB connection on shutdown."""
    if manager.client is not None:
        logger.info("Closing MongoDB client...")
        manager.client.close()
        manager.client = None
        manager.database = None
        logger.info("MongoDB client closed.")


async def ping_database(timeout_seconds: float = 2.0) -> bool:
    """
    Checks if MongoDB is reachable.
    Returns True if healthy, False otherwise.
    Uses a bounded timeout to prevent health-check latency during outages.
    """
    if manager.client is None:
        return False
    try:
        import asyncio
        await asyncio.wait_for(
            manager.client.admin.command("ping"),
            timeout=timeout_seconds,
        )
        return True
    except Exception:
        return False


def get_database() -> Optional[AsyncIOMotorDatabase]:
    """Dependency / accessor to retrieve current active MongoDB database."""
    return manager.database
