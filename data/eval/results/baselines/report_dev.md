# Evaluation results - `dev` split

## Overall (3-way verdict)

| System | n | Accuracy [95% CI] | Macro-F1 [95% CI] | Supp. F1 | Contr. F1 | Unver. F1 | p vs ref |
|---|---|---|---|---|---|---|---|
| llm_norag:qwen2.5:7b | 354 | 19.5 [15.5, 24.0] | 13.7 [10.6, 17.0] | 9.4 | 1.6 | 29.9 |  |

`p vs ref` is an exact McNemar test against `llm_norag:qwen2.5:7b` on the same claims.

## Hallucination flagging (claim flagged when verdict is not SUPPORTED)

| System | Target | Precision | Recall | F1 | False-positive rate |
|---|---|---|---|---|---|
| llm_norag:qwen2.5:7b | contradicted only | 33.4 | 92.6 | 49.1 | 95.7 |
| llm_norag:qwen2.5:7b | any unsupported | 51.0 | 94.5 | 66.3 | 94.8 |

## Accuracy by error type

| Label / subtype | llm_norag:qwen2.5:7b |
|---|---|
| CONTRADICTED/direction_flip | 4.3 (n=23) |
| CONTRADICTED/number_change | 0.0 (n=61) |
| CONTRADICTED/period_swap | 0.0 (n=18) |
| CONTRADICTED/unit_swap | 0.0 (n=19) |
| SUPPORTED/paraphrase | 7.1 (n=56) |
| SUPPORTED/verbatim | 4.3 (n=117) |
| UNVERIFIABLE/acquisition | 87.5 (n=8) |
| UNVERIFIABLE/appointment | 100.0 (n=6) |
| UNVERIFIABLE/bond | 100.0 (n=12) |
| UNVERIFIABLE/facility | 100.0 (n=15) |
| UNVERIFIABLE/penalty | 100.0 (n=19) |

## Retrieval, calibration and latency

| System | Recall@k (page) | MRR | ECE | mean s/claim | p95 s/claim | errors |
|---|---|---|---|---|---|---|
| llm_norag:qwen2.5:7b | - | - | - | 6.26 | 7.10 | 0 |

## Confusion matrices (rows = truth, columns = prediction)

**llm_norag:qwen2.5:7b**

| truth \ pred | SUPPORTED | CONTRADICTED | UNVERIFIABLE |
|---|---|---|---|
| SUPPORTED | 9 | 0 | 164 |
| CONTRADICTED | 9 | 1 | 111 |
| UNVERIFIABLE | 1 | 0 | 59 |
