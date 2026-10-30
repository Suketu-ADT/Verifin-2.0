# Evaluation results - `dev` split

## Overall (3-way verdict)

| System | n | Accuracy [95% CI] | Macro-F1 [95% CI] | Supp. F1 | Contr. F1 | Unver. F1 | p vs ref |
|---|---|---|---|---|---|---|---|
| v5/verifin:e2e | 354 | 94.9 [92.7, 97.2] | 95.5 [93.4, 97.5] | 94.9 | 93.3 | 98.4 |  |
| v5/verifin:e2e [raw NLI] | 354 | 77.1 [72.6, 81.4] | 70.1 [64.1, 75.3] | 88.7 | 72.2 | 49.5 | 0.000 |
| v6/verifin:e2e | 354 | 94.9 [92.7, 97.2] | 95.5 [93.4, 97.5] | 94.9 | 93.3 | 98.4 | 1.000 |
| v6/verifin:e2e [raw NLI] | 354 | 77.1 [72.6, 81.4] | 70.1 [64.1, 75.3] | 88.7 | 72.2 | 49.5 | 0.000 |

`p vs ref` is an exact McNemar test against `v5/verifin:e2e` on the same claims.

## Hallucination flagging (claim flagged when verdict is not SUPPORTED)

| System | Target | Precision | Recall | F1 | False-positive rate |
|---|---|---|---|---|---|
| v5/verifin:e2e | contradicted only | 61.3 | 98.3 | 75.6 | 32.2 |
| v5/verifin:e2e | any unsupported | 92.3 | 98.9 | 95.5 | 8.7 |
| v5/verifin:e2e [raw NLI] | contradicted only | 56.0 | 84.3 | 67.3 | 34.3 |
| v5/verifin:e2e [raw NLI] | any unsupported | 89.0 | 89.5 | 89.3 | 11.6 |
| v6/verifin:e2e | contradicted only | 61.3 | 98.3 | 75.6 | 32.2 |
| v6/verifin:e2e | any unsupported | 92.3 | 98.9 | 95.5 | 8.7 |
| v6/verifin:e2e [raw NLI] | contradicted only | 56.0 | 84.3 | 67.3 | 34.3 |
| v6/verifin:e2e [raw NLI] | any unsupported | 89.0 | 89.5 | 89.3 | 11.6 |

## Accuracy by error type

| Label / subtype | v5/verifin:e2e | v5/verifin:e2e [raw NLI] | v6/verifin:e2e | v6/verifin:e2e [raw NLI] |
|---|---|---|---|---|
| CONTRADICTED/direction_flip | 95.7 (n=23) | 95.7 (n=23) | 95.7 (n=23) | 95.7 (n=23) |
| CONTRADICTED/number_change | 98.4 (n=61) | 83.6 (n=61) | 98.4 (n=61) | 83.6 (n=61) |
| CONTRADICTED/period_swap | 100.0 (n=18) | 66.7 (n=18) | 100.0 (n=18) | 66.7 (n=18) |
| CONTRADICTED/unit_swap | 94.7 (n=19) | 57.9 (n=19) | 94.7 (n=19) | 57.9 (n=19) |
| SUPPORTED/paraphrase | 91.1 (n=56) | 91.1 (n=56) | 91.1 (n=56) | 91.1 (n=56) |
| SUPPORTED/verbatim | 91.5 (n=117) | 87.2 (n=117) | 91.5 (n=117) | 87.2 (n=117) |
| UNVERIFIABLE/acquisition | 100.0 (n=8) | 0.0 (n=8) | 100.0 (n=8) | 0.0 (n=8) |
| UNVERIFIABLE/appointment | 100.0 (n=6) | 0.0 (n=6) | 100.0 (n=6) | 0.0 (n=6) |
| UNVERIFIABLE/bond | 100.0 (n=12) | 66.7 (n=12) | 100.0 (n=12) | 66.7 (n=12) |
| UNVERIFIABLE/facility | 100.0 (n=15) | 80.0 (n=15) | 100.0 (n=15) | 80.0 (n=15) |
| UNVERIFIABLE/penalty | 100.0 (n=19) | 21.1 (n=19) | 100.0 (n=19) | 21.1 (n=19) |

## Retrieval, calibration and latency

| System | Recall@k (page) | MRR | ECE | mean s/claim | p95 s/claim | errors |
|---|---|---|---|---|---|---|
| v5/verifin:e2e | 94.9 | 0.884 | 0.178 | 1.56 | 2.92 | 0 |
| v5/verifin:e2e [raw NLI] | 94.9 | 0.884 | 0.178 | 1.56 | 2.92 | 0 |
| v6/verifin:e2e | 94.9 | 0.884 | 0.178 | 1.05 | 1.76 | 0 |
| v6/verifin:e2e [raw NLI] | 94.9 | 0.884 | 0.178 | 1.05 | 1.76 | 0 |

## Confusion matrices (rows = truth, columns = prediction)

**v5/verifin:e2e**

| truth \ pred | SUPPORTED | CONTRADICTED | UNVERIFIABLE |
|---|---|---|---|
| SUPPORTED | 158 | 14 | 1 |
| CONTRADICTED | 2 | 118 | 1 |
| UNVERIFIABLE | 0 | 0 | 60 |

**v5/verifin:e2e [raw NLI]**

| truth \ pred | SUPPORTED | CONTRADICTED | UNVERIFIABLE |
|---|---|---|---|
| SUPPORTED | 153 | 13 | 7 |
| CONTRADICTED | 19 | 96 | 6 |
| UNVERIFIABLE | 0 | 36 | 24 |

**v6/verifin:e2e**

| truth \ pred | SUPPORTED | CONTRADICTED | UNVERIFIABLE |
|---|---|---|---|
| SUPPORTED | 158 | 14 | 1 |
| CONTRADICTED | 2 | 118 | 1 |
| UNVERIFIABLE | 0 | 0 | 60 |

**v6/verifin:e2e [raw NLI]**

| truth \ pred | SUPPORTED | CONTRADICTED | UNVERIFIABLE |
|---|---|---|---|
| SUPPORTED | 153 | 13 | 7 |
| CONTRADICTED | 19 | 96 | 6 |
| UNVERIFIABLE | 0 | 36 | 24 |
