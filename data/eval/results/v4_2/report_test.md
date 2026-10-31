# Evaluation results - `test` split

## Overall (3-way verdict)

| System | n | Accuracy [95% CI] | Macro-F1 [95% CI] | Supp. F1 | Contr. F1 | Unver. F1 | p vs ref |
|---|---|---|---|---|---|---|---|
| final/verifin | 240 | 94.6 [91.7, 97.5] | 95.2 [92.3, 97.7] | 94.3 | 93.6 | 97.5 |  |
| final/verifin [raw NLI] | 240 | 75.8 [70.0, 80.8] | 66.8 [59.2, 73.0] | 88.0 | 73.6 | 38.7 | 0.000 |
| v4_2/verifin | 240 | 94.6 [91.7, 97.5] | 95.2 [92.3, 97.7] | 94.3 | 93.6 | 97.5 | 1.000 |
| v4_2/verifin [raw NLI] | 240 | 75.8 [70.0, 80.8] | 66.8 [59.2, 73.0] | 88.0 | 73.6 | 38.7 | 0.000 |

`p vs ref` is an exact McNemar test against `final/verifin` on the same claims.

## Hallucination flagging (claim flagged when verdict is not SUPPORTED)

| System | Target | Precision | Recall | F1 | False-positive rate |
|---|---|---|---|---|---|
| final/verifin | contradicted only | 64.2 | 96.7 | 77.2 | 32.9 |
| final/verifin | any unsupported | 93.4 | 97.7 | 95.5 | 8.3 |
| final/verifin [raw NLI] | contradicted only | 59.7 | 81.3 | 68.8 | 33.6 |
| final/verifin [raw NLI] | any unsupported | 91.9 | 87.0 | 89.4 | 9.2 |
| v4_2/verifin | contradicted only | 64.2 | 96.7 | 77.2 | 32.9 |
| v4_2/verifin | any unsupported | 93.4 | 97.7 | 95.5 | 8.3 |
| v4_2/verifin [raw NLI] | contradicted only | 59.7 | 81.3 | 68.8 | 33.6 |
| v4_2/verifin [raw NLI] | any unsupported | 91.9 | 87.0 | 89.4 | 9.2 |

## Accuracy by error type

| Label / subtype | final/verifin | final/verifin [raw NLI] | v4_2/verifin | v4_2/verifin [raw NLI] |
|---|---|---|---|---|
| CONTRADICTED/direction_flip | 100.0 (n=8) | 100.0 (n=8) | 100.0 (n=8) | 100.0 (n=8) |
| CONTRADICTED/number_change | 96.3 (n=54) | 85.2 (n=54) | 96.3 (n=54) | 85.2 (n=54) |
| CONTRADICTED/period_swap | 100.0 (n=14) | 78.6 (n=14) | 100.0 (n=14) | 78.6 (n=14) |
| CONTRADICTED/unit_swap | 93.3 (n=15) | 40.0 (n=15) | 93.3 (n=15) | 40.0 (n=15) |
| SUPPORTED/paraphrase | 83.9 (n=31) | 90.3 (n=31) | 83.9 (n=31) | 90.3 (n=31) |
| SUPPORTED/verbatim | 94.9 (n=78) | 91.0 (n=78) | 94.9 (n=78) | 91.0 (n=78) |
| UNVERIFIABLE/acquisition | 100.0 (n=10) | 10.0 (n=10) | 100.0 (n=10) | 10.0 (n=10) |
| UNVERIFIABLE/appointment | 100.0 (n=8) | 25.0 (n=8) | 100.0 (n=8) | 25.0 (n=8) |
| UNVERIFIABLE/bond | 87.5 (n=8) | 25.0 (n=8) | 87.5 (n=8) | 25.0 (n=8) |
| UNVERIFIABLE/facility | 100.0 (n=7) | 57.1 (n=7) | 100.0 (n=7) | 57.1 (n=7) |
| UNVERIFIABLE/penalty | 100.0 (n=7) | 42.9 (n=7) | 100.0 (n=7) | 42.9 (n=7) |

## Retrieval, calibration and latency

| System | Recall@k (page) | MRR | ECE | mean s/claim | p95 s/claim | errors |
|---|---|---|---|---|---|---|
| final/verifin | 95.0 | 0.885 | 0.183 | 1.00 | 1.55 | 0 |
| final/verifin [raw NLI] | 95.0 | 0.885 | 0.183 | 1.00 | 1.55 | 0 |
| v4_2/verifin | 95.0 | 0.885 | 0.183 | 0.72 | 0.99 | 0 |
| v4_2/verifin [raw NLI] | 95.0 | 0.885 | 0.183 | 0.72 | 0.99 | 0 |

## Confusion matrices (rows = truth, columns = prediction)

**final/verifin**

| truth \ pred | SUPPORTED | CONTRADICTED | UNVERIFIABLE |
|---|---|---|---|
| SUPPORTED | 100 | 8 | 1 |
| CONTRADICTED | 3 | 88 | 0 |
| UNVERIFIABLE | 0 | 1 | 39 |

**final/verifin [raw NLI]**

| truth \ pred | SUPPORTED | CONTRADICTED | UNVERIFIABLE |
|---|---|---|---|
| SUPPORTED | 99 | 3 | 7 |
| CONTRADICTED | 17 | 71 | 3 |
| UNVERIFIABLE | 0 | 28 | 12 |

**v4_2/verifin**

| truth \ pred | SUPPORTED | CONTRADICTED | UNVERIFIABLE |
|---|---|---|---|
| SUPPORTED | 100 | 8 | 1 |
| CONTRADICTED | 3 | 88 | 0 |
| UNVERIFIABLE | 0 | 1 | 39 |

**v4_2/verifin [raw NLI]**

| truth \ pred | SUPPORTED | CONTRADICTED | UNVERIFIABLE |
|---|---|---|---|
| SUPPORTED | 99 | 3 | 7 |
| CONTRADICTED | 17 | 71 | 3 |
| UNVERIFIABLE | 0 | 28 | 12 |
