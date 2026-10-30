"""SEC EDGAR import: HTML conversion, request hygiene, SSRF guards, and the import endpoints (no live network)."""

import io
from unittest.mock import MagicMock

import httpx
import pytest
from httpx import ASGITransport, AsyncClient
from pypdf import PdfReader

from app.api.documents import get_document_service, get_edgar_service
from app.config import settings
from app.database import fallback_db, mongodb
from app.main import app
from app.repositories.document_repository import DocumentRepository
from app.services.document_service import DocumentService
from app.services.edgar_service import EdgarService, html_to_text, text_to_pdf

V1 = "/api/v1"
AGENT = "Verifin Tests tests@example.com"

FILING_HTML = """<html><head><title>x</title><style>p{}</style></head><body>
<ix:header><ix:hidden>HIDDEN-XBRL-NOISE</ix:hidden></ix:header>
<div>Apple Inc. annual report for the fiscal year ended September 27, 2025.</div>
<p>Total net sales were $416 billion, an increase of 6 percent.</p>
<div style="display:none">invisible text</div>
<table><tr><td>Net sales</td><td>$</td><td>416,161</td><td>391,035</td></tr>
<tr><td>Net income</td><td>$</td><td>112,010</td><td>93,736</td></tr></table>
<p>Cash and cash equivalents were $35 billion at year end, as set out in the notes to the consolidated statements.</p>
</body></html>"""
FILING_HTML = FILING_HTML + "<p>" + "Filler sentence about operations and liquidity. " * 8 + "</p>"

TICKERS = {"0": {"cik_str": 320193, "ticker": "AAPL", "title": "Apple Inc."}}
SUBMISSIONS = {"name": "Apple Inc.", "filings": {"recent": {
    "form": ["10-K", "8-K", "10-Q"], "accessionNumber": ["0000320193-25-000079", "0000320193-25-000080", "0000320193-25-000050"],
    "filingDate": ["2025-10-31", "2025-11-01", "2025-08-01"], "reportDate": ["2025-09-27", "2025-11-01", "2025-06-28"],
    "primaryDocument": ["aapl-20250927.htm", "x.htm", "../evil.htm"]}}}


def mock_edgar(requests_seen):
    def handler(request: httpx.Request) -> httpx.Response:
        requests_seen.append(request)
        if request.url.path.endswith("company_tickers.json"):
            return httpx.Response(200, json=TICKERS)
        if request.url.host == "data.sec.gov":
            return httpx.Response(200, json=SUBMISSIONS)
        if request.url.path.endswith("aapl-20250927.htm"):
            return httpx.Response(200, content=FILING_HTML.encode())
        return httpx.Response(404)

    return httpx.AsyncClient(transport=httpx.MockTransport(handler))


@pytest.fixture(autouse=True)
def configured(monkeypatch):
    monkeypatch.setattr(fallback_db, "_load_persisted_store", lambda: {})
    monkeypatch.setattr(fallback_db, "_save_persisted_store", lambda store: None)
    monkeypatch.setattr(mongodb.manager, "database", fallback_db.FallbackDatabase())
    monkeypatch.setattr(settings, "auth_enabled", True)
    monkeypatch.setattr(settings, "allow_registration", True)
    monkeypatch.setattr(settings, "jwt_secret", "test-secret-" + "x" * 32)
    monkeypatch.setattr(settings, "rate_limit_enabled", False)
    monkeypatch.setattr(settings, "edgar_user_agent", AGENT)
    monkeypatch.setattr("app.services.edgar_service._MIN_INTERVAL", 0)


# ── Conversion ───────────────────────────────────────────────────────────────


def test_html_becomes_text_without_hidden_or_script_content():
    text = html_to_text(FILING_HTML)
    assert "Total net sales were $416 billion" in text
    assert "HIDDEN-XBRL-NOISE" not in text and "invisible text" not in text and "p{}" not in text
    assert "Net sales | 416,161 | 391,035" in text  # one table row per line, bare "$" cells dropped


def test_text_pdf_round_trips_through_pdf_extraction():
    pdf = text_to_pdf(html_to_text(FILING_HTML), "Apple Inc. 10-K")
    extracted = "".join(p.extract_text() for p in PdfReader(io.BytesIO(pdf)).pages)
    assert "Total net sales were $416 billion" in extracted and pdf.startswith(b"%PDF-")


# ── Service ──────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_requests_carry_the_declared_user_agent_and_only_sec_hosts():
    seen = []
    service = EdgarService(mock_edgar(seen))
    result = await service.list_filings("aapl")
    assert result["cik"] == "0000320193" and result["company"] == "Apple Inc."
    assert {r.headers["user-agent"] for r in seen} == {AGENT}
    assert {r.url.host for r in seen} <= {"www.sec.gov", "data.sec.gov"}
    # the 8-K was filtered out by default and the traversal-style document name was dropped
    assert [f["form"] for f in result["filings"]] == ["10-K"]


@pytest.mark.asyncio
async def test_import_requires_a_configured_contact(monkeypatch):
    monkeypatch.setattr(settings, "edgar_user_agent", None)
    with pytest.raises(Exception) as err:
        await EdgarService(mock_edgar([])).list_filings("AAPL")
    assert err.value.status_code == 503 and "EDGAR_USER_AGENT" in err.value.detail


@pytest.mark.asyncio
@pytest.mark.parametrize("cik,accession,document", [
    ("320193; rm -rf /", "0000320193-25-000079", "a.htm"),
    ("320193", "../../etc/passwd", "a.htm"),
    ("320193", "0000320193-25-000079", "../../../x.htm"),
    ("320193", "0000320193-25-000079", "http://evil.example/x.htm"),
    ("320193", "0000320193-25-000079", "payload.exe"),
])
async def test_malformed_identifiers_are_rejected_before_any_request(cik, accession, document):
    seen = []
    with pytest.raises(Exception) as err:
        await EdgarService(mock_edgar(seen)).fetch_filing_pdf(cik, accession, document, "t")
    assert err.value.status_code == 422 and seen == []


@pytest.mark.asyncio
async def test_oversized_filings_are_refused(monkeypatch):
    monkeypatch.setattr(settings, "edgar_max_bytes", 100)
    with pytest.raises(Exception) as err:
        await EdgarService(mock_edgar([])).fetch_filing_pdf("320193", "0000320193-25-000079", "aapl-20250927.htm", "t")
    assert err.value.status_code == 413


@pytest.mark.asyncio
async def test_unknown_ticker_and_missing_filing_are_404():
    service = EdgarService(mock_edgar([]))
    with pytest.raises(Exception) as err:
        await service.list_filings("ZZZZ")
    assert err.value.status_code == 404
    with pytest.raises(Exception) as err:
        await service.fetch_filing_pdf("320193", "0000320193-25-000079", "missing.htm", "t")
    assert err.value.status_code == 404


# ── Endpoints ────────────────────────────────────────────────────────────────


@pytest.fixture
async def client():
    quiet = DocumentService()
    quiet.chunking_service = MagicMock(extract_chunks_from_pdf_bytes=MagicMock(return_value=[]))
    quiet.table_extractor = MagicMock(extract_tables_from_pdf_bytes=MagicMock(return_value=[]))
    app.dependency_overrides[get_edgar_service] = lambda: EdgarService(mock_edgar([]))
    app.dependency_overrides[get_document_service] = lambda: quiet
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c
    app.dependency_overrides.clear()


async def register(client, email):
    r = await client.post(f"{V1}/auth/register", json={"email": email, "password": "correct-horse-battery"})
    body = r.json()
    return body["user"], {"Authorization": f"Bearer {body['access_token']}"}


@pytest.mark.asyncio
async def test_search_and_import_endpoints(client):
    user, headers = await register(client, "a@example.com")
    found = (await client.get(f"{V1}/documents/edgar/filings?query=AAPL", headers=headers)).json()
    assert found["filings"][0]["accession"] == "0000320193-25-000079"

    r = await client.post(f"{V1}/documents/edgar/import", headers=headers, json={
        "cik": "320193", "accession": "0000320193-25-000079", "primary_document": "aapl-20250927.htm",
        "company": "Apple Inc.", "form": "10-K"})
    assert r.status_code == 200, r.text
    doc = r.json()
    assert doc["filename"].endswith(".pdf") and "Apple_Inc." in doc["filename"] and doc["page_count"] >= 1
    stored = await DocumentRepository().get_document_by_id(doc["id"])
    assert stored.tenant_id == user["tenant_id"] and stored.sha256

    events = (await client.get(f"{V1}/audit/events?action=document.import_edgar", headers=headers)).json()
    assert events[0]["details"]["accession"] == "0000320193-25-000079"


@pytest.mark.asyncio
async def test_endpoint_validation_and_roles(client):
    _, headers = await register(client, "a@example.com")
    bad = await client.post(f"{V1}/documents/edgar/import", headers=headers, json={
        "cik": "320193", "accession": "not-an-accession", "primary_document": "a.htm"})
    assert bad.status_code == 422
    assert (await client.get(f"{V1}/documents/edgar/filings?query=AAPL")).status_code == 401
    await client.post(f"{V1}/auth/users", headers=headers,
                      json={"email": "v@example.com", "password": "correct-horse-battery", "role": "viewer"})
    login = await client.post(f"{V1}/auth/login", json={"email": "v@example.com", "password": "correct-horse-battery"})
    viewer = {"Authorization": f"Bearer {login.json()['access_token']}"}
    assert (await client.get(f"{V1}/documents/edgar/filings?query=AAPL", headers=viewer)).status_code == 403
