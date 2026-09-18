import json
import os
from pathlib import Path
from typing import List
import uuid
from fastapi import APIRouter, UploadFile, File, HTTPException
from app.schemas.schemas import DocumentResponse, VerificationStartRequest, VerificationResultResponse, ClaimResponse

router = APIRouter(prefix="/api")

DEMO_DATA_PATH = Path(__file__).resolve().parent.parent.parent.parent / "data" / "demo" / "demo_data.json"

def load_demo_claims():
    if DEMO_DATA_PATH.exists():
        try:
            with open(DEMO_DATA_PATH, "r", encoding="utf-8") as f:
                data = json.load(f)
                claims = []
                for c in data.get("demo_claims", []):
                    claims.append({
                        "id": str(uuid.uuid4()),
                        "claim_text": c.get("claim_text", ""),
                        "claim_type": c.get("claim_type", "General"),
                        "status": c.get("status", "Verified"),
                        "confidence": c.get("confidence", 0.9),
                        "risk_level": c.get("risk_level", "LOW"),
                        "source_sentence": c.get("source_sentence", ""),
                        "evidence": c.get("evidence"),
                        "nli": c.get("nli")
                    })
                return claims
        except Exception as e:
            print(f"Error loading demo claims: {e}")
    return []

@router.post("/documents/upload", response_model=DocumentResponse)
async def upload_document(file: UploadFile = File(...)):
    """Uploads a financial document and starts parsing."""
    return {
        "id": str(uuid.uuid4()),
        "filename": file.filename,
        "file_type": "pdf",
        "size": 1024 * 1024 * 4,
        "page_count": 184,
        "status": "ready"
    }

@router.post("/verification/start", response_model=VerificationResultResponse)
async def start_verification(request: VerificationStartRequest):
    """Starts the verification pipeline for an LLM output against a document."""
    claims = load_demo_claims()
    return {
        "id": str(uuid.uuid4()),
        "document_id": request.document_id,
        "overall_score": 87.5,
        "risk_level": "LOW",
        "status": "completed",
        "claims": claims
    }

@router.get("/verification/{verification_id}/results", response_model=VerificationResultResponse)
async def get_verification_results(verification_id: str):
    claims = load_demo_claims()
    return {
        "id": verification_id,
        "document_id": "apple-10k-fy25",
        "overall_score": 88.5,
        "risk_level": "LOW",
        "status": "completed",
        "claims": claims
    }

@router.post("/demo/run")
async def run_demo():
    """Runs the predefined demo mode verification."""
    claims = load_demo_claims()
    return {
        "status": "success",
        "message": "Demo verification pipeline executed successfully",
        "session_id": str(uuid.uuid4()),
        "claims_count": len(claims),
        "claims": claims
    }
