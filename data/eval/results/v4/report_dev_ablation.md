# Evaluation results - `dev` split

## Overall (3-way verdict)

| System | n | Accuracy [95% CI] | Macro-F1 [95% CI] | Supp. F1 | Contr. F1 | Unver. F1 | p vs ref |
|---|---|---|---|---|---|---|---|
| verifin | 354 | 96.3 [94.4, 98.3] | 96.7 [94.5, 98.3] | 96.4 | 95.2 | 98.4 |  |
| verifin [raw NLI] | 354 | 78.0 [73.2, 82.5] | 70.6 [64.6, 75.9] | 89.7 | 73.1 | 49.0 | 0.000 |
| verifin:abl=entity_novelty | 354 | 85.3 [81.4, 89.0] | 76.4 [70.6, 81.5] | 96.4 | 82.2 | 50.6 | 0.000 |
| verifin:abl=entity_novelty [raw NLI] | 354 | 78.0 [73.2, 82.5] | 70.6 [64.6, 75.9] | 89.7 | 73.1 | 49.0 | 0.000 |
| verifin:abl=figure_conflict | 354 | 92.1 [89.3, 94.6] | 92.7 [89.8, 95.1] | 92.9 | 88.3 | 96.8 | 0.000 |
| verifin:abl=figure_conflict [raw NLI] | 354 | 78.0 [73.2, 82.5] | 70.6 [64.6, 75.9] | 89.7 | 73.1 | 49.0 | 0.000 |
| verifin:abl=temporal | 354 | 94.6 [92.1, 96.9] | 95.2 [93.0, 97.2] | 94.8 | 92.6 | 98.4 | 0.031 |
| verifin:abl=temporal [raw NLI] | 354 | 78.0 [73.2, 82.5] | 70.6 [64.6, 75.9] | 89.7 | 73.1 | 49.0 | 0.000 |
| verifin:abl=grounded_support | 354 | 94.4 [91.8, 96.6] | 93.9 [91.2, 96.5] | 94.8 | 95.2 | 91.6 | 0.016 |
| verifin:abl=grounded_support [raw NLI] | 354 | 78.0 [73.2, 82.5] | 70.6 [64.6, 75.9] | 89.7 | 73.1 | 49.0 | 0.000 |
| verifin:abl=neighbours | 354 | 95.8 [93.5, 97.7] | 95.6 [92.9, 97.6] | 96.4 | 95.2 | 95.2 | 0.625 |
| verifin:abl=neighbours [raw NLI] | 354 | 78.0 [73.2, 82.5] | 70.6 [64.6, 75.9] | 89.7 | 73.1 | 49.0 | 0.000 |
| verifin:abl=derived_values | 354 | 96.3 [94.4, 98.3] | 96.7 [94.5, 98.3] | 96.4 | 95.2 | 98.4 | 1.000 |
| verifin:abl=derived_values [raw NLI] | 354 | 78.0 [73.2, 82.5] | 70.6 [64.6, 75.9] | 89.7 | 73.1 | 49.0 | 0.000 |
| verifin:abl=table_mismatch | 354 | 96.3 [94.4, 98.3] | 96.7 [94.5, 98.3] | 96.4 | 95.2 | 98.4 | 1.000 |
| verifin:abl=table_mismatch [raw NLI] | 354 | 78.0 [73.2, 82.5] | 70.6 [64.6, 75.9] | 89.7 | 73.1 | 49.0 | 0.000 |

`p vs ref` is an exact McNemar test against `verifin` on the same claims.

## Hallucination flagging (claim flagged when verdict is not SUPPORTED)

| System | Target | Precision | Recall | F1 | False-positive rate |
|---|---|---|---|---|---|
| verifin | contradicted only | 63.0 | 98.3 | 76.8 | 30.0 |
| verifin | any unsupported | 94.7 | 98.9 | 96.8 | 5.8 |
| verifin [raw NLI] | contradicted only | 57.1 | 83.5 | 67.8 | 32.6 |
| verifin [raw NLI] | any unsupported | 91.0 | 89.0 | 89.9 | 9.2 |
| verifin:abl=entity_novelty | contradicted only | 63.0 | 98.3 | 76.8 | 30.0 |
| verifin:abl=entity_novelty | any unsupported | 94.7 | 98.9 | 96.8 | 5.8 |
| verifin:abl=entity_novelty [raw NLI] | contradicted only | 57.1 | 83.5 | 67.8 | 32.6 |
| verifin:abl=entity_novelty [raw NLI] | any unsupported | 91.0 | 89.0 | 89.9 | 9.2 |
| verifin:abl=figure_conflict | contradicted only | 60.3 | 86.8 | 71.2 | 29.6 |
| verifin:abl=figure_conflict | any unsupported | 94.8 | 91.2 | 93.0 | 5.2 |
| verifin:abl=figure_conflict [raw NLI] | contradicted only | 57.1 | 83.5 | 67.8 | 32.6 |
| verifin:abl=figure_conflict [raw NLI] | any unsupported | 91.0 | 89.0 | 89.9 | 9.2 |
| verifin:abl=temporal | contradicted only | 61.7 | 93.4 | 74.3 | 30.0 |
| verifin:abl=temporal | any unsupported | 94.5 | 95.6 | 95.1 | 5.8 |
| verifin:abl=temporal [raw NLI] | contradicted only | 57.1 | 83.5 | 67.8 | 32.6 |
| verifin:abl=temporal [raw NLI] | any unsupported | 91.0 | 89.0 | 89.9 | 9.2 |
| verifin:abl=grounded_support | contradicted only | 61.1 | 100.0 | 75.9 | 33.0 |
| verifin:abl=grounded_support | any unsupported | 91.4 | 100.0 | 95.5 | 9.8 |
| verifin:abl=grounded_support [raw NLI] | contradicted only | 57.1 | 83.5 | 67.8 | 32.6 |
| verifin:abl=grounded_support [raw NLI] | any unsupported | 91.0 | 89.0 | 89.9 | 9.2 |
| verifin:abl=neighbours | contradicted only | 62.7 | 100.0 | 77.1 | 30.9 |
| verifin:abl=neighbours | any unsupported | 93.8 | 100.0 | 96.8 | 6.9 |
| verifin:abl=neighbours [raw NLI] | contradicted only | 57.1 | 83.5 | 67.8 | 32.6 |
| verifin:abl=neighbours [raw NLI] | any unsupported | 91.0 | 89.0 | 89.9 | 9.2 |
| verifin:abl=derived_values | contradicted only | 63.0 | 98.3 | 76.8 | 30.0 |
| verifin:abl=derived_values | any unsupported | 94.7 | 98.9 | 96.8 | 5.8 |
| verifin:abl=derived_values [raw NLI] | contradicted only | 57.1 | 83.5 | 67.8 | 32.6 |
| verifin:abl=derived_values [raw NLI] | any unsupported | 91.0 | 89.0 | 89.9 | 9.2 |
| verifin:abl=table_mismatch | contradicted only | 63.0 | 98.3 | 76.8 | 30.0 |
| verifin:abl=table_mismatch | any unsupported | 94.7 | 98.9 | 96.8 | 5.8 |
| verifin:abl=table_mismatch [raw NLI] | contradicted only | 57.1 | 83.5 | 67.8 | 32.6 |
| verifin:abl=table_mismatch [raw NLI] | any unsupported | 91.0 | 89.0 | 89.9 | 9.2 |

## Accuracy by error type

| Label / subtype | verifin | verifin [raw NLI] | verifin:abl=entity_novelty | verifin:abl=entity_novelty [raw NLI] | verifin:abl=figure_conflict | verifin:abl=figure_conflict [raw NLI] | verifin:abl=temporal | verifin:abl=temporal [raw NLI] | verifin:abl=grounded_support | verifin:abl=grounded_support [raw NLI] | verifin:abl=neighbours | verifin:abl=neighbours [raw NLI] | verifin:abl=derived_values | verifin:abl=derived_values [raw NLI] | verifin:abl=table_mismatch | verifin:abl=table_mismatch [raw NLI] |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| CONTRADICTED/direction_flip | 95.7 (n=23) | 95.7 (n=23) | 95.7 (n=23) | 95.7 (n=23) | 95.7 (n=23) | 95.7 (n=23) | 95.7 (n=23) | 95.7 (n=23) | 95.7 (n=23) | 95.7 (n=23) | 95.7 (n=23) | 95.7 (n=23) | 95.7 (n=23) | 95.7 (n=23) | 95.7 (n=23) | 95.7 (n=23) |
| CONTRADICTED/number_change | 98.4 (n=61) | 83.6 (n=61) | 98.4 (n=61) | 83.6 (n=61) | 83.6 (n=61) | 83.6 (n=61) | 98.4 (n=61) | 83.6 (n=61) | 98.4 (n=61) | 83.6 (n=61) | 96.7 (n=61) | 83.6 (n=61) | 98.4 (n=61) | 83.6 (n=61) | 98.4 (n=61) | 83.6 (n=61) |
| CONTRADICTED/period_swap | 100.0 (n=18) | 61.1 (n=18) | 100.0 (n=18) | 61.1 (n=18) | 100.0 (n=18) | 61.1 (n=18) | 66.7 (n=18) | 61.1 (n=18) | 100.0 (n=18) | 61.1 (n=18) | 100.0 (n=18) | 61.1 (n=18) | 100.0 (n=18) | 61.1 (n=18) | 100.0 (n=18) | 61.1 (n=18) |
| CONTRADICTED/unit_swap | 94.7 (n=19) | 57.9 (n=19) | 94.7 (n=19) | 57.9 (n=19) | 57.9 (n=19) | 57.9 (n=19) | 94.7 (n=19) | 57.9 (n=19) | 94.7 (n=19) | 57.9 (n=19) | 100.0 (n=19) | 57.9 (n=19) | 94.7 (n=19) | 57.9 (n=19) | 94.7 (n=19) | 57.9 (n=19) |
| SUPPORTED/paraphrase | 91.1 (n=56) | 91.1 (n=56) | 91.1 (n=56) | 91.1 (n=56) | 92.9 (n=56) | 91.1 (n=56) | 91.1 (n=56) | 91.1 (n=56) | 89.3 (n=56) | 91.1 (n=56) | 89.3 (n=56) | 91.1 (n=56) | 91.1 (n=56) | 91.1 (n=56) | 91.1 (n=56) | 91.1 (n=56) |
| SUPPORTED/verbatim | 95.7 (n=117) | 90.6 (n=117) | 95.7 (n=117) | 90.6 (n=117) | 95.7 (n=117) | 90.6 (n=117) | 95.7 (n=117) | 90.6 (n=117) | 90.6 (n=117) | 90.6 (n=117) | 94.9 (n=117) | 90.6 (n=117) | 95.7 (n=117) | 90.6 (n=117) | 95.7 (n=117) | 90.6 (n=117) |
| UNVERIFIABLE/acquisition | 100.0 (n=8) | 0.0 (n=8) | 0.0 (n=8) | 0.0 (n=8) | 100.0 (n=8) | 0.0 (n=8) | 100.0 (n=8) | 0.0 (n=8) | 100.0 (n=8) | 0.0 (n=8) | 100.0 (n=8) | 0.0 (n=8) | 100.0 (n=8) | 0.0 (n=8) | 100.0 (n=8) | 0.0 (n=8) |
| UNVERIFIABLE/appointment | 100.0 (n=6) | 0.0 (n=6) | 0.0 (n=6) | 0.0 (n=6) | 100.0 (n=6) | 0.0 (n=6) | 100.0 (n=6) | 0.0 (n=6) | 100.0 (n=6) | 0.0 (n=6) | 100.0 (n=6) | 0.0 (n=6) | 100.0 (n=6) | 0.0 (n=6) | 100.0 (n=6) | 0.0 (n=6) |
| UNVERIFIABLE/bond | 100.0 (n=12) | 66.7 (n=12) | 66.7 (n=12) | 66.7 (n=12) | 100.0 (n=12) | 66.7 (n=12) | 100.0 (n=12) | 66.7 (n=12) | 100.0 (n=12) | 66.7 (n=12) | 100.0 (n=12) | 66.7 (n=12) | 100.0 (n=12) | 66.7 (n=12) | 100.0 (n=12) | 66.7 (n=12) |
| UNVERIFIABLE/facility | 100.0 (n=15) | 80.0 (n=15) | 66.7 (n=15) | 80.0 (n=15) | 100.0 (n=15) | 80.0 (n=15) | 100.0 (n=15) | 80.0 (n=15) | 100.0 (n=15) | 80.0 (n=15) | 100.0 (n=15) | 80.0 (n=15) | 100.0 (n=15) | 80.0 (n=15) | 100.0 (n=15) | 80.0 (n=15) |
| UNVERIFIABLE/penalty | 100.0 (n=19) | 21.1 (n=19) | 15.8 (n=19) | 21.1 (n=19) | 100.0 (n=19) | 21.1 (n=19) | 100.0 (n=19) | 21.1 (n=19) | 100.0 (n=19) | 21.1 (n=19) | 100.0 (n=19) | 21.1 (n=19) | 100.0 (n=19) | 21.1 (n=19) | 100.0 (n=19) | 21.1 (n=19) |

## Retrieval, calibration and latency

| System | Recall@k (page) | MRR | ECE | mean s/claim | p95 s/claim | errors |
|---|---|---|---|---|---|---|
| verifin | 96.6 | 0.900 | 0.172 | 0.76 | 1.02 | 0 |
| verifin [raw NLI] | 96.6 | 0.900 | 0.172 | 0.76 | 1.02 | 0 |
| verifin:abl=entity_novelty | 96.6 | 0.900 | 0.136 | 1.30 | 2.46 | 0 |
| verifin:abl=entity_novelty [raw NLI] | 96.6 | 0.900 | 0.136 | 1.30 | 2.46 | 0 |
| verifin:abl=figure_conflict | 96.6 | 0.900 | 0.193 | 1.32 | 2.37 | 0 |
| verifin:abl=figure_conflict [raw NLI] | 96.6 | 0.900 | 0.193 | 1.32 | 2.37 | 0 |
| verifin:abl=temporal | 96.6 | 0.900 | 0.176 | 1.50 | 2.78 | 0 |
| verifin:abl=temporal [raw NLI] | 96.6 | 0.900 | 0.176 | 1.50 | 2.78 | 0 |
| verifin:abl=grounded_support | 96.6 | 0.900 | 0.176 | 1.64 | 2.77 | 0 |
| verifin:abl=grounded_support [raw NLI] | 96.6 | 0.900 | 0.176 | 1.64 | 2.77 | 0 |
| verifin:abl=neighbours | 96.6 | 0.900 | 0.161 | 1.25 | 2.61 | 0 |
| verifin:abl=neighbours [raw NLI] | 96.6 | 0.900 | 0.161 | 1.25 | 2.61 | 0 |
| verifin:abl=derived_values | 96.6 | 0.900 | 0.172 | 0.92 | 1.36 | 0 |
| verifin:abl=derived_values [raw NLI] | 96.6 | 0.900 | 0.172 | 0.92 | 1.36 | 0 |
| verifin:abl=table_mismatch | 96.6 | 0.900 | 0.172 | 0.98 | 1.50 | 0 |
| verifin:abl=table_mismatch [raw NLI] | 96.6 | 0.900 | 0.172 | 0.98 | 1.50 | 0 |

## Confusion matrices (rows = truth, columns = prediction)

**verifin**

| truth \ pred | SUPPORTED | CONTRADICTED | UNVERIFIABLE |
|---|---|---|---|
| SUPPORTED | 163 | 9 | 1 |
| CONTRADICTED | 2 | 118 | 1 |
| UNVERIFIABLE | 0 | 0 | 60 |

**verifin [raw NLI]**

| truth \ pred | SUPPORTED | CONTRADICTED | UNVERIFIABLE |
|---|---|---|---|
| SUPPORTED | 157 | 8 | 8 |
| CONTRADICTED | 20 | 95 | 6 |
| UNVERIFIABLE | 0 | 36 | 24 |

**verifin:abl=entity_novelty**

| truth \ pred | SUPPORTED | CONTRADICTED | UNVERIFIABLE |
|---|---|---|---|
| SUPPORTED | 163 | 9 | 1 |
| CONTRADICTED | 2 | 118 | 1 |
| UNVERIFIABLE | 0 | 39 | 21 |

**verifin:abl=entity_novelty [raw NLI]**

| truth \ pred | SUPPORTED | CONTRADICTED | UNVERIFIABLE |
|---|---|---|---|
| SUPPORTED | 157 | 8 | 8 |
| CONTRADICTED | 20 | 95 | 6 |
| UNVERIFIABLE | 0 | 36 | 24 |

**verifin:abl=figure_conflict**

| truth \ pred | SUPPORTED | CONTRADICTED | UNVERIFIABLE |
|---|---|---|---|
| SUPPORTED | 164 | 8 | 1 |
| CONTRADICTED | 16 | 102 | 3 |
| UNVERIFIABLE | 0 | 0 | 60 |

**verifin:abl=figure_conflict [raw NLI]**

| truth \ pred | SUPPORTED | CONTRADICTED | UNVERIFIABLE |
|---|---|---|---|
| SUPPORTED | 157 | 8 | 8 |
| CONTRADICTED | 20 | 95 | 6 |
| UNVERIFIABLE | 0 | 36 | 24 |

**verifin:abl=temporal**

| truth \ pred | SUPPORTED | CONTRADICTED | UNVERIFIABLE |
|---|---|---|---|
| SUPPORTED | 163 | 9 | 1 |
| CONTRADICTED | 8 | 112 | 1 |
| UNVERIFIABLE | 0 | 0 | 60 |

**verifin:abl=temporal [raw NLI]**

| truth \ pred | SUPPORTED | CONTRADICTED | UNVERIFIABLE |
|---|---|---|---|
| SUPPORTED | 157 | 8 | 8 |
| CONTRADICTED | 20 | 95 | 6 |
| UNVERIFIABLE | 0 | 36 | 24 |

**verifin:abl=grounded_support**

| truth \ pred | SUPPORTED | CONTRADICTED | UNVERIFIABLE |
|---|---|---|---|
| SUPPORTED | 156 | 9 | 8 |
| CONTRADICTED | 0 | 118 | 3 |
| UNVERIFIABLE | 0 | 0 | 60 |

**verifin:abl=grounded_support [raw NLI]**

| truth \ pred | SUPPORTED | CONTRADICTED | UNVERIFIABLE |
|---|---|---|---|
| SUPPORTED | 157 | 8 | 8 |
| CONTRADICTED | 20 | 95 | 6 |
| UNVERIFIABLE | 0 | 36 | 24 |

**verifin:abl=neighbours**

| truth \ pred | SUPPORTED | CONTRADICTED | UNVERIFIABLE |
|---|---|---|---|
| SUPPORTED | 161 | 9 | 3 |
| CONTRADICTED | 0 | 118 | 3 |
| UNVERIFIABLE | 0 | 0 | 60 |

**verifin:abl=neighbours [raw NLI]**

| truth \ pred | SUPPORTED | CONTRADICTED | UNVERIFIABLE |
|---|---|---|---|
| SUPPORTED | 157 | 8 | 8 |
| CONTRADICTED | 20 | 95 | 6 |
| UNVERIFIABLE | 0 | 36 | 24 |

**verifin:abl=derived_values**

| truth \ pred | SUPPORTED | CONTRADICTED | UNVERIFIABLE |
|---|---|---|---|
| SUPPORTED | 163 | 9 | 1 |
| CONTRADICTED | 2 | 118 | 1 |
| UNVERIFIABLE | 0 | 0 | 60 |

**verifin:abl=derived_values [raw NLI]**

| truth \ pred | SUPPORTED | CONTRADICTED | UNVERIFIABLE |
|---|---|---|---|
| SUPPORTED | 157 | 8 | 8 |
| CONTRADICTED | 20 | 95 | 6 |
| UNVERIFIABLE | 0 | 36 | 24 |

**verifin:abl=table_mismatch**

| truth \ pred | SUPPORTED | CONTRADICTED | UNVERIFIABLE |
|---|---|---|---|
| SUPPORTED | 163 | 9 | 1 |
| CONTRADICTED | 2 | 118 | 1 |
| UNVERIFIABLE | 0 | 0 | 60 |

**verifin:abl=table_mismatch [raw NLI]**

| truth \ pred | SUPPORTED | CONTRADICTED | UNVERIFIABLE |
|---|---|---|---|
| SUPPORTED | 157 | 8 | 8 |
| CONTRADICTED | 20 | 95 | 6 |
| UNVERIFIABLE | 0 | 36 | 24 |
