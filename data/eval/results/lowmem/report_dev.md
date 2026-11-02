# Evaluation results - `dev` split

## Overall (3-way verdict)

| System | n | Accuracy [95% CI] | Macro-F1 [95% CI] | Supp. F1 | Contr. F1 | Unver. F1 | p vs ref |
|---|---|---|---|---|---|---|---|
| v4_2/verifin | 354 | 96.3 [94.4, 98.3] | 96.7 [94.5, 98.3] | 96.4 | 95.2 | 98.4 |  |
| v4_2/verifin [raw NLI] | 354 | 78.0 [73.2, 82.5] | 70.6 [64.6, 75.9] | 89.7 | 73.1 | 49.0 | 0.000 |
| lowmem/verifin | 354 | 96.3 [94.4, 98.3] | 96.7 [94.5, 98.3] | 96.4 | 95.2 | 98.4 | 1.000 |
| lowmem/verifin [raw NLI] | 354 | 77.7 [72.9, 82.2] | 70.3 [64.1, 75.5] | 89.7 | 72.6 | 48.5 | 0.000 |

`p vs ref` is an exact McNemar test against `v4_2/verifin` on the same claims.

## Hallucination flagging (claim flagged when verdict is not SUPPORTED)

| System | Target | Precision | Recall | F1 | False-positive rate |
|---|---|---|---|---|---|
| v4_2/verifin | contradicted only | 63.0 | 98.3 | 76.8 | 30.0 |
| v4_2/verifin | any unsupported | 94.7 | 98.9 | 96.8 | 5.8 |
| v4_2/verifin [raw NLI] | contradicted only | 57.1 | 83.5 | 67.8 | 32.6 |
| v4_2/verifin [raw NLI] | any unsupported | 91.0 | 89.0 | 89.9 | 9.2 |
| lowmem/verifin | contradicted only | 63.0 | 98.3 | 76.8 | 30.0 |
| lowmem/verifin | any unsupported | 94.7 | 98.9 | 96.8 | 5.8 |
| lowmem/verifin [raw NLI] | contradicted only | 57.1 | 83.5 | 67.8 | 32.6 |
| lowmem/verifin [raw NLI] | any unsupported | 91.0 | 89.0 | 89.9 | 9.2 |

## Accuracy by error type

| Label / subtype | v4_2/verifin | v4_2/verifin [raw NLI] | lowmem/verifin | lowmem/verifin [raw NLI] |
|---|---|---|---|---|
| CONTRADICTED/direction_flip | 95.7 (n=23) | 95.7 (n=23) | 95.7 (n=23) | 95.7 (n=23) |
| CONTRADICTED/number_change | 98.4 (n=61) | 83.6 (n=61) | 98.4 (n=61) | 83.6 (n=61) |
| CONTRADICTED/period_swap | 100.0 (n=18) | 61.1 (n=18) | 100.0 (n=18) | 55.6 (n=18) |
| CONTRADICTED/unit_swap | 94.7 (n=19) | 57.9 (n=19) | 94.7 (n=19) | 57.9 (n=19) |
| SUPPORTED/paraphrase | 91.1 (n=56) | 91.1 (n=56) | 91.1 (n=56) | 91.1 (n=56) |
| SUPPORTED/verbatim | 95.7 (n=117) | 90.6 (n=117) | 95.7 (n=117) | 90.6 (n=117) |
| UNVERIFIABLE/acquisition | 100.0 (n=8) | 0.0 (n=8) | 100.0 (n=8) | 0.0 (n=8) |
| UNVERIFIABLE/appointment | 100.0 (n=6) | 0.0 (n=6) | 100.0 (n=6) | 0.0 (n=6) |
| UNVERIFIABLE/bond | 100.0 (n=12) | 66.7 (n=12) | 100.0 (n=12) | 66.7 (n=12) |
| UNVERIFIABLE/facility | 100.0 (n=15) | 80.0 (n=15) | 100.0 (n=15) | 80.0 (n=15) |
| UNVERIFIABLE/penalty | 100.0 (n=19) | 21.1 (n=19) | 100.0 (n=19) | 21.1 (n=19) |

## Retrieval, calibration and latency

| System | Recall@k (page) | MRR | ECE | mean s/claim | p95 s/claim | errors |
|---|---|---|---|---|---|---|
| v4_2/verifin | 96.6 | 0.900 | 0.172 | 0.83 | 1.15 | 0 |
| v4_2/verifin [raw NLI] | 96.6 | 0.900 | 0.172 | 0.83 | 1.15 | 0 |
| lowmem/verifin | 96.6 | 0.901 | 0.171 | 0.58 | 0.81 | 0 |
| lowmem/verifin [raw NLI] | 96.6 | 0.901 | 0.171 | 0.58 | 0.81 | 0 |

## Confusion matrices (rows = truth, columns = prediction)

**v4_2/verifin**

| truth \ pred | SUPPORTED | CONTRADICTED | UNVERIFIABLE |
|---|---|---|---|
| SUPPORTED | 163 | 9 | 1 |
| CONTRADICTED | 2 | 118 | 1 |
| UNVERIFIABLE | 0 | 0 | 60 |

**v4_2/verifin [raw NLI]**

| truth \ pred | SUPPORTED | CONTRADICTED | UNVERIFIABLE |
|---|---|---|---|
| SUPPORTED | 157 | 8 | 8 |
| CONTRADICTED | 20 | 95 | 6 |
| UNVERIFIABLE | 0 | 36 | 24 |

**lowmem/verifin**

| truth \ pred | SUPPORTED | CONTRADICTED | UNVERIFIABLE |
|---|---|---|---|
| SUPPORTED | 163 | 9 | 1 |
| CONTRADICTED | 2 | 118 | 1 |
| UNVERIFIABLE | 0 | 0 | 60 |

**lowmem/verifin [raw NLI]**

| truth \ pred | SUPPORTED | CONTRADICTED | UNVERIFIABLE |
|---|---|---|---|
| SUPPORTED | 157 | 8 | 8 |
| CONTRADICTED | 20 | 94 | 7 |
| UNVERIFIABLE | 0 | 36 | 24 |
