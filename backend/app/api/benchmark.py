"""
Benchmark: the recorded evaluation results, read-only (the page behind the accuracy charts).
"""

from pathlib import Path
from typing import Any, Dict, List

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.config import settings
from app.security import Principal, require_role
from app.services.benchmark_service import BenchmarkUnavailable, build_summary, load_reports

router = APIRouter(prefix="/benchmark", tags=["Benchmark"])


def results_dir() -> Path:
    return settings.data_dir / "eval" / "results"


class Interval(BaseModel):
    value: float
    low: float
    high: float


class SystemRow(BaseModel):
    key: str
    label: str
    note: str
    claims: int
    accuracy: Interval
    macro_f1: Interval
    latency_mean_s: float


class ClassRow(BaseModel):
    label: str
    precision: float
    recall: float
    f1: float
    support: int


class FlagScores(BaseModel):
    precision: float
    recall: float
    false_positive_rate: float


class Subtype(BaseModel):
    name: str
    claims: int
    accuracy: float


class Retrieval(BaseModel):
    n: int
    recall_at_k: float
    mrr: float


class CalibrationBin(BaseModel):
    bin: str
    claims: int
    confidence: float
    accuracy: float


class Calibration(BaseModel):
    ece: float
    bins: List[CalibrationBin]


class Latency(BaseModel):
    mean: float
    p50: float
    p95: float


class BenchmarkSummary(BaseModel):
    split: str
    claims: int
    classes: List[str]
    systems: List[SystemRow]
    per_class: List[ClassRow]
    confusion: List[List[int]]
    flag_any_unsupported: FlagScores
    subtypes: List[Subtype]
    retrieval: Retrieval
    calibration: Calibration
    latency_s: Latency


@router.get("/summary", response_model=BenchmarkSummary)
async def summary(principal: Principal = Depends(require_role("viewer"))) -> Dict[str, Any]:
    """The held-out test results of VERIFIN and the systems it was compared with, as recorded by the evaluation harness."""
    try:
        return build_summary(load_reports(results_dir()))
    except BenchmarkUnavailable:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "The recorded benchmark results are not available on this server.")
