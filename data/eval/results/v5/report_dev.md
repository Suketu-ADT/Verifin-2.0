# Evaluation results - `dev` split

## Overall (3-way verdict)

| System | n | Accuracy [95% CI] | Macro-F1 [95% CI] | Supp. F1 | Contr. F1 | Unver. F1 | p vs ref |
|---|---|---|---|---|---|---|---|
| verifin:rerank | 354 | 96.6 [94.6, 98.3] | 96.9 [95.0, 98.5] | 96.8 | 95.6 | 98.3 |  |
| verifin:rerank [raw NLI] | 354 | 78.5 [74.0, 83.1] | 69.3 [63.2, 74.9] | 91.0 | 73.7 | 43.2 | 0.000 |

`p vs ref` is an exact McNemar test against `verifin:rerank` on the same claims.

## Hallucination flagging (claim flagged when verdict is not SUPPORTED)

| System | Target | Precision | Recall | F1 | False-positive rate |
|---|---|---|---|---|---|
| verifin:rerank | contradicted only | 63.3 | 98.3 | 77.0 | 29.6 |
| verifin:rerank | any unsupported | 95.2 | 98.9 | 97.0 | 5.2 |
| verifin:rerank [raw NLI] | contradicted only | 58.4 | 83.5 | 68.7 | 30.9 |
| verifin:rerank [raw NLI] | any unsupported | 93.1 | 89.0 | 91.0 | 6.9 |

## Accuracy by error type

| Label / subtype | verifin:rerank | verifin:rerank [raw NLI] |
|---|---|---|
| CONTRADICTED/direction_flip | 100.0 (n=23) | 100.0 (n=23) |
| CONTRADICTED/number_change | 98.4 (n=61) | 86.9 (n=61) |
| CONTRADICTED/period_swap | 100.0 (n=18) | 61.1 (n=18) |
| CONTRADICTED/unit_swap | 94.7 (n=19) | 57.9 (n=19) |
| SUPPORTED/paraphrase | 94.6 (n=56) | 98.2 (n=56) |
| SUPPORTED/verbatim | 94.9 (n=117) | 90.6 (n=117) |
| UNVERIFIABLE/acquisition | 87.5 (n=8) | 0.0 (n=8) |
| UNVERIFIABLE/appointment | 100.0 (n=6) | 0.0 (n=6) |
| UNVERIFIABLE/bond | 100.0 (n=12) | 33.3 (n=12) |
| UNVERIFIABLE/facility | 100.0 (n=15) | 66.7 (n=15) |
| UNVERIFIABLE/penalty | 100.0 (n=19) | 26.3 (n=19) |

## Retrieval, calibration and latency

| System | Recall@k (page) | MRR | ECE | mean s/claim | p95 s/claim | errors |
|---|---|---|---|---|---|---|
| verifin:rerank | 98.0 | 0.971 | 0.169 | 2.42 | 4.21 | 0 |
| verifin:rerank [raw NLI] | 98.0 | 0.971 | 0.169 | 2.42 | 4.21 | 0 |

## Confusion matrices (rows = truth, columns = prediction)

**verifin:rerank**

| truth \ pred | SUPPORTED | CONTRADICTED | UNVERIFIABLE |
|---|---|---|---|
| SUPPORTED | 164 | 8 | 1 |
| CONTRADICTED | 2 | 119 | 0 |
| UNVERIFIABLE | 0 | 1 | 59 |

**verifin:rerank [raw NLI]**

| truth \ pred | SUPPORTED | CONTRADICTED | UNVERIFIABLE |
|---|---|---|---|
| SUPPORTED | 161 | 6 | 6 |
| CONTRADICTED | 20 | 98 | 3 |
| UNVERIFIABLE | 0 | 41 | 19 |
