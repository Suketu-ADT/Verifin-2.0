"""CSV and PDF export of verification results."""

import csv
import io

import pytest
from httpx import ASGITransport, AsyncClient
from pypdf import PdfReader

from app.config import settings
from app.database import fallback_db, mongodb
from app.main import app
from app.models.claim import ClaimModel, EvidenceModel
from app.models.document import DocumentModel
from app.models.verification import VerificationSessionModel
from app.repositories.document_repository import DocumentRepository
from app.repositories.verification_repository import VerificationRepository
from app.schemas.verification import ClaimResponse, VerificationResultResponse
from app.services.export_service import build_csv, build_pdf, pdf_text, safe_cell

V1 = "/api/v1"


def result_with(*claims):
    return VerificationResultResponse(
        id="sess-12345678", document_id="d1", overall_score=50.0, risk_level="HIGH", status="completed",
        claims=list(claims), provenance={"pipeline_version": "verifin-pipeline/4.0", "models": {"nli": "m"}},
    )


def claim(text, status="SUPPORTED", **kw):
    return ClaimResponse(id="c", claim_text=text, claim_type="numerical", status=status, **kw)


def test_csv_neutralises_spreadsheet_formulas():
    for payload in ('=HYPERLINK("http://evil")', "+1+1", "-2+3", "@SUM(A1)"):
        assert safe_cell(payload).startswith("'")
    assert safe_cell("Revenue grew") == "Revenue grew" and safe_cell(12.5) == 12.5
    rows = list(csv.reader(io.StringIO(build_csv(result_with(claim("=cmd|calc!A0"))))))
    assert rows[1][1].startswith("'=")


def test_csv_has_one_row_per_claim_and_stable_columns():
    rows = list(csv.DictReader(io.StringIO(build_csv(result_with(
        claim("Revenue was $5 billion.", "CONTRADICTED", risk_level="HIGH", decided_by="figure_conflict"),
        claim("Net income rose."),
    )))))
    assert [r["verdict"] for r in rows] == ["CONTRADICTED", "SUPPORTED"]
    assert rows[0]["decided_by"] == "figure_conflict"


def test_pdf_is_valid_and_contains_the_findings():
    pdf = build_pdf(result_with(
        claim("Revenue was Rs. 5,000 crore ₹ — stated.", "CONTRADICTED", risk_level="HIGH",
              decided_by="figure_conflict", reasoning_summary="Reported 5,000 vs 4,000."),
    ), document_name="annual.pdf", generated_by="a@example.com")
    assert pdf.startswith(b"%PDF")
    text = "".join(p.extract_text() for p in PdfReader(io.BytesIO(pdf)).pages)
    for needle in ("verification report", "CONTRADICTED", "figure_conflict", "annual.pdf", "verifin-pipeline/4.0"):
        assert needle in text


def test_pdf_handles_many_claims_and_unsupported_characters():
    claims = [claim(f"Claim {i} 中文 \U0001F600 with a long sentence " * 6) for i in range(60)]
    pdf = build_pdf(result_with(*claims))
    assert len(PdfReader(io.BytesIO(pdf)).pages) > 1
    assert pdf_text("₹ 5 — ok") == "Rs. 5 - ok"


# ── API ──────────────────────────────────────────────────────────────────────


@pytest.fixture(autouse=True)
def secured_app(monkeypatch):
    monkeypatch.setattr(fallback_db, "_load_persisted_store", lambda: {})
    monkeypatch.setattr(fallback_db, "_save_persisted_store", lambda store: None)
    monkeypatch.setattr(mongodb.manager, "database", fallback_db.FallbackDatabase())
    monkeypatch.setattr(settings, "auth_enabled", True)
    monkeypatch.setattr(settings, "allow_registration", True)
    monkeypatch.setattr(settings, "jwt_secret", "test-secret-" + "x" * 32)
    monkeypatch.setattr(settings, "rate_limit_enabled", False)


@pytest.fixture
async def client():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c


async def register(client, email):
    r = await client.post(f"{V1}/auth/register", json={"email": email, "password": "correct-horse-battery"})
    body = r.json()
    return body["user"], {"Authorization": f"Bearer {body['access_token']}"}


async def finished_session(tenant, session_id="sess-1", status="completed"):
    await DocumentRepository().create_document(
        DocumentModel(id="d1", tenant_id=tenant, filename="annual.pdf", size=1, file_path="x"))
    await VerificationRepository().create_session(VerificationSessionModel(
        id=session_id, tenant_id=tenant, document_id="d1", llm_output="x", status=status, overall_score=0.0,
        risk_level="HIGH"))
    await VerificationRepository().save_claims([ClaimModel(
        id=f"{session_id}_c0", session_id=session_id, claim_text="Revenue was $5 billion.", claim_type="numerical",
        status="CONTRADICTED", risk_level="HIGH", decided_by="figure_conflict",
        evidence=EvidenceModel(text="Revenue was $4 billion.", page_number=3, similarity_score=0.9))])


@pytest.mark.asyncio
async def test_export_downloads_pdf_and_csv_and_is_audited(client):
    user, headers = await register(client, "a@example.com")
    await finished_session(user["tenant_id"])

    pdf = await client.get(f"{V1}/verification/sess-1/export", headers=headers)
    assert pdf.status_code == 200 and pdf.content.startswith(b"%PDF")
    assert 'filename="verifin-report-sess-1.pdf"' in pdf.headers["content-disposition"]

    csv_resp = await client.get(f"{V1}/verification/sess-1/export?format=csv", headers=headers)
    assert csv_resp.status_code == 200 and "figure_conflict" in csv_resp.content.decode("utf-8-sig")

    events = (await client.get(f"{V1}/audit/events?action=verification.export", headers=headers)).json()
    assert sorted(e["details"]["format"] for e in events) == ["csv", "pdf"]


@pytest.mark.asyncio
async def test_export_is_tenant_scoped_and_requires_a_finished_job(client):
    a, a_headers = await register(client, "a@example.com")
    _, b_headers = await register(client, "b@example.com")
    await finished_session(a["tenant_id"], "sess-1")
    await VerificationRepository().create_session(VerificationSessionModel(
        id="sess-2", tenant_id=a["tenant_id"], document_id="d1", llm_output="x", status="running"))

    assert (await client.get(f"{V1}/verification/sess-1/export", headers=b_headers)).status_code == 404
    assert (await client.get(f"{V1}/verification/sess-2/export", headers=a_headers)).status_code == 409
    assert (await client.get(f"{V1}/verification/sess-1/export?format=xlsx", headers=a_headers)).status_code == 422
    assert (await client.get(f"{V1}/verification/sess-1/export")).status_code == 401
