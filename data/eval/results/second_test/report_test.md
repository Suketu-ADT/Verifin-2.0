# Evaluation results - `test` split

## Overall (3-way verdict)

| System | n | Accuracy [95% CI] | Macro-F1 [95% CI] | Supp. F1 | Contr. F1 | Unver. F1 | p vs ref |
|---|---|---|---|---|---|---|---|
| verifin | 240 | 94.6 [91.7, 97.5] | 95.2 [92.3, 97.7] | 94.3 | 93.6 | 97.5 |  |
| verifin [raw NLI] | 240 | 75.8 [70.0, 80.8] | 66.8 [59.2, 73.0] | 88.0 | 73.6 | 38.7 | 0.000 |
| verifin:e2e | 240 | 93.8 [90.4, 96.7] | 94.2 [90.9, 97.0] | 93.8 | 92.6 | 96.3 | 0.625 |
| verifin:e2e [raw NLI] | 240 | 75.0 [69.2, 80.4] | 66.1 [58.6, 72.3] | 87.3 | 73.5 | 37.5 | 0.000 |
| verifin:nli=base | 240 | 93.3 [90.0, 96.2] | 93.7 [90.3, 96.5] | 93.3 | 92.6 | 95.1 | 0.375 |
| verifin:nli=base [raw NLI] | 240 | 78.3 [72.9, 83.8] | 71.0 [64.2, 77.3] | 90.2 | 76.9 | 45.7 | 0.000 |
| number_match | 240 | 81.7 [76.2, 86.7] | 79.7 [73.2, 85.1] | 86.9 | 77.3 | 75.0 | 0.000 |
| llm_norag:qwen2.5:7b | 240 | 20.0 [15.0, 25.0] | 14.6 [10.5, 18.6] | 12.0 | 2.2 | 29.5 | 0.000 |
| llm_rag:qwen2.5:7b | 240 | 83.8 [78.8, 87.9] | 82.2 [76.8, 86.7] | 89.9 | 79.7 | 76.9 | 0.000 |

`p vs ref` is an exact McNemar test against `verifin` on the same claims.

## Hallucination flagging (claim flagged when verdict is not SUPPORTED)

| System | Target | Precision | Recall | F1 | False-positive rate |
|---|---|---|---|---|---|
| verifin | contradicted only | 64.2 | 96.7 | 77.2 | 32.9 |
| verifin | any unsupported | 93.4 | 97.7 | 95.5 | 8.3 |
| verifin [raw NLI] | contradicted only | 59.7 | 81.3 | 68.8 | 33.6 |
| verifin [raw NLI] | any unsupported | 91.9 | 87.0 | 89.4 | 9.2 |
| verifin:e2e | contradicted only | 63.8 | 96.7 | 76.9 | 33.6 |
| verifin:e2e | any unsupported | 92.8 | 97.7 | 95.2 | 9.2 |
| verifin:e2e [raw NLI] | contradicted only | 58.9 | 83.5 | 69.1 | 35.6 |
| verifin:e2e [raw NLI] | any unsupported | 89.9 | 88.5 | 89.2 | 11.9 |
| verifin:nli=base | contradicted only | 63.3 | 96.7 | 76.5 | 34.2 |
| verifin:nli=base | any unsupported | 92.1 | 97.7 | 94.8 | 10.1 |
| verifin:nli=base [raw NLI] | contradicted only | 61.2 | 90.1 | 72.9 | 34.9 |
| verifin:nli=base [raw NLI] | any unsupported | 91.0 | 93.1 | 92.1 | 11.0 |
| number_match | contradicted only | 59.8 | 73.6 | 66.0 | 30.2 |
| number_match | any unsupported | 94.6 | 80.9 | 87.2 | 5.5 |
| llm_norag:qwen2.5:7b | contradicted only | 38.8 | 98.9 | 55.7 | 95.3 |
| llm_norag:qwen2.5:7b | any unsupported | 56.0 | 99.2 | 71.6 | 93.6 |
| llm_rag:qwen2.5:7b | contradicted only | 61.1 | 87.9 | 72.1 | 34.2 |
| llm_rag:qwen2.5:7b | any unsupported | 91.6 | 91.6 | 91.6 | 10.1 |

## Accuracy by error type

| Label / subtype | verifin | verifin [raw NLI] | verifin:e2e | verifin:e2e [raw NLI] | verifin:nli=base | verifin:nli=base [raw NLI] | number_match | llm_norag:qwen2.5:7b | llm_rag:qwen2.5:7b |
|---|---|---|---|---|---|---|---|---|---|
| CONTRADICTED/direction_flip | 100.0 (n=8) | 100.0 (n=8) | 100.0 (n=8) | 100.0 (n=8) | 100.0 (n=8) | 100.0 (n=8) | 0.0 (n=8) | 0.0 (n=8) | 87.5 (n=8) |
| CONTRADICTED/number_change | 96.3 (n=54) | 85.2 (n=54) | 96.3 (n=54) | 87.0 (n=54) | 94.4 (n=54) | 88.9 (n=54) | 94.4 (n=54) | 1.9 (n=54) | 81.5 (n=54) |
| CONTRADICTED/period_swap | 100.0 (n=14) | 78.6 (n=14) | 100.0 (n=14) | 78.6 (n=14) | 100.0 (n=14) | 64.3 (n=14) | 85.7 (n=14) | 0.0 (n=14) | 50.0 (n=14) |
| CONTRADICTED/unit_swap | 93.3 (n=15) | 40.0 (n=15) | 86.7 (n=15) | 40.0 (n=15) | 93.3 (n=15) | 66.7 (n=15) | 0.0 (n=15) | 0.0 (n=15) | 33.3 (n=15) |
| SUPPORTED/paraphrase | 83.9 (n=31) | 90.3 (n=31) | 83.9 (n=31) | 87.1 (n=31) | 80.6 (n=31) | 87.1 (n=31) | 80.6 (n=31) | 9.7 (n=31) | 90.3 (n=31) |
| SUPPORTED/verbatim | 94.9 (n=78) | 91.0 (n=78) | 93.6 (n=78) | 88.5 (n=78) | 93.6 (n=78) | 89.7 (n=78) | 100.0 (n=78) | 5.1 (n=78) | 89.7 (n=78) |
| UNVERIFIABLE/acquisition | 100.0 (n=10) | 10.0 (n=10) | 100.0 (n=10) | 10.0 (n=10) | 100.0 (n=10) | 10.0 (n=10) | 50.0 (n=10) | 100.0 (n=10) | 100.0 (n=10) |
| UNVERIFIABLE/appointment | 100.0 (n=8) | 25.0 (n=8) | 100.0 (n=8) | 25.0 (n=8) | 100.0 (n=8) | 0.0 (n=8) | 75.0 (n=8) | 100.0 (n=8) | 100.0 (n=8) |
| UNVERIFIABLE/bond | 87.5 (n=8) | 25.0 (n=8) | 87.5 (n=8) | 25.0 (n=8) | 87.5 (n=8) | 62.5 (n=8) | 100.0 (n=8) | 100.0 (n=8) | 100.0 (n=8) |
| UNVERIFIABLE/facility | 100.0 (n=7) | 57.1 (n=7) | 100.0 (n=7) | 57.1 (n=7) | 100.0 (n=7) | 71.4 (n=7) | 100.0 (n=7) | 100.0 (n=7) | 100.0 (n=7) |
| UNVERIFIABLE/penalty | 100.0 (n=7) | 42.9 (n=7) | 100.0 (n=7) | 42.9 (n=7) | 100.0 (n=7) | 71.4 (n=7) | 57.1 (n=7) | 100.0 (n=7) | 100.0 (n=7) |

## Retrieval, calibration and latency

| System | Recall@k (page) | MRR | ECE | mean s/claim | p95 s/claim | errors |
|---|---|---|---|---|---|---|
| verifin | 95.0 | 0.885 | 0.183 | 0.78 | 1.10 | 0 |
| verifin [raw NLI] | 95.0 | 0.885 | 0.183 | 0.78 | 1.10 | 0 |
| verifin:e2e | 92.0 | 0.843 | 0.197 | 0.79 | 1.40 | 0 |
| verifin:e2e [raw NLI] | 92.0 | 0.843 | 0.197 | 0.79 | 1.40 | 0 |
| verifin:nli=base | 95.0 | 0.885 | 0.172 | 1.17 | 1.63 | 0 |
| verifin:nli=base [raw NLI] | 95.0 | 0.885 | 0.172 | 1.17 | 1.63 | 0 |
| number_match | 99.5 | 0.972 | - | 0.02 | 0.03 | 0 |
| llm_norag:qwen2.5:7b | - | - | - | 4.42 | 4.94 | 0 |
| llm_rag:qwen2.5:7b | 95.0 | 0.885 | - | 7.48 | 11.30 | 0 |

## Confusion matrices (rows = truth, columns = prediction)

**verifin**

| truth \ pred | SUPPORTED | CONTRADICTED | UNVERIFIABLE |
|---|---|---|---|
| SUPPORTED | 100 | 8 | 1 |
| CONTRADICTED | 3 | 88 | 0 |
| UNVERIFIABLE | 0 | 1 | 39 |

**verifin [raw NLI]**

| truth \ pred | SUPPORTED | CONTRADICTED | UNVERIFIABLE |
|---|---|---|---|
| SUPPORTED | 99 | 3 | 7 |
| CONTRADICTED | 17 | 71 | 3 |
| UNVERIFIABLE | 0 | 28 | 12 |

**verifin:e2e**

| truth \ pred | SUPPORTED | CONTRADICTED | UNVERIFIABLE |
|---|---|---|---|
| SUPPORTED | 99 | 9 | 1 |
| CONTRADICTED | 3 | 87 | 1 |
| UNVERIFIABLE | 0 | 1 | 39 |

**verifin:e2e [raw NLI]**

| truth \ pred | SUPPORTED | CONTRADICTED | UNVERIFIABLE |
|---|---|---|---|
| SUPPORTED | 96 | 5 | 8 |
| CONTRADICTED | 15 | 72 | 4 |
| UNVERIFIABLE | 0 | 28 | 12 |

**verifin:nli=base**

| truth \ pred | SUPPORTED | CONTRADICTED | UNVERIFIABLE |
|---|---|---|---|
| SUPPORTED | 98 | 9 | 2 |
| CONTRADICTED | 3 | 87 | 1 |
| UNVERIFIABLE | 0 | 1 | 39 |

**verifin:nli=base [raw NLI]**

| truth \ pred | SUPPORTED | CONTRADICTED | UNVERIFIABLE |
|---|---|---|---|
| SUPPORTED | 97 | 5 | 7 |
| CONTRADICTED | 9 | 75 | 7 |
| UNVERIFIABLE | 0 | 24 | 16 |

**number_match**

| truth \ pred | SUPPORTED | CONTRADICTED | UNVERIFIABLE |
|---|---|---|---|
| SUPPORTED | 103 | 0 | 6 |
| CONTRADICTED | 24 | 63 | 4 |
| UNVERIFIABLE | 1 | 9 | 30 |

**llm_norag:qwen2.5:7b**

| truth \ pred | SUPPORTED | CONTRADICTED | UNVERIFIABLE |
|---|---|---|---|
| SUPPORTED | 7 | 0 | 102 |
| CONTRADICTED | 1 | 1 | 89 |
| UNVERIFIABLE | 0 | 0 | 40 |

**llm_rag:qwen2.5:7b**

| truth \ pred | SUPPORTED | CONTRADICTED | UNVERIFIABLE |
|---|---|---|---|
| SUPPORTED | 98 | 4 | 7 |
| CONTRADICTED | 11 | 63 | 17 |
| UNVERIFIABLE | 0 | 0 | 40 |
