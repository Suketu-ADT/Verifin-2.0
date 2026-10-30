# Evaluation results - `dev` split

## Overall (3-way verdict)

| System | n | Accuracy [95% CI] | Macro-F1 [95% CI] | Supp. F1 | Contr. F1 | Unver. F1 | p vs ref |
|---|---|---|---|---|---|---|---|
| verifin | 354 | 92.9 [90.1, 95.5] | 93.9 [91.3, 96.1] | 92.8 | 90.5 | 98.4 |  |
| verifin [raw NLI] | 354 | 78.0 [73.2, 82.5] | 70.6 [64.6, 75.9] | 89.7 | 73.1 | 49.0 | 0.000 |
| verifin:agg=legacy | 354 | 77.7 [73.2, 81.9] | 81.3 [77.3, 84.8] | 72.5 | 74.7 | 96.8 | 0.000 |
| verifin:agg=legacy [raw NLI] | 354 | 53.4 [48.0, 58.5] | 48.4 [43.2, 53.4] | 60.3 | 59.6 | 25.4 | 0.000 |

`p vs ref` is an exact McNemar test against `verifin` on the same claims.

## Hallucination flagging (claim flagged when verdict is not SUPPORTED)

| System | Target | Precision | Recall | F1 | False-positive rate |
|---|---|---|---|---|---|
| verifin | contradicted only | 59.6 | 95.0 | 73.2 | 33.5 |
| verifin | any unsupported | 90.7 | 96.7 | 93.6 | 10.4 |
| verifin [raw NLI] | contradicted only | 57.1 | 83.5 | 67.8 | 32.6 |
| verifin [raw NLI] | any unsupported | 91.0 | 89.0 | 89.9 | 9.2 |
| verifin:agg=legacy | contradicted only | 46.5 | 93.4 | 62.1 | 55.8 |
| verifin:agg=legacy | any unsupported | 71.2 | 95.6 | 81.6 | 40.5 |
| verifin:agg=legacy [raw NLI] | contradicted only | 40.8 | 86.0 | 55.3 | 64.8 |
| verifin:agg=legacy [raw NLI] | any unsupported | 64.3 | 90.6 | 75.2 | 52.6 |

## Accuracy by error type

| Label / subtype | verifin | verifin [raw NLI] | verifin:agg=legacy | verifin:agg=legacy [raw NLI] |
|---|---|---|---|---|
| CONTRADICTED/direction_flip | 95.7 (n=23) | 95.7 (n=23) | 100.0 (n=23) | 100.0 (n=23) |
| CONTRADICTED/number_change | 95.1 (n=61) | 83.6 (n=61) | 95.1 (n=61) | 82.0 (n=61) |
| CONTRADICTED/period_swap | 94.4 (n=18) | 61.1 (n=18) | 88.9 (n=18) | 27.8 (n=18) |
| CONTRADICTED/unit_swap | 89.5 (n=19) | 57.9 (n=19) | 78.9 (n=19) | 63.2 (n=19) |
| SUPPORTED/paraphrase | 87.5 (n=56) | 91.1 (n=56) | 60.7 (n=56) | 69.6 (n=56) |
| SUPPORTED/verbatim | 90.6 (n=117) | 90.6 (n=117) | 59.0 (n=117) | 36.8 (n=117) |
| UNVERIFIABLE/acquisition | 100.0 (n=8) | 0.0 (n=8) | 100.0 (n=8) | 12.5 (n=8) |
| UNVERIFIABLE/appointment | 100.0 (n=6) | 0.0 (n=6) | 100.0 (n=6) | 0.0 (n=6) |
| UNVERIFIABLE/bond | 100.0 (n=12) | 66.7 (n=12) | 100.0 (n=12) | 33.3 (n=12) |
| UNVERIFIABLE/facility | 100.0 (n=15) | 80.0 (n=15) | 100.0 (n=15) | 60.0 (n=15) |
| UNVERIFIABLE/penalty | 100.0 (n=19) | 21.1 (n=19) | 100.0 (n=19) | 15.8 (n=19) |

## Retrieval, calibration and latency

| System | Recall@k (page) | MRR | ECE | mean s/claim | p95 s/claim | errors |
|---|---|---|---|---|---|---|
| verifin | 96.6 | 0.900 | 0.171 | 0.76 | 1.03 | 0 |
| verifin [raw NLI] | 96.6 | 0.900 | 0.171 | 0.76 | 1.03 | 0 |
| verifin:agg=legacy | 96.6 | 0.900 | 0.389 | 0.59 | 0.85 | 0 |
| verifin:agg=legacy [raw NLI] | 96.6 | 0.900 | 0.389 | 0.59 | 0.85 | 0 |

## Confusion matrices (rows = truth, columns = prediction)

**verifin**

| truth \ pred | SUPPORTED | CONTRADICTED | UNVERIFIABLE |
|---|---|---|---|
| SUPPORTED | 155 | 17 | 1 |
| CONTRADICTED | 6 | 114 | 1 |
| UNVERIFIABLE | 0 | 0 | 60 |

**verifin [raw NLI]**

| truth \ pred | SUPPORTED | CONTRADICTED | UNVERIFIABLE |
|---|---|---|---|
| SUPPORTED | 157 | 8 | 8 |
| CONTRADICTED | 20 | 95 | 6 |
| UNVERIFIABLE | 0 | 36 | 24 |

**verifin:agg=legacy**

| truth \ pred | SUPPORTED | CONTRADICTED | UNVERIFIABLE |
|---|---|---|---|
| SUPPORTED | 103 | 67 | 3 |
| CONTRADICTED | 8 | 112 | 1 |
| UNVERIFIABLE | 0 | 0 | 60 |

**verifin:agg=legacy [raw NLI]**

| truth \ pred | SUPPORTED | CONTRADICTED | UNVERIFIABLE |
|---|---|---|---|
| SUPPORTED | 82 | 48 | 43 |
| CONTRADICTED | 17 | 90 | 14 |
| UNVERIFIABLE | 0 | 43 | 17 |
