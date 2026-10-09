"""
Reproducible evaluation script for VERIFIN 2.0 Phase 3:
Cross-Encoder NLI Classification & Verification Engine.
Runs real model inference on a labelled financial evaluation test fixture
and computes empirical precision, recall, F1, and confusion matrix.
"""

import sys
from pathlib import Path
from typing import Dict, List, TypedDict

# Add backend directory to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.services.nli_service import (
    VERDICT_CONTRADICTED,
    VERDICT_SUPPORTED,
    VERDICT_UNVERIFIED,
    NLIService,
)


class LabeledTestCase(TypedDict):
    id: str
    premise: str
    claim: str
    ground_truth: str
    claim_type: str


# ── Curated Financial Evaluation Test Fixture ────────────────────────────────
FINANCIAL_EVALUATION_FIXTURE: List[LabeledTestCase] = [
    # 1. Exact Numerical Entailment (Revenue)
    {
        "id": "TC-01",
        "premise": (
            "Alphabet announced consolidated revenues of $350.0 billion for the fiscal year ended "
            "December 31, 2024, representing an increase of 14% year-over-year."
        ),
        "claim": "Alphabet reported $350.0 billion in total revenue in 2024.",
        "ground_truth": VERDICT_SUPPORTED,
        "claim_type": "numerical",
    },
    # 2. Paraphrased Factual Entailment (Segment Margin)
    {
        "id": "TC-02",
        "premise": (
            "Operating income for Google Services was $105.2 billion, delivering an operating margin of 35.8%."
        ),
        "claim": "The Google Services operating margin was 35.8% for the period.",
        "ground_truth": VERDICT_SUPPORTED,
        "claim_type": "numerical",
    },
    # 3. Direct Numerical Contradiction (Understated Revenue)
    {
        "id": "TC-03",
        "premise": (
            "Consolidated revenues reached $350.0 billion in fiscal year 2024, compared to $307.4 billion in 2023."
        ),
        "claim": "Alphabet consolidated revenue in 2024 was only $250 billion.",
        "ground_truth": VERDICT_CONTRADICTED,
        "claim_type": "numerical",
    },
    # 4. Directional Contradiction (Growth vs Decline)
    {
        "id": "TC-04",
        "premise": (
            "Consolidated revenue increased 14% year-over-year, driven by accelerated cloud demand."
        ),
        "claim": "Alphabet's annual revenue experienced a 14% decline year-over-year.",
        "ground_truth": VERDICT_CONTRADICTED,
        "claim_type": "numerical",
    },
    # 5. CapEx Numerical Contradiction
    {
        "id": "TC-05",
        "premise": (
            "Capital expenditures for the fourth quarter totaled $13.1 billion, reflecting technical infrastructure investments."
        ),
        "claim": "Fourth quarter capital expenditures reached 45 billion dollars.",
        "ground_truth": VERDICT_CONTRADICTED,
        "claim_type": "numerical",
    },
    # 6. Share Buyback Entailment
    {
        "id": "TC-06",
        "premise": (
            "The company repurchased and retired $62.2 billion of Class A and Class C shares during the fiscal year."
        ),
        "claim": "Share repurchases totaled $62.2 billion in 2024.",
        "ground_truth": VERDICT_SUPPORTED,
        "claim_type": "numerical",
    },
    # 7. Unverified / Neutral (Corporate Location)
    {
        "id": "TC-07",
        "premise": (
            "Capital expenditures for the fourth quarter reached $13.1 billion, driven by servers and data centers."
        ),
        "claim": "Alphabet decided to open a regional corporate office in Dublin, Ireland.",
        "ground_truth": VERDICT_UNVERIFIED,
        "claim_type": "factual",
    },
    # 8. Unverified / Neutral (Executive Action)
    {
        "id": "TC-08",
        "premise": (
            "Operating income rose to $105.2 billion with disciplined headcount growth across key technical teams."
        ),
        "claim": "Sundar Pichai met with government regulators in Brussels during December.",
        "ground_truth": VERDICT_UNVERIFIED,
        "claim_type": "factual",
    },
    # 9. Free Cash Flow Entailment
    {
        "id": "TC-09",
        "premise": (
            "Free cash flow generated during 2024 was $72.8 billion compared to $69.5 billion in the prior fiscal year."
        ),
        "claim": "Alphabet generated $72.8 billion of free cash flow in 2024.",
        "ground_truth": VERDICT_SUPPORTED,
        "claim_type": "numerical",
    },
    # 10. Unverified / Neutral (Unrelated Market Claim)
    {
        "id": "TC-10",
        "premise": (
            "Free cash flow conversion remained strong at 67% of net operating cash flows."
        ),
        "claim": "The company entered a retail banking partnership in South Korea.",
        "ground_truth": VERDICT_UNVERIFIED,
        "claim_type": "factual",
    },
]


def run_evaluation() -> int:
    print("=" * 82)
    print("VERIFIN 2.0 — Phase 3 NLI Verification Empirical Evaluation")
    print("=" * 82)

    service = NLIService()
    print(f"\n[1] Initializing NLI model: '{service.model_name}' on device '{service.device}'...")
    if not service.is_healthy():
        print(f"ERROR: NLIService is not healthy. Status: {service.status}")
        return 1
    print(f"    Model readiness: {service.status}")

    total = len(FINANCIAL_EVALUATION_FIXTURE)
    print(f"\n[2] Running evaluation on {total} labeled financial test cases...")
    print("-" * 82)

    classes = [VERDICT_SUPPORTED, VERDICT_CONTRADICTED, VERDICT_UNVERIFIED]
    confusion_matrix: Dict[str, Dict[str, int]] = {
        gt: {pred: 0 for pred in classes} for gt in classes
    }

    correct = 0
    predictions: List[dict] = []

    for item in FINANCIAL_EVALUATION_FIXTURE:
        tc_id = item["id"]
        premise = item["premise"]
        claim = item["claim"]
        gt = item["ground_truth"]

        # Premise = Evidence passage, Hypothesis = Claim
        pair = (premise, claim)
        probs = service.predict_probabilities([pair])[0]

        # Determine predicted class based on probabilities
        p_supp = probs[VERDICT_SUPPORTED]
        p_contra = probs[VERDICT_CONTRADICTED]
        p_unver = probs[VERDICT_UNVERIFIED]

        if p_contra >= 0.50 and p_contra > p_supp:
            pred = VERDICT_CONTRADICTED
            conf = p_contra
        elif p_supp >= 0.50 and p_supp > p_contra:
            pred = VERDICT_SUPPORTED
            conf = p_supp
        else:
            pred = VERDICT_UNVERIFIED
            conf = p_unver

        is_correct = pred == gt
        if is_correct:
            correct += 1

        confusion_matrix[gt][pred] += 1

        predictions.append({
            "id": tc_id,
            "claim": claim,
            "gt": gt,
            "pred": pred,
            "conf": conf,
            "p_supp": p_supp,
            "p_contra": p_contra,
            "p_unver": p_unver,
            "correct": is_correct,
        })

        status_tag = "PASS" if is_correct else "FAIL"
        print(f"[{status_tag}] {tc_id} | GT: {gt:<12} | PRED: {pred:<12} | Conf: {conf:.1%}")
        print(f"       Claim: \"{claim}\"")
        print(f"       P(SUPPORTED)={p_supp:.3f} | P(CONTRADICTED)={p_contra:.3f} | P(UNVERIFIED)={p_unver:.3f}")
        print()

    # ── Performance Metrics Calculation ──────────────────────────────────────
    accuracy = correct / total

    metrics: Dict[str, Dict[str, float]] = {}
    for c in classes:
        tp = confusion_matrix[c][c]
        fp = sum(confusion_matrix[other][c] for other in classes if other != c)
        fn = sum(confusion_matrix[c][other] for other in classes if other != c)

        precision = tp / (tp + fp) if (tp + fp) > 0 else 0.0
        recall = tp / (tp + fn) if (tp + fn) > 0 else 0.0
        f1 = (2 * precision * recall) / (precision + recall) if (precision + recall) > 0 else 0.0

        metrics[c] = {
            "precision": precision,
            "recall": recall,
            "f1": f1,
            "support": sum(confusion_matrix[c].values()),
        }

    macro_f1 = sum(m["f1"] for m in metrics.values()) / len(classes)

    print("=" * 82)
    print("EMPIRICAL EVALUATION METRICS REPORT")
    print("=" * 82)
    print(f"Overall Accuracy: {accuracy:.1%} ({correct}/{total} correct)")
    print(f"Macro F1 Score:   {macro_f1:.4f}\n")

    print(f"{'Class':<15} | {'Precision':<10} | {'Recall':<10} | {'F1-Score':<10} | {'Support':<8}")
    print("-" * 62)
    for c in classes:
        m = metrics[c]
        print(
            f"{c:<15} | {m['precision']:<10.4f} | {m['recall']:<10.4f} | {m['f1']:<10.4f} | {int(m['support']):<8}"
        )

    print("\nConfusion Matrix (Rows = Ground Truth, Columns = Predicted):")
    print(f"{'':<16} | {'PRED_SUPP':<10} | {'PRED_CONTRA':<12} | {'PRED_UNVER':<10}")
    print("-" * 55)
    for gt in classes:
        row = confusion_matrix[gt]
        print(
            f"{gt:<16} | {row[VERDICT_SUPPORTED]:<10} | {row[VERDICT_CONTRADICTED]:<12} | {row[VERDICT_UNVERIFIED]:<10}"
        )
    print("=" * 82)

    return 0


if __name__ == "__main__":
    sys.exit(run_evaluation())
