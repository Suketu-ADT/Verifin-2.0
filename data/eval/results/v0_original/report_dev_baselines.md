# Evaluation results - `dev` split

## Overall (3-way verdict)

| System | n | Accuracy [95% CI] | Macro-F1 [95% CI] | Supp. F1 | Contr. F1 | Unver. F1 | p vs ref |
|---|---|---|---|---|---|---|---|
| verifin | 354 | 42.7 [37.3, 47.5] | 29.4 [25.7, 32.9] | 32.2 | 56.0 | 0.0 |  |
| verifin [raw NLI] | 354 | 54.2 [48.9, 59.3] | 49.1 [43.9, 54.1] | 61.6 | 59.6 | 26.2 | 0.000 |
| verifin_nonum | 354 | 54.2 [48.9, 59.3] | 49.1 [43.9, 54.1] | 61.6 | 59.6 | 26.2 | 0.000 |
| verifin_nonum [raw NLI] | 354 | 54.2 [48.9, 59.3] | 49.1 [43.9, 54.1] | 61.6 | 59.6 | 26.2 | 0.000 |
| number_match | 354 | 78.2 [74.0, 82.5] | 74.5 [69.1, 79.4] | 86.7 | 66.7 | 70.3 | 0.000 |
| verifin:dense | 354 | 41.8 [36.4, 46.6] | 29.0 [25.1, 32.9] | 28.3 | 56.2 | 2.4 | 0.581 |
| verifin:dense [raw NLI] | 354 | 48.3 [42.9, 53.4] | 42.6 [37.5, 47.3] | 54.3 | 57.5 | 16.1 | 0.045 |
| verifin:bm25 | 354 | 46.0 [40.4, 51.1] | 36.6 [31.1, 42.0] | 35.5 | 57.4 | 16.9 | 0.008 |
| verifin:bm25 [raw NLI] | 354 | 54.8 [49.7, 60.2] | 50.7 [45.5, 55.9] | 59.6 | 59.9 | 32.6 | 0.000 |
| verifin:hybrid:k5 | 354 | 40.1 [34.7, 44.6] | 26.4 [22.8, 29.8] | 24.8 | 54.5 | 0.0 | 0.012 |
| verifin:hybrid:k5 [raw NLI] | 354 | 49.4 [43.8, 54.2] | 42.4 [37.2, 47.0] | 54.5 | 56.6 | 16.1 | 0.013 |

`p vs ref` is an exact McNemar test against `verifin` on the same claims.

## Hallucination flagging (claim flagged when verdict is not SUPPORTED)

| System | Target | Precision | Recall | F1 | False-positive rate |
|---|---|---|---|---|---|
| verifin | contradicted only | 37.0 | 96.7 | 53.5 | 85.4 |
| verifin | any unsupported | 56.0 | 97.8 | 71.2 | 80.3 |
| verifin [raw NLI] | contradicted only | 41.0 | 85.1 | 55.4 | 63.5 |
| verifin [raw NLI] | any unsupported | 64.9 | 90.1 | 75.5 | 50.9 |
| verifin_nonum | contradicted only | 41.0 | 85.1 | 55.4 | 63.5 |
| verifin_nonum | any unsupported | 64.9 | 90.1 | 75.5 | 50.9 |
| verifin_nonum [raw NLI] | contradicted only | 41.0 | 85.1 | 55.4 | 63.5 |
| verifin_nonum [raw NLI] | any unsupported | 64.9 | 90.1 | 75.5 | 50.9 |
| number_match | contradicted only | 56.2 | 63.6 | 59.7 | 25.8 |
| number_match | any unsupported | 97.1 | 73.5 | 83.6 | 2.3 |
| verifin:dense | contradicted only | 36.6 | 97.5 | 53.3 | 87.6 |
| verifin:dense | any unsupported | 55.3 | 98.3 | 70.8 | 83.2 |
| verifin:dense [raw NLI] | contradicted only | 39.4 | 87.6 | 54.4 | 70.0 |
| verifin:dense [raw NLI] | any unsupported | 61.7 | 91.7 | 73.8 | 59.5 |
| verifin:bm25 | contradicted only | 37.7 | 97.5 | 54.4 | 83.7 |
| verifin:bm25 | any unsupported | 56.9 | 98.3 | 72.1 | 78.0 |
| verifin:bm25 [raw NLI] | contradicted only | 40.1 | 83.5 | 54.2 | 64.8 |
| verifin:bm25 [raw NLI] | any unsupported | 63.9 | 89.0 | 74.4 | 52.6 |
| verifin:hybrid:k5 | contradicted only | 36.0 | 96.7 | 52.5 | 89.3 |
| verifin:hybrid:k5 | any unsupported | 54.5 | 97.8 | 70.0 | 85.5 |
| verifin:hybrid:k5 [raw NLI] | contradicted only | 39.6 | 88.4 | 54.7 | 70.0 |
| verifin:hybrid:k5 [raw NLI] | any unsupported | 61.9 | 92.3 | 74.1 | 59.5 |

## Accuracy by error type

| Label / subtype | verifin | verifin [raw NLI] | verifin_nonum | verifin_nonum [raw NLI] | number_match | verifin:dense | verifin:dense [raw NLI] | verifin:bm25 | verifin:bm25 [raw NLI] | verifin:hybrid:k5 | verifin:hybrid:k5 [raw NLI] |
|---|---|---|---|---|---|---|---|---|---|---|---|
| CONTRADICTED/direction_flip | 100.0 (n=23) | 100.0 (n=23) | 100.0 (n=23) | 100.0 (n=23) | 0.0 (n=23) | 95.7 (n=23) | 95.7 (n=23) | 100.0 (n=23) | 100.0 (n=23) | 100.0 (n=23) | 100.0 (n=23) |
| CONTRADICTED/number_change | 98.4 (n=61) | 82.0 (n=61) | 82.0 (n=61) | 82.0 (n=61) | 93.4 (n=61) | 100.0 (n=61) | 80.3 (n=61) | 98.4 (n=61) | 80.3 (n=61) | 98.4 (n=61) | 86.9 (n=61) |
| CONTRADICTED/period_swap | 100.0 (n=18) | 27.8 (n=18) | 27.8 (n=18) | 27.8 (n=18) | 66.7 (n=18) | 100.0 (n=18) | 27.8 (n=18) | 100.0 (n=18) | 44.4 (n=18) | 100.0 (n=18) | 33.3 (n=18) |
| CONTRADICTED/unit_swap | 84.2 (n=19) | 63.2 (n=19) | 63.2 (n=19) | 63.2 (n=19) | 0.0 (n=19) | 89.5 (n=19) | 73.7 (n=19) | 89.5 (n=19) | 57.9 (n=19) | 84.2 (n=19) | 73.7 (n=19) |
| SUPPORTED/paraphrase | 32.1 (n=56) | 71.4 (n=56) | 71.4 (n=56) | 71.4 (n=56) | 92.9 (n=56) | 23.2 (n=56) | 53.6 (n=56) | 35.7 (n=56) | 73.2 (n=56) | 26.8 (n=56) | 62.5 (n=56) |
| SUPPORTED/verbatim | 13.7 (n=117) | 38.5 (n=117) | 38.5 (n=117) | 38.5 (n=117) | 100.0 (n=117) | 13.7 (n=117) | 34.2 (n=117) | 15.4 (n=117) | 35.0 (n=117) | 8.5 (n=117) | 29.9 (n=117) |
| UNVERIFIABLE/acquisition | 0.0 (n=8) | 12.5 (n=8) | 12.5 (n=8) | 12.5 (n=8) | 37.5 (n=8) | 12.5 (n=8) | 25.0 (n=8) | 0.0 (n=8) | 12.5 (n=8) | 0.0 (n=8) | 0.0 (n=8) |
| UNVERIFIABLE/appointment | 0.0 (n=6) | 0.0 (n=6) | 0.0 (n=6) | 0.0 (n=6) | 50.0 (n=6) | 0.0 (n=6) | 0.0 (n=6) | 0.0 (n=6) | 0.0 (n=6) | 0.0 (n=6) | 0.0 (n=6) |
| UNVERIFIABLE/bond | 0.0 (n=12) | 33.3 (n=12) | 33.3 (n=12) | 33.3 (n=12) | 66.7 (n=12) | 0.0 (n=12) | 33.3 (n=12) | 0.0 (n=12) | 33.3 (n=12) | 0.0 (n=12) | 25.0 (n=12) |
| UNVERIFIABLE/facility | 0.0 (n=15) | 60.0 (n=15) | 60.0 (n=15) | 60.0 (n=15) | 100.0 (n=15) | 0.0 (n=15) | 33.3 (n=15) | 13.3 (n=15) | 66.7 (n=15) | 0.0 (n=15) | 26.7 (n=15) |
| UNVERIFIABLE/penalty | 0.0 (n=19) | 15.8 (n=19) | 15.8 (n=19) | 15.8 (n=19) | 52.6 (n=19) | 0.0 (n=19) | 0.0 (n=19) | 26.3 (n=19) | 31.6 (n=19) | 0.0 (n=19) | 10.5 (n=19) |

## Retrieval, calibration and latency

| System | Recall@k (page) | MRR | ECE | mean s/claim | p95 s/claim | errors |
|---|---|---|---|---|---|---|
| verifin | 96.6 | 0.900 | 0.400 | 0.63 | 0.87 | 0 |
| verifin [raw NLI] | 96.6 | 0.900 | 0.400 | 0.63 | 0.87 | 0 |
| verifin_nonum | 96.6 | 0.900 | 0.400 | 0.57 | 0.85 | 0 |
| verifin_nonum [raw NLI] | 96.6 | 0.900 | 0.400 | 0.57 | 0.85 | 0 |
| number_match | 99.0 | 0.981 | - | 0.03 | 0.04 | 0 |
| verifin:dense | 88.8 | 0.803 | 0.455 | 0.53 | 0.72 | 0 |
| verifin:dense [raw NLI] | 88.8 | 0.803 | 0.455 | 0.53 | 0.72 | 0 |
| verifin:bm25 | 99.0 | 0.981 | 0.404 | 0.34 | 0.51 | 0 |
| verifin:bm25 [raw NLI] | 99.0 | 0.981 | 0.404 | 0.34 | 0.51 | 0 |
| verifin:hybrid:k5 | 97.6 | 0.902 | 0.453 | 0.83 | 1.16 | 0 |
| verifin:hybrid:k5 [raw NLI] | 97.6 | 0.902 | 0.453 | 0.83 | 1.16 | 0 |

## Confusion matrices (rows = truth, columns = prediction)

**verifin**

| truth \ pred | SUPPORTED | CONTRADICTED | UNVERIFIABLE |
|---|---|---|---|
| SUPPORTED | 34 | 120 | 19 |
| CONTRADICTED | 4 | 117 | 0 |
| UNVERIFIABLE | 0 | 60 | 0 |

**verifin [raw NLI]**

| truth \ pred | SUPPORTED | CONTRADICTED | UNVERIFIABLE |
|---|---|---|---|
| SUPPORTED | 85 | 48 | 40 |
| CONTRADICTED | 18 | 90 | 13 |
| UNVERIFIABLE | 0 | 43 | 17 |

**verifin_nonum**

| truth \ pred | SUPPORTED | CONTRADICTED | UNVERIFIABLE |
|---|---|---|---|
| SUPPORTED | 85 | 48 | 40 |
| CONTRADICTED | 18 | 90 | 13 |
| UNVERIFIABLE | 0 | 43 | 17 |

**verifin_nonum [raw NLI]**

| truth \ pred | SUPPORTED | CONTRADICTED | UNVERIFIABLE |
|---|---|---|---|
| SUPPORTED | 85 | 48 | 40 |
| CONTRADICTED | 18 | 90 | 13 |
| UNVERIFIABLE | 0 | 43 | 17 |

**number_match**

| truth \ pred | SUPPORTED | CONTRADICTED | UNVERIFIABLE |
|---|---|---|---|
| SUPPORTED | 169 | 0 | 4 |
| CONTRADICTED | 44 | 69 | 8 |
| UNVERIFIABLE | 4 | 17 | 39 |

**verifin:dense**

| truth \ pred | SUPPORTED | CONTRADICTED | UNVERIFIABLE |
|---|---|---|---|
| SUPPORTED | 29 | 122 | 22 |
| CONTRADICTED | 3 | 118 | 0 |
| UNVERIFIABLE | 0 | 59 | 1 |

**verifin:dense [raw NLI]**

| truth \ pred | SUPPORTED | CONTRADICTED | UNVERIFIABLE |
|---|---|---|---|
| SUPPORTED | 70 | 53 | 50 |
| CONTRADICTED | 15 | 90 | 16 |
| UNVERIFIABLE | 0 | 49 | 11 |

**verifin:bm25**

| truth \ pred | SUPPORTED | CONTRADICTED | UNVERIFIABLE |
|---|---|---|---|
| SUPPORTED | 38 | 119 | 16 |
| CONTRADICTED | 3 | 118 | 0 |
| UNVERIFIABLE | 0 | 53 | 7 |

**verifin:bm25 [raw NLI]**

| truth \ pred | SUPPORTED | CONTRADICTED | UNVERIFIABLE |
|---|---|---|---|
| SUPPORTED | 82 | 53 | 38 |
| CONTRADICTED | 20 | 91 | 10 |
| UNVERIFIABLE | 0 | 39 | 21 |

**verifin:hybrid:k5**

| truth \ pred | SUPPORTED | CONTRADICTED | UNVERIFIABLE |
|---|---|---|---|
| SUPPORTED | 25 | 131 | 17 |
| CONTRADICTED | 4 | 117 | 0 |
| UNVERIFIABLE | 0 | 60 | 0 |

**verifin:hybrid:k5 [raw NLI]**

| truth \ pred | SUPPORTED | CONTRADICTED | UNVERIFIABLE |
|---|---|---|---|
| SUPPORTED | 70 | 71 | 32 |
| CONTRADICTED | 14 | 96 | 11 |
| UNVERIFIABLE | 0 | 51 | 9 |
