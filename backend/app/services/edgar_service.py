"""
Import filings from SEC EDGAR so a user can verify statements against a public company's own report.

* SEC fair-access rules: every request carries a descriptive User-Agent (``EDGAR_USER_AGENT``, e.g.
  "Example Corp admin@example.com") and stays well under 10 requests a second.
* Only ``www.sec.gov`` and ``data.sec.gov`` are ever contacted, and the URL is assembled from validated
  components (digits, an accession pattern, a plain file name), so a caller cannot point the server elsewhere.
* EDGAR serves most filings as HTML. They are converted to a text PDF so the rest of the pipeline sees an
  ordinary document. Tables become one line per row, cells joined by " | "; the layout is not preserved.
"""

from __future__ import annotations

import asyncio
import io
import re
import time
from html.parser import HTMLParser
from typing import Any, Dict, List, Optional

import httpx
from fastapi import HTTPException, UploadFile, status
from fpdf import FPDF
from starlette.datastructures import Headers

from app.config import settings
from app.services.export_service import pdf_text
from app.utils.logging import logger

TICKER_URL = "https://www.sec.gov/files/company_tickers.json"
SUBMISSIONS_URL = "https://data.sec.gov/submissions/CIK{cik}.json"
ARCHIVE_URL = "https://www.sec.gov/Archives/edgar/data/{cik}/{accession}/{document}"

FORMS = ("10-K", "10-K405", "10-KT", "10-Q", "20-F", "40-F", "8-K", "6-K")
_ACCESSION_RE = re.compile(r"^\d{10}-\d{2}-\d{6}$")
_DOCUMENT_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_.\-]{0,120}\.(htm|html|pdf|txt)$", re.IGNORECASE)
_MIN_INTERVAL = 0.2  # seconds between requests: at most 5 a second


class EdgarError(HTTPException):
    pass


def _fail(code: int, detail: str) -> EdgarError:
    return EdgarError(status_code=code, detail=detail)


class _Throttle:
    def __init__(self) -> None:
        self._last = 0.0
        self._lock = asyncio.Lock()

    async def wait(self) -> None:
        async with self._lock:
            delay = self._last + _MIN_INTERVAL - time.monotonic()
            if delay > 0:
                await asyncio.sleep(delay)
            self._last = time.monotonic()


class _TextExtractor(HTMLParser):
    """HTML to plain text: block elements break lines, table rows keep their cells on one line."""

    _BLOCKS = {"p", "div", "br", "li", "h1", "h2", "h3", "h4", "h5", "h6", "tr", "table", "section", "article"}
    _SKIP = {"script", "style", "head", "ix:header", "title"}

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.lines: List[str] = []
        self._line: List[str] = []
        self._cells: List[str] = []
        self._cell: List[str] = []
        self._skip_depth = 0
        self._in_row = False
        self._hidden: List[str] = []

    def _flush_line(self) -> None:
        text = re.sub(r"\s+", " ", "".join(self._line)).strip()
        if text:
            self.lines.append(text)
        self._line = []

    def handle_starttag(self, tag: str, attrs: list) -> None:
        style = (dict(attrs).get("style") or "").replace(" ", "").lower()
        if tag in self._SKIP or "display:none" in style:
            self._skip_depth += 1
            self._hidden.append(tag)
            return
        if tag == "tr":
            self._flush_line()
            self._in_row, self._cells = True, []
        elif tag in ("td", "th"):
            self._cell = []
        elif tag in self._BLOCKS:
            self._flush_line()

    def handle_endtag(self, tag: str) -> None:
        if self._skip_depth and self._hidden and tag == self._hidden[-1]:
            self._hidden.pop()
            self._skip_depth -= 1
            return
        if self._skip_depth:
            return
        if tag in ("td", "th"):
            cell = re.sub(r"\s+", " ", "".join(self._cell)).strip()
            if cell and cell not in ("$", ")", "%"):
                self._cells.append(cell)
            self._cell = []
        elif tag == "tr":
            if self._cells:
                self.lines.append(" | ".join(self._cells))
            self._cells, self._in_row = [], False
        elif tag in self._BLOCKS:
            self._flush_line()

    def handle_data(self, data: str) -> None:
        if self._skip_depth:
            return
        (self._cell if self._in_row else self._line).append(data)

    def text(self) -> str:
        self._flush_line()
        return "\n".join(self.lines)


def html_to_text(html: str) -> str:
    parser = _TextExtractor()
    parser.feed(html)
    parser.close()
    return parser.text()


def text_to_pdf(text: str, title: str) -> bytes:
    pdf = FPDF(format="A4")
    pdf.set_margins(15, 15, 15)
    pdf.set_auto_page_break(auto=True, margin=15)
    pdf.add_page()
    pdf.set_font("Helvetica", "B", 11)
    pdf.multi_cell(0, 6, pdf_text(title), new_x="LMARGIN", new_y="NEXT")
    pdf.ln(2)
    pdf.set_font("Helvetica", "", 9)
    for line in text.split("\n"):
        pdf.multi_cell(0, 4.4, pdf_text(line) or " ", new_x="LMARGIN", new_y="NEXT")
    return bytes(pdf.output())


class EdgarService:
    def __init__(self, client: Optional[httpx.AsyncClient] = None):
        self._client = client
        self._throttle = _Throttle()
        self._tickers: Optional[Dict[str, Dict[str, Any]]] = None

    # ── HTTP ─────────────────────────────────────────────────────────────────

    def _headers(self) -> Dict[str, str]:
        agent = (settings.edgar_user_agent or "").strip()
        if not agent or "@" not in agent:
            raise _fail(
                status.HTTP_503_SERVICE_UNAVAILABLE,
                "EDGAR import is not configured: set EDGAR_USER_AGENT to 'Your Organisation contact@example.com' "
                "(the SEC requires it).",
            )
        return {"User-Agent": agent, "Accept-Encoding": "gzip, deflate"}

    async def _get(self, url: str, *, limit: Optional[int] = None) -> bytes:
        headers = self._headers()
        await self._throttle.wait()
        client = self._client or httpx.AsyncClient(timeout=30, follow_redirects=False)
        try:
            async with client.stream("GET", url, headers=headers) as response:
                if response.status_code == 404:
                    raise _fail(status.HTTP_404_NOT_FOUND, "SEC EDGAR has no such filing.")
                if response.status_code in (403, 429):
                    raise _fail(status.HTTP_503_SERVICE_UNAVAILABLE, "SEC EDGAR is rate limiting this server. Retry later.")
                if response.status_code != 200:
                    raise _fail(status.HTTP_502_BAD_GATEWAY, f"SEC EDGAR answered {response.status_code}.")
                chunks, size = [], 0
                async for chunk in response.aiter_bytes():
                    size += len(chunk)
                    if limit and size > limit:
                        raise _fail(413, "The filing is larger than the import limit.")
                    chunks.append(chunk)
                return b"".join(chunks)
        except httpx.HTTPError as exc:
            logger.warning(f"EDGAR request failed: {type(exc).__name__}")
            raise _fail(status.HTTP_502_BAD_GATEWAY, "Could not reach SEC EDGAR.")
        finally:
            if self._client is None:
                await client.aclose()

    # ── Search ───────────────────────────────────────────────────────────────

    async def resolve_cik(self, query: str) -> Dict[str, str]:
        query = query.strip()
        if re.fullmatch(r"\d{1,10}", query):
            return {"cik": query.zfill(10), "name": "", "ticker": ""}
        if not re.fullmatch(r"[A-Za-z.\-]{1,10}", query):
            raise _fail(422, "Enter a ticker symbol or a numeric CIK.")
        if self._tickers is None:
            import json

            raw = json.loads(await self._get(TICKER_URL, limit=5_000_000))
            self._tickers = {v["ticker"].upper(): v for v in raw.values()}
        entry = self._tickers.get(query.upper())
        if entry is None:
            raise _fail(status.HTTP_404_NOT_FOUND, f"No SEC registrant with ticker '{query.upper()}'.")
        return {"cik": str(entry["cik_str"]).zfill(10), "name": entry["title"], "ticker": entry["ticker"]}

    async def list_filings(self, query: str, forms: Optional[List[str]] = None, limit: int = 15) -> Dict[str, Any]:
        import json

        company = await self.resolve_cik(query)
        wanted = [f.upper() for f in (forms or ["10-K", "10-Q"])]
        if any(f not in FORMS for f in wanted):
            raise _fail(422, f"Supported forms: {', '.join(FORMS)}.")
        data = json.loads(await self._get(SUBMISSIONS_URL.format(cik=company["cik"]), limit=20_000_000))
        recent = data.get("filings", {}).get("recent", {})
        filings = []
        for i, form in enumerate(recent.get("form", [])):
            if form not in wanted:
                continue
            document = recent["primaryDocument"][i]
            if not _DOCUMENT_RE.match(document or ""):
                continue
            filings.append({
                "accession": recent["accessionNumber"][i], "form": form,
                "filing_date": recent["filingDate"][i], "report_date": recent.get("reportDate", [None] * (i + 1))[i],
                "primary_document": document,
            })
            if len(filings) >= limit:
                break
        return {"cik": company["cik"], "company": data.get("name") or company["name"], "filings": filings}

    # ── Import ───────────────────────────────────────────────────────────────

    async def fetch_filing_pdf(self, cik: str, accession: str, document: str, title: str) -> bytes:
        if not re.fullmatch(r"\d{1,10}", cik) or not _ACCESSION_RE.match(accession) or not _DOCUMENT_RE.match(document):
            raise _fail(422, "Invalid CIK, accession number or document name.")
        url = ARCHIVE_URL.format(cik=int(cik), accession=accession.replace("-", ""), document=document)
        raw = await self._get(url, limit=settings.edgar_max_bytes)
        if document.lower().endswith(".pdf") or raw.startswith(b"%PDF-"):
            return raw
        text = html_to_text(raw.decode("utf-8", errors="replace"))
        if len(text) < 200:
            raise _fail(422, "The filing has no readable text.")
        return await asyncio.to_thread(text_to_pdf, text, title)

    @staticmethod
    def as_upload(pdf: bytes, filename: str) -> UploadFile:
        return UploadFile(file=io.BytesIO(pdf), filename=filename, headers=Headers({"content-type": "application/pdf"}))
