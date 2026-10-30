"""
Turn stored predictions into metric tables (JSON + Markdown).

    python -m eval.report --split dev --systems verifin,verifin:dense,number_match
"""

from __future__ import annotations

import argparse
import json
from collections import defaultdict
from typing import Dict, List

import numpy as np

from eval import metrics as M
from eval.build_dataset import DATASET_PATH
from eval.run import RESULTS_DIR, load_items, result_path


def load_predictions(split: str, system: str, run: str = "current") -> Dict[str, dict]:
    path = result_path(split, system, run)
    if not path.exists():
        return {}
    return {r["id"]: r for r in (json.loads(l) for l in path.read_text(encoding="utf-8").splitlines() if l.strip())}


def evaluate(items: List[dict], preds: Dict[str, dict], label_key: str = "label") -> Dict:
    scored = [i for i in items if i["id"] in preds]
    y_true = [i["label"] for i in scored]
    y_pred = [preds[i["id"]].get(label_key) or preds[i["id"]]["label"] for i in scored]
    if not scored:
        return {}

    base = M.classification_report(y_true, y_pred)
    f1_point, f1_lo, f1_hi = M.macro_f1_ci(y_true, y_pred)
    correct = [t == p for t, p in zip(y_true, y_pred)]
    acc_point, acc_lo, acc_hi = M.accuracy_ci(correct)
    flagged = [p != "SUPPORTED" for p in y_pred]

    by_sub: Dict[str, List[bool]] = defaultdict(list)
    by_tier: Dict[str, List[bool]] = defaultdict(list)
    for i, c in zip(scored, correct):
        by_sub[f"{i['label']}/{i['subtype']}"].append(c)
        by_tier[i["tier"]].append(c)

    retrieved = [preds[i["id"]].get("retrieved_pages", []) for i in scored]
    latencies = [preds[i["id"]].get("latency_s", 0.0) for i in scored]
    confs = [(preds[i["id"]].get("confidence"), t == (preds[i["id"]].get("label_nli_only") or p))
             for i, t, p in zip(scored, y_true, y_pred) if preds[i["id"]].get("confidence") is not None]
    errors = sum(1 for i in scored if preds[i["id"]].get("error"))

    return {
        "n": len(scored),
        "errors": errors,
        "accuracy": {"point": acc_point, "ci95": [acc_lo, acc_hi]},
        "macro_f1": {"point": f1_point, "ci95": [f1_lo, f1_hi]},
        "per_class": base["per_class"],
        "confusion": base["confusion"],
        "flag_contradicted": M.binary_flag_report(y_true, flagged, ("CONTRADICTED",)),
        "flag_any_unsupported": M.binary_flag_report(y_true, flagged, ("CONTRADICTED", "UNVERIFIABLE")),
        "by_subtype_accuracy": {k: {"n": len(v), "accuracy": float(np.mean(v))} for k, v in sorted(by_sub.items())},
        "by_tier_accuracy": {k: {"n": len(v), "accuracy": float(np.mean(v))} for k, v in sorted(by_tier.items())},
        "retrieval": M.retrieval_metrics([i["gold_page"] for i in scored], retrieved) if any(retrieved) else None,
        "calibration": M.expected_calibration_error([c for c, _ in confs], [ok for _, ok in confs]) if confs else None,
        "latency_s": {"mean": float(np.mean(latencies)), "p50": float(np.percentile(latencies, 50)),
                      "p95": float(np.percentile(latencies, 95))},
        "_correct": correct,
        "_ids": [i["id"] for i in scored],
    }


def pct(x: float) -> str:
    return f"{100 * x:.1f}"


def render(split: str, rows: Dict[str, Dict], reference: str) -> str:
    out = [f"# Evaluation results - `{split}` split\n"]
    out.append("## Overall (3-way verdict)\n")
    out.append("| System | n | Accuracy [95% CI] | Macro-F1 [95% CI] | Supp. F1 | Contr. F1 | Unver. F1 | p vs ref |")
    out.append("|---|---|---|---|---|---|---|---|")
    ref_correct = rows[reference]["_correct"] if reference in rows else None
    for name, r in rows.items():
        pc = r["per_class"]
        p = ""
        if ref_correct is not None and name != reference and r["_ids"] == rows[reference]["_ids"]:
            p = f"{M.mcnemar(ref_correct, r['_correct'])['p_value']:.3f}"
        out.append(
            f"| {name} | {r['n']} | {pct(r['accuracy']['point'])} [{pct(r['accuracy']['ci95'][0])}, {pct(r['accuracy']['ci95'][1])}] "
            f"| {pct(r['macro_f1']['point'])} [{pct(r['macro_f1']['ci95'][0])}, {pct(r['macro_f1']['ci95'][1])}] "
            f"| {pct(pc['SUPPORTED']['f1'])} | {pct(pc['CONTRADICTED']['f1'])} | {pct(pc['UNVERIFIABLE']['f1'])} | {p} |"
        )
    out.append(f"\n`p vs ref` is an exact McNemar test against `{reference}` on the same claims.\n")

    out.append("## Hallucination flagging (claim flagged when verdict is not SUPPORTED)\n")
    out.append("| System | Target | Precision | Recall | F1 | False-positive rate |")
    out.append("|---|---|---|---|---|---|")
    for name, r in rows.items():
        for label, key in (("contradicted only", "flag_contradicted"), ("any unsupported", "flag_any_unsupported")):
            f = r[key]
            out.append(f"| {name} | {label} | {pct(f['precision'])} | {pct(f['recall'])} | {pct(f['f1'])} | {pct(f['false_positive_rate'])} |")

    out.append("\n## Accuracy by error type\n")
    subtypes = sorted({k for r in rows.values() for k in r["by_subtype_accuracy"]})
    out.append("| Label / subtype | " + " | ".join(rows) + " |")
    out.append("|---|" + "---|" * len(rows))
    for st in subtypes:
        cells = []
        for r in rows.values():
            e = r["by_subtype_accuracy"].get(st)
            cells.append(f"{pct(e['accuracy'])} (n={e['n']})" if e else "-")
        out.append(f"| {st} | " + " | ".join(cells) + " |")

    out.append("\n## Retrieval, calibration and latency\n")
    out.append("| System | Recall@k (page) | MRR | ECE | mean s/claim | p95 s/claim | errors |")
    out.append("|---|---|---|---|---|---|---|")
    for name, r in rows.items():
        rt, cal = r["retrieval"], r["calibration"]
        out.append(
            f"| {name} | {pct(rt['recall_at_k']) if rt else '-'} | {f'{rt['mrr']:.3f}' if rt else '-'} "
            f"| {f'{cal['ece']:.3f}' if cal else '-'} | {r['latency_s']['mean']:.2f} | {r['latency_s']['p95']:.2f} | {r['errors']} |"
        )

    out.append("\n## Confusion matrices (rows = truth, columns = prediction)\n")
    for name, r in rows.items():
        out.append(f"**{name}**\n")
        out.append("| truth \\ pred | SUPPORTED | CONTRADICTED | UNVERIFIABLE |")
        out.append("|---|---|---|---|")
        for t in M.LABELS:
            c = r["confusion"][t]
            out.append(f"| {t} | {c['SUPPORTED']} | {c['CONTRADICTED']} | {c['UNVERIFIABLE']} |")
        out.append("")
    return "\n".join(out)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--split", default="dev", choices=["dev", "test", "all"])
    parser.add_argument("--systems", required=True)
    parser.add_argument("--tag", default="")
    parser.add_argument("--run", default="current", help="results namespace; comma-separate to compare runs")
    args = parser.parse_args()

    items = load_items(args.split)
    rows: Dict[str, Dict] = {}
    runs = [r.strip() for r in args.run.split(",") if r.strip()]
    for run in runs:
        for name in [s.strip() for s in args.systems.split(",") if s.strip()]:
            preds = load_predictions(args.split, name, run)
            if not preds:
                print(f"(no predictions for {run}/{name}, skipped)")
                continue
            label = name if len(runs) == 1 else f"{run}/{name}"
            rows[label] = evaluate(items, preds)
            if name.startswith("verifin") and any("label_nli_only" in p for p in preds.values()):
                rows[f"{label} [raw NLI]"] = evaluate(items, preds, label_key="label_nli_only")

    if not rows:
        raise SystemExit("nothing to report")
    reference = next(iter(rows))
    markdown = render(args.split, rows, reference)
    stem = f"report_{args.split}{('_' + args.tag) if args.tag else ''}"
    out_dir = RESULTS_DIR / runs[-1]
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / f"{stem}.md").write_text(markdown, encoding="utf-8")
    (out_dir / f"{stem}.json").write_text(
        json.dumps({k: {kk: vv for kk, vv in v.items() if not kk.startswith('_')} for k, v in rows.items()}, indent=1),
        encoding="utf-8",
    )
    print(markdown)


if __name__ == "__main__":
    main()
