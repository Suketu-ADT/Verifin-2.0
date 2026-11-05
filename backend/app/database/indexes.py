"""
MongoDB index configuration and initialization.
"""

from motor.motor_asyncio import AsyncIOMotorDatabase
import pymongo
from app.utils.logging import logger


async def ensure_indexes(db: AsyncIOMotorDatabase) -> None:
    """
    Ensures required indexes exist on collections:
    - users: email, google_id
    - documents: user_id, created_at
    - verification_sessions: user_id, document_id, created_at
    - claims: session_id
    """
    try:
        # Users collection
        await db.users.create_index([("email", pymongo.ASCENDING)], unique=True, sparse=True)
        await db.users.create_index([("google_id", pymongo.ASCENDING)], sparse=True)

        # Pending email sign-in codes: one per address, removed by the database once they expire
        await db.otp_challenges.create_index([("email", pymongo.ASCENDING)], unique=True)
        await db.otp_challenges.create_index([("expires_at", pymongo.ASCENDING)], expireAfterSeconds=0)

        # Documents collection
        await db.documents.create_index([("user_id", pymongo.ASCENDING)])
        await db.documents.create_index([("created_at", pymongo.DESCENDING)])

        # Verification sessions collection
        await db.verification_sessions.create_index([("user_id", pymongo.ASCENDING)])
        await db.verification_sessions.create_index([("document_id", pymongo.ASCENDING)])
        await db.verification_sessions.create_index([("created_at", pymongo.DESCENDING)])

        # Tenant scoping, audit chain integrity, API-key lookup, batches
        await db.documents.create_index([("tenant_id", pymongo.ASCENDING)])
        await db.verification_sessions.create_index([("tenant_id", pymongo.ASCENDING), ("created_at", pymongo.DESCENDING)])
        # unique (tenant, seq): two instances racing to extend the chain cannot both succeed
        await db.audit_events.create_index([("tenant_id", pymongo.ASCENDING), ("seq", pymongo.ASCENDING)], unique=True)
        await db.api_keys.create_index([("key_hash", pymongo.ASCENDING)], unique=True)
        await db.verification_batches.create_index([("tenant_id", pymongo.ASCENDING)])

        # Claims collection
        await db.claims.create_index([("session_id", pymongo.ASCENDING)])

        # Document chunks collection (Phase 2)
        await db.document_chunks.create_index([("document_id", pymongo.ASCENDING)])
        await db.document_chunks.create_index([("document_id", pymongo.ASCENDING), ("chunk_index", pymongo.ASCENDING)])
        await db.document_chunks.create_index([("created_at", pymongo.DESCENDING)])

        logger.info("MongoDB indexes verified/created successfully.")
    except Exception as exc:
        logger.error(f"Failed to ensure MongoDB indexes: {exc}")
