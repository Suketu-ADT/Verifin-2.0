# Evaluation results - `dev` split

## Overall (3-way verdict)

| System | n | Accuracy [95% CI] | Macro-F1 [95% CI] | Supp. F1 | Contr. F1 | Unver. F1 | p vs ref |
|---|---|---|---|---|---|---|---|
| v4/verifin | 354 | 96.3 [94.4, 98.3] | 96.7 [94.5, 98.3] | 96.4 | 95.2 | 98.4 |  |
| v4/verifin [raw NLI] | 354 | 78.0 [73.2, 82.5] | 70.6 [64.6, 75.9] | 89.7 | 73.1 | 49.0 | 0.000 |
| baselines/llm_norag:qwen2.5:7b | 354 | 19.5 [15.5, 24.0] | 13.7 [10.6, 17.0] | 9.4 | 1.6 | 29.9 | 0.000 |
| baselines/llm_rag:qwen2.5:7b | 354 | 84.2 [80.5, 87.9] | 82.9 [78.7, 86.8] | 89.0 | 77.5 | 82.2 | 0.000 |

`p vs ref` is an exact McNemar test against `v4/verifin` on the same claims.

## Hallucination flagging (claim flagged when verdict is not SUPPORTED)

| System | Target | Precision | Recall | F1 | False-positive rate |
|---|---|---|---|---|---|
| v4/verifin | contradicted only | 63.0 | 98.3 | 76.8 | 30.0 |
| v4/verifin | any unsupported | 94.7 | 98.9 | 96.8 | 5.8 |
| v4/verifin [raw NLI] | contradicted only | 57.1 | 83.5 | 67.8 | 32.6 |
| v4/verifin [raw NLI] | any unsupported | 91.0 | 89.0 | 89.9 | 9.2 |
| baselines/llm_norag:qwen2.5:7b | contradicted only | 33.4 | 92.6 | 49.1 | 95.7 |
| baselines/llm_norag:qwen2.5:7b | any unsupported | 51.0 | 94.5 | 66.3 | 94.8 |
| baselines/llm_rag:qwen2.5:7b | contradicted only | 56.3 | 81.0 | 66.4 | 32.6 |
| baselines/llm_rag:qwen2.5:7b | any unsupported | 90.8 | 87.3 | 89.0 | 9.2 |

## Accuracy by error type

| Label / subtype | v4/verifin | v4/verifin [raw NLI] | baselines/llm_norag:qwen2.5:7b | baselines/llm_rag:qwen2.5:7b |
|---|---|---|---|---|
| CONTRADICTED/direction_flip | 95.7 (n=23) | 95.7 (n=23) | 4.3 (n=23) | 91.3 (n=23) |
| CONTRADICTED/number_change | 98.4 (n=61) | 83.6 (n=61) | 0.0 (n=61) | 82.0 (n=61) |
| CONTRADICTED/period_swap | 100.0 (n=18) | 61.1 (n=18) | 0.0 (n=18) | 38.9 (n=18) |
| CONTRADICTED/unit_swap | 94.7 (n=19) | 57.9 (n=19) | 0.0 (n=19) | 15.8 (n=19) |
| SUPPORTED/paraphrase | 91.1 (n=56) | 91.1 (n=56) | 7.1 (n=56) | 91.1 (n=56) |
| SUPPORTED/verbatim | 95.7 (n=117) | 90.6 (n=117) | 4.3 (n=117) | 90.6 (n=117) |
| UNVERIFIABLE/acquisition | 100.0 (n=8) | 0.0 (n=8) | 87.5 (n=8) | 100.0 (n=8) |
| UNVERIFIABLE/appointment | 100.0 (n=6) | 0.0 (n=6) | 100.0 (n=6) | 100.0 (n=6) |
| UNVERIFIABLE/bond | 100.0 (n=12) | 66.7 (n=12) | 100.0 (n=12) | 100.0 (n=12) |
| UNVERIFIABLE/facility | 100.0 (n=15) | 80.0 (n=15) | 100.0 (n=15) | 100.0 (n=15) |
| UNVERIFIABLE/penalty | 100.0 (n=19) | 21.1 (n=19) | 100.0 (n=19) | 100.0 (n=19) |

## Retrieval, calibration and latency

| System | Recall@k (page) | MRR | ECE | mean s/claim | p95 s/claim | errors |
|---|---|---|---|---|---|---|
| v4/verifin | 96.6 | 0.900 | 0.172 | 0.76 | 1.02 | 0 |
| v4/verifin [raw NLI] | 96.6 | 0.900 | 0.172 | 0.76 | 1.02 | 0 |
| baselines/llm_norag:qwen2.5:7b | - | - | - | 6.26 | 7.10 | 0 |
| baselines/llm_rag:qwen2.5:7b | 96.6 | 0.900 | - | 14.18 | 22.94 | 0 |

## Confusion matrices (rows = truth, columns = prediction)

**v4/verifin**

| truth \ pred | SUPPORTED | CONTRADICTED | UNVERIFIABLE |
|---|---|---|---|
| SUPPORTED | 163 | 9 | 1 |
| CONTRADICTED | 2 | 118 | 1 |
| UNVERIFIABLE | 0 | 0 | 60 |

**v4/verifin [raw NLI]**

| truth \ pred | SUPPORTED | CONTRADICTED | UNVERIFIABLE |
|---|---|---|---|
| SUPPORTED | 157 | 8 | 8 |
| CONTRADICTED | 20 | 95 | 6 |
| UNVERIFIABLE | 0 | 36 | 24 |

**baselines/llm_norag:qwen2.5:7b**

| truth \ pred | SUPPORTED | CONTRADICTED | UNVERIFIABLE |
|---|---|---|---|
| SUPPORTED | 9 | 0 | 164 |
| CONTRADICTED | 9 | 1 | 111 |
| UNVERIFIABLE | 1 | 0 | 59 |

**baselines/llm_rag:qwen2.5:7b**

| truth \ pred | SUPPORTED | CONTRADICTED | UNVERIFIABLE |
|---|---|---|---|
| SUPPORTED | 157 | 7 | 9 |
| CONTRADICTED | 23 | 81 | 17 |
| UNVERIFIABLE | 0 | 0 | 60 |
