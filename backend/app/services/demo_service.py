"""
Demo service providing reference canned demonstration data for VERIFIN 2.0.
"""

import json
from pathlib import Path
from typing import List
from fastapi import HTTPException, status

from app.config import settings
from app.schemas.demo import DemoRunResponse
from app.schemas.verification import ClaimResponse, Evidence, NLIResult
from app.utils.logging import logger


class DemoService:
    def __init__(self, demo_file_path: Path = settings.demo_data_path):
        self.demo_file_path = demo_file_path

    async def run_demo(self) -> DemoRunResponse:
        """
        Loads the canned demo verification data grounded in Apple FY2025 excerpt (data/demo/demo_data.json)
        and returns it formatted for the frontend DemoRunResponse contract.
        Does not pollute production database collections.
        """
        if not self.demo_file_path.exists():
            logger.error(f"Demo dataset file not found at: {self.demo_file_path}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Reference demo dataset file is missing from repository.",
            )

        try:
            with open(self.demo_file_path, "r", encoding="utf-8") as f:
                data = json.load(f)
        except Exception as exc:
            logger.error(f"Failed to read demo dataset file: {exc}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to parse reference demo dataset.",
            )

        demo_claims_raw = data.get("demo_claims", [])
        claims: List[ClaimResponse] = []

        for idx, item in enumerate(demo_claims_raw):
            ev_raw = item.get("evidence")
            evidence = (
                Evidence(
                    text=ev_raw.get("text", ""),
                    page_number=ev_raw.get("page_number", 0),
                    similarity_score=float(ev_raw.get("similarity_score", 0.0)),
                )
                if ev_raw
                else None
            )

            nli_raw = item.get("nli")
            nli = (
                NLIResult(
                    entailment=float(nli_raw.get("entailment", 0.0)),
                    contradiction=float(nli_raw.get("contradiction", 0.0)),
                    neutral=float(nli_raw.get("neutral", 0.0)),
                    label=str(nli_raw.get("label", "UNVERIFIABLE")),
                )
                if nli_raw
                else None
            )

            claim_id = f"demo-claim-{idx + 1}"
            claims.append(
                ClaimResponse(
                    id=claim_id,
                    claim_text=item.get("claim_text", ""),
                    claim_type=item.get("claim_type", "General"),
                    status=item.get("status", "Verified"),
                    confidence=float(item.get("confidence", 0.0))
                    if item.get("confidence") is not None
                    else None,
                    risk_level=item.get("risk_level"),
                    source_sentence=item.get("source_sentence"),
                    evidence=evidence,
                    nli=nli,
                )
            )

        logger.info(
            f"Demo execution requested: returning {len(claims)} reference claims from {self.demo_file_path.name}"
        )

        return DemoRunResponse(
            status="success",
            message="Demo verification completed using reference dataset (Apple FY2025)",
            session_id="demo-session-apple-2025",
            claims_count=len(claims),
            claims=claims,
        )
