"""
A summary of the recorded benchmark results, for the Benchmark page.

The numbers come from the evaluation reports under ``data/eval/results`` (written by the evaluation harness, scored on the held-out
test split with the rules frozen); nothing here recomputes or estimates them. This module only picks the systems worth comparing
and reshapes a report into what the page draws.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, List, Optional

CLASSES = ["SUPPORTED", "CONTRADICTED", "UNVERIFIABLE"]

# (key in the report, report file, label, what it is). Order is the order shown.
SYSTEMS = [
    ("final", "verifin", "VERIFIN", "Retrieval, NLI and deterministic checks (this application)"),
    ("final", "verifin [raw NLI]", "NLI model alone", "The same NLI model with the deterministic checks switched off"),
    ("final", "number_match", "Number-match heuristic", "Flags a claim when its figures are not on the retrieved page; no ML"),
    ("baselines", "baselines/llm_rag:qwen2.5:7b", "7B language model, with evidence", "Qwen 2.5 7B asked to judge, given the same retrieved evidence"),
    ("baselines", "baselines/llm_norag:qwen2.5:7b", "7B language model, no document", "Qwen 2.5 7B asked to judge from memory alone"),
]


class BenchmarkUnavailable(Exception):
    """The report files are not on this server."""


def _load(path: Path) -> Dict[str, Any]:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError) as exc:
        raise BenchmarkUnavailable(f"Cannot read {path.name}") from exc


def _interval(metric: Dict[str, Any]) -> Dict[str, float]:
    low, high = metric.get("ci95") or [metric["point"], metric["point"]]
    return {"value": metric["point"], "low": low, "high": high}


def load_reports(results_dir: Path) -> Dict[str, Dict[str, Any]]:
    return {"final": _load(results_dir / "final" / "report_test.json"), "baselines": _load(results_dir / "baselines" / "report_test.json")}


def build_summary(reports: Dict[str, Dict[str, Any]]) -> Dict[str, Any]:
    systems: List[Dict[str, Any]] = []
    for source, key, label, note in SYSTEMS:
        row: Optional[Dict[str, Any]] = reports.get(source, {}).get(key)
        if not row:
            continue  # a baseline that was not run is left out, not invented
        systems.append({
            "key": key, "label": label, "note": note, "claims": row["n"],
            "accuracy": _interval(row["accuracy"]), "macro_f1": _interval(row["macro_f1"]),
            "latency_mean_s": round(float(row.get("latency_s", {}).get("mean", 0.0)), 2),
        })
    if not systems or systems[0]["key"] != "verifin":
        raise BenchmarkUnavailable("The VERIFIN result is missing from the report")

    v = reports["final"]["verifin"]
    confusion = [[int(v["confusion"][truth].get(guess, 0)) for guess in CLASSES] for truth in CLASSES]
    flagged = v["flag_any_unsupported"]
    return {
        "split": "test", "claims": v["n"], "classes": CLASSES, "systems": systems,
        "per_class": [{"label": c, **{k: v["per_class"][c][k] for k in ("precision", "recall", "f1", "support")}} for c in CLASSES],
        "confusion": confusion,
        "flag_any_unsupported": {k: flagged[k] for k in ("precision", "recall", "false_positive_rate")},
        "subtypes": [{"name": k, "claims": s["n"], "accuracy": s["accuracy"]} for k, s in v["by_subtype_accuracy"].items()],
        "retrieval": v["retrieval"],
        "calibration": {"ece": v["calibration"]["ece"],
                        "bins": [{"bin": b["bin"], "claims": b["n"], "confidence": b["mean_confidence"], "accuracy": b["accuracy"]}
                                 for b in v["calibration"]["bins"] if b["n"]]},
        "latency_s": v["latency_s"],
    }
