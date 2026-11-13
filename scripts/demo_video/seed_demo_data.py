"""Seed a demo account and about 35 days of generated sample verifications for the Analytics page.

For demos and screenshots only. Run it from backend/ against the local fallback database: set MONGODB_URI to an unreachable
local address first (see README.md in this folder). It refuses to run otherwise, so it cannot write sample data to a real database.
"""
import os
import sys

if not any(h in os.environ.get("MONGODB_URI", "") for h in ("127.0.0.1", "localhost")):
    sys.exit("Refusing to seed: set MONGODB_URI to an unreachable local address (for example mongodb://127.0.0.1:1) so the local fallback store is used.")
import asyncio
import random
import uuid
from datetime import datetime, timedelta, timezone

from app.api import auth as auth_api
from app.models.claim import ClaimModel
from app.models.document import DocumentModel
from app.models.verification import VerificationSessionModel
from app.repositories.document_repository import DocumentRepository
from app.repositories.verification_repository import VerificationRepository

random.seed(7)
TENANT = "demo-tenant"
DOCS = {"acme-annual-2025.pdf": 0.35, "q3-earnings-call.pdf": 0.2, "risk-disclosures.pdf": 0.1, "a-very-long-supplier-contract-agreement-final-v7.pdf": 0.5}
TYPES = ["numerical", "factual", "temporal", "comparative"]
HTYPES = ["NUMERICAL_MISMATCH", "UNSUPPORTED_FABRICATION", "ENTITY_SWAP", "TEMPORAL_ERROR"]
RULES = ["nli", "table_mismatch", "lexical_overlap", "numeric_check"]
TEXTS = ["Revenue grew 12% year over year to $4.2 billion.", "The company opened 14 new offices in Europe during Q3.",
         "Net income fell to $310 million, down from $420 million.", "Management expects margins to expand by 300 basis points next year."]


async def main():
    await auth_api._new_user(os.environ["VERIFIN_DEMO_EMAIL"], os.environ["VERIFIN_DEMO_PASSWORD"], "Demo", TENANT, "admin", email_verified=True)
    docs = DocumentRepository()
    repo = VerificationRepository()
    ids = {}
    for name in DOCS:
        d = DocumentModel(id=str(uuid.uuid4()), tenant_id=TENANT, filename=name, size=1, file_path="x")
        await docs.create_document(d)
        ids[name] = d.id
    now = datetime.now(timezone.utc)
    for day in range(34, -1, -1):
        for _ in range(random.choice([0, 1, 1, 2, 3])):
            name = random.choice(list(DOCS))
            rate = DOCS[name] * (1.3 if day < 10 else 0.8)
            sid = str(uuid.uuid4())
            claims = []
            for i in range(random.randint(3, 9)):
                r = random.random()
                status = "CONTRADICTED" if r < rate * 0.5 else "UNVERIFIED" if r < rate else "SUPPORTED"
                bad = status != "SUPPORTED"
                claims.append(ClaimModel(id=f"{sid}-{i}", session_id=sid, claim_text=random.choice(TEXTS), claim_type=random.choice(TYPES), status=status,
                                         hallucination_type=random.choice(HTYPES) if bad else "NONE",
                                         hallucination_risk_score=round(random.uniform(0.3, 0.99), 2) if bad else 0.05, decided_by=random.choice(RULES)))
            supported = sum(c.status == "SUPPORTED" for c in claims)
            score = round(100 * supported / len(claims), 1)
            risk = "LOW" if score >= 80 else "MEDIUM" if score >= 50 else "HIGH"
            await repo.create_session(VerificationSessionModel(id=sid, tenant_id=TENANT, document_id=ids[name], llm_output="x", status="completed",
                                                              overall_score=score, risk_level=risk,
                                                              created_at=now - timedelta(days=day, hours=random.randint(1, 20))))
            await repo.save_claims(claims)
    print("seeded")


asyncio.run(main())
