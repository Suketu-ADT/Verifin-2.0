"""Evaluation metrics: classification quality, bootstrap CIs, McNemar, retrieval and calibration."""

from __future__ import annotations

import math
from typing import Dict, List, Optional, Sequence, Tuple

import numpy as np

LABELS = ["SUPPORTED", "CONTRADICTED", "UNVERIFIABLE"]


def confusion(y_true: Sequence[str], y_pred: Sequence[str]) -> Dict[str, Dict[str, int]]:
    m = {t: {p: 0 for p in LABELS} for t in LABELS}
    for t, p in zip(y_true, y_pred):
        m[t][p] += 1
    return m


def prf(y_true: Sequence[str], y_pred: Sequence[str], positive: str) -> Dict[str, float]:
    tp = sum(1 for t, p in zip(y_true, y_pred) if t == positive and p == positive)
    fp = sum(1 for t, p in zip(y_true, y_pred) if t != positive and p == positive)
    fn = sum(1 for t, p in zip(y_true, y_pred) if t == positive and p != positive)
    precision = tp / (tp + fp) if tp + fp else 0.0
    recall = tp / (tp + fn) if tp + fn else 0.0
    f1 = 2 * precision * recall / (precision + recall) if precision + recall else 0.0
    return {"precision": precision, "recall": recall, "f1": f1, "support": tp + fn}


def classification_report(y_true: Sequence[str], y_pred: Sequence[str]) -> Dict:
    per_class = {lab: prf(y_true, y_pred, lab) for lab in LABELS}
    present = [lab for lab in LABELS if per_class[lab]["support"] > 0]
    macro_f1 = float(np.mean([per_class[lab]["f1"] for lab in present])) if present else 0.0
    accuracy = float(np.mean([t == p for t, p in zip(y_true, y_pred)])) if y_true else 0.0
    return {
        "n": len(y_true),
        "accuracy": accuracy,
        "macro_f1": macro_f1,
        "per_class": per_class,
        "confusion": confusion(y_true, y_pred),
    }


def binary_flag_report(y_true: Sequence[str], flagged: Sequence[bool], unsafe_labels: Tuple[str, ...]) -> Dict[str, float]:
    """Treat `unsafe_labels` as the positive class ("this claim is a hallucination")."""
    truth = [t in unsafe_labels for t in y_true]
    tp = sum(1 for t, f in zip(truth, flagged) if t and f)
    fp = sum(1 for t, f in zip(truth, flagged) if not t and f)
    fn = sum(1 for t, f in zip(truth, flagged) if t and not f)
    tn = sum(1 for t, f in zip(truth, flagged) if not t and not f)
    precision = tp / (tp + fp) if tp + fp else 0.0
    recall = tp / (tp + fn) if tp + fn else 0.0
    return {
        "precision": precision,
        "recall": recall,
        "f1": 2 * precision * recall / (precision + recall) if precision + recall else 0.0,
        "false_positive_rate": fp / (fp + tn) if fp + tn else 0.0,
        "tp": tp, "fp": fp, "fn": fn, "tn": tn,
    }


def bootstrap_ci(
    values_fn, n: int, iterations: int = 1000, seed: int = 7, alpha: float = 0.05
) -> Tuple[float, float, float]:
    """values_fn(indices) -> metric. Returns (point, lo, hi) via percentile bootstrap."""
    rng = np.random.default_rng(seed)
    point = values_fn(np.arange(n))
    samples = [values_fn(rng.integers(0, n, n)) for _ in range(iterations)]
    lo, hi = np.percentile(samples, [100 * alpha / 2, 100 * (1 - alpha / 2)])
    return float(point), float(lo), float(hi)


def macro_f1_ci(y_true: List[str], y_pred: List[str], iterations: int = 1000) -> Tuple[float, float, float]:
    yt, yp = np.array(y_true), np.array(y_pred)

    def metric(idx):
        return classification_report(list(yt[idx]), list(yp[idx]))["macro_f1"]

    return bootstrap_ci(metric, len(y_true), iterations)


def accuracy_ci(correct: Sequence[bool], iterations: int = 1000) -> Tuple[float, float, float]:
    arr = np.array(correct, dtype=float)
    return bootstrap_ci(lambda idx: float(arr[idx].mean()), len(arr), iterations)


def mcnemar(correct_a: Sequence[bool], correct_b: Sequence[bool]) -> Dict[str, float]:
    """Exact-binomial McNemar test on paired correctness. b = A right/B wrong, c = A wrong/B right."""
    b = sum(1 for x, y in zip(correct_a, correct_b) if x and not y)
    c = sum(1 for x, y in zip(correct_a, correct_b) if not x and y)
    n = b + c
    if n == 0:
        return {"b": b, "c": c, "p_value": 1.0}
    k = min(b, c)
    p = 2 * sum(math.comb(n, i) for i in range(k + 1)) / (2 ** n)
    return {"b": b, "c": c, "p_value": min(1.0, p)}


def retrieval_metrics(gold_pages: Sequence[Optional[int]], retrieved_pages: Sequence[List[int]]) -> Dict[str, float]:
    """Page-level Recall@k and MRR over claims that have a gold page."""
    pairs = [(g, r) for g, r in zip(gold_pages, retrieved_pages) if g is not None]
    if not pairs:
        return {"n": 0, "recall_at_k": 0.0, "mrr": 0.0}
    hits, rr = [], []
    for gold, pages in pairs:
        hits.append(1.0 if gold in pages else 0.0)
        rr.append(next((1.0 / (i + 1) for i, p in enumerate(pages) if p == gold), 0.0))
    return {"n": len(pairs), "recall_at_k": float(np.mean(hits)), "mrr": float(np.mean(rr))}


def expected_calibration_error(confidences: Sequence[float], correct: Sequence[bool], bins: int = 10) -> Dict:
    conf = np.array(confidences, dtype=float)
    ok = np.array(correct, dtype=float)
    edges = np.linspace(0, 1, bins + 1)
    ece, table = 0.0, []
    for lo, hi in zip(edges[:-1], edges[1:]):
        mask = (conf > lo) & (conf <= hi) if lo > 0 else (conf >= lo) & (conf <= hi)
        if not mask.any():
            continue
        gap = abs(conf[mask].mean() - ok[mask].mean())
        ece += mask.mean() * gap
        table.append({"bin": f"{lo:.1f}-{hi:.1f}", "n": int(mask.sum()),
                      "mean_confidence": float(conf[mask].mean()), "accuracy": float(ok[mask].mean())})
    return {"ece": float(ece), "bins": table}
