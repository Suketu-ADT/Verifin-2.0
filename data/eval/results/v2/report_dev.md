# Evaluation results - `dev` split

## Overall (3-way verdict)

| System | n | Accuracy [95% CI] | Macro-F1 [95% CI] | Supp. F1 | Contr. F1 | Unver. F1 | p vs ref |
|---|---|---|---|---|---|---|---|
| v0_original/verifin | 354 | 42.7 [37.3, 47.5] | 29.4 [25.7, 32.9] | 32.2 | 56.0 | 0.0 |  |
| v0_original/verifin [raw NLI] | 354 | 54.2 [48.9, 59.3] | 49.1 [43.9, 54.1] | 61.6 | 59.6 | 26.2 | 0.000 |
| v1/verifin | 354 | 92.9 [90.1, 95.5] | 93.9 [91.3, 96.1] | 92.8 | 90.5 | 98.4 | 0.000 |
| v1/verifin [raw NLI] | 354 | 78.0 [73.2, 82.5] | 70.6 [64.6, 75.9] | 89.7 | 73.1 | 49.0 | 0.000 |
| v2/verifin | 354 | 92.7 [89.8, 95.5] | 93.0 [90.0, 95.5] | 93.1 | 90.8 | 95.2 | 0.000 |
| v2/verifin [raw NLI] | 354 | 78.0 [73.2, 82.5] | 70.6 [64.6, 75.9] | 89.7 | 73.1 | 49.0 | 0.000 |

`p vs ref` is an exact McNemar test against `v0_original/verifin` on the same claims.

## Hallucination flagging (claim flagged when verdict is not SUPPORTED)

| System | Target | Precision | Recall | F1 | False-positive rate |
|---|---|---|---|---|---|
| v0_original/verifin | contradicted only | 37.0 | 96.7 | 53.5 | 85.4 |
| v0_original/verifin | any unsupported | 56.0 | 97.8 | 71.2 | 80.3 |
| v0_original/verifin [raw NLI] | contradicted only | 41.0 | 85.1 | 55.4 | 63.5 |
| v0_original/verifin [raw NLI] | any unsupported | 64.9 | 90.1 | 75.5 | 50.9 |
| v1/verifin | contradicted only | 59.6 | 95.0 | 73.2 | 33.5 |
| v1/verifin | any unsupported | 90.7 | 96.7 | 93.6 | 10.4 |
| v1/verifin [raw NLI] | contradicted only | 57.1 | 83.5 | 67.8 | 32.6 |
| v1/verifin [raw NLI] | any unsupported | 91.0 | 89.0 | 89.9 | 9.2 |
| v2/verifin | contradicted only | 59.8 | 95.9 | 73.7 | 33.5 |
| v2/verifin | any unsupported | 90.7 | 97.2 | 93.9 | 10.4 |
| v2/verifin [raw NLI] | contradicted only | 57.1 | 83.5 | 67.8 | 32.6 |
| v2/verifin [raw NLI] | any unsupported | 91.0 | 89.0 | 89.9 | 9.2 |

## Accuracy by error type

| Label / subtype | v0_original/verifin | v0_original/verifin [raw NLI] | v1/verifin | v1/verifin [raw NLI] | v2/verifin | v2/verifin [raw NLI] |
|---|---|---|---|---|---|---|
| CONTRADICTED/direction_flip | 100.0 (n=23) | 100.0 (n=23) | 95.7 (n=23) | 95.7 (n=23) | 95.7 (n=23) | 95.7 (n=23) |
| CONTRADICTED/number_change | 98.4 (n=61) | 82.0 (n=61) | 95.1 (n=61) | 83.6 (n=61) | 93.4 (n=61) | 83.6 (n=61) |
| CONTRADICTED/period_swap | 100.0 (n=18) | 27.8 (n=18) | 94.4 (n=18) | 61.1 (n=18) | 100.0 (n=18) | 61.1 (n=18) |
| CONTRADICTED/unit_swap | 84.2 (n=19) | 63.2 (n=19) | 89.5 (n=19) | 57.9 (n=19) | 84.2 (n=19) | 57.9 (n=19) |
| SUPPORTED/paraphrase | 32.1 (n=56) | 71.4 (n=56) | 87.5 (n=56) | 91.1 (n=56) | 85.7 (n=56) | 91.1 (n=56) |
| SUPPORTED/verbatim | 13.7 (n=117) | 38.5 (n=117) | 90.6 (n=117) | 90.6 (n=117) | 91.5 (n=117) | 90.6 (n=117) |
| UNVERIFIABLE/acquisition | 0.0 (n=8) | 12.5 (n=8) | 100.0 (n=8) | 0.0 (n=8) | 100.0 (n=8) | 0.0 (n=8) |
| UNVERIFIABLE/appointment | 0.0 (n=6) | 0.0 (n=6) | 100.0 (n=6) | 0.0 (n=6) | 100.0 (n=6) | 0.0 (n=6) |
| UNVERIFIABLE/bond | 0.0 (n=12) | 33.3 (n=12) | 100.0 (n=12) | 66.7 (n=12) | 100.0 (n=12) | 66.7 (n=12) |
| UNVERIFIABLE/facility | 0.0 (n=15) | 60.0 (n=15) | 100.0 (n=15) | 80.0 (n=15) | 100.0 (n=15) | 80.0 (n=15) |
| UNVERIFIABLE/penalty | 0.0 (n=19) | 15.8 (n=19) | 100.0 (n=19) | 21.1 (n=19) | 100.0 (n=19) | 21.1 (n=19) |

## Retrieval, calibration and latency

| System | Recall@k (page) | MRR | ECE | mean s/claim | p95 s/claim | errors |
|---|---|---|---|---|---|---|
| v0_original/verifin | 96.6 | 0.900 | 0.400 | 0.63 | 0.87 | 0 |
| v0_original/verifin [raw NLI] | 96.6 | 0.900 | 0.400 | 0.63 | 0.87 | 0 |
| v1/verifin | 96.6 | 0.900 | 0.171 | 0.76 | 1.03 | 0 |
| v1/verifin [raw NLI] | 96.6 | 0.900 | 0.171 | 0.76 | 1.03 | 0 |
| v2/verifin | 96.6 | 0.900 | 0.173 | 0.74 | 1.01 | 0 |
| v2/verifin [raw NLI] | 96.6 | 0.900 | 0.173 | 0.74 | 1.01 | 0 |

## Confusion matrices (rows = truth, columns = prediction)

**v0_original/verifin**

| truth \ pred | SUPPORTED | CONTRADICTED | UNVERIFIABLE |
|---|---|---|---|
| SUPPORTED | 34 | 120 | 19 |
| CONTRADICTED | 4 | 117 | 0 |
| UNVERIFIABLE | 0 | 60 | 0 |

**v0_original/verifin [raw NLI]**

| truth \ pred | SUPPORTED | CONTRADICTED | UNVERIFIABLE |
|---|---|---|---|
| SUPPORTED | 85 | 48 | 40 |
| CONTRADICTED | 18 | 90 | 13 |
| UNVERIFIABLE | 0 | 43 | 17 |

**v1/verifin**

| truth \ pred | SUPPORTED | CONTRADICTED | UNVERIFIABLE |
|---|---|---|---|
| SUPPORTED | 155 | 17 | 1 |
| CONTRADICTED | 6 | 114 | 1 |
| UNVERIFIABLE | 0 | 0 | 60 |

**v1/verifin [raw NLI]**

| truth \ pred | SUPPORTED | CONTRADICTED | UNVERIFIABLE |
|---|---|---|---|
| SUPPORTED | 157 | 8 | 8 |
| CONTRADICTED | 20 | 95 | 6 |
| UNVERIFIABLE | 0 | 36 | 24 |

**v2/verifin**

| truth \ pred | SUPPORTED | CONTRADICTED | UNVERIFIABLE |
|---|---|---|---|
| SUPPORTED | 155 | 15 | 3 |
| CONTRADICTED | 5 | 113 | 3 |
| UNVERIFIABLE | 0 | 0 | 60 |

**v2/verifin [raw NLI]**

| truth \ pred | SUPPORTED | CONTRADICTED | UNVERIFIABLE |
|---|---|---|---|
| SUPPORTED | 157 | 8 | 8 |
| CONTRADICTED | 20 | 95 | 6 |
| UNVERIFIABLE | 0 | 36 | 24 |
