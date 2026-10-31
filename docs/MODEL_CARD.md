# VERIFIN 2.0 model card

VERIFIN is a verification system, not a single model. It decides whether a statement about a financial report is supported by
that report. This card says what it is for, how it was measured, and where it fails. Every number comes from the evaluation
tables in the [README](../README.md) or from the probe described below; none is estimated.

## Summary

| | |
|---|---|
| Task | classify a claim about a report as `SUPPORTED`, `CONTRADICTED` or `UNVERIFIED` (the evaluation labels the last one `UNVERIFIABLE`) |
| Pipeline version | `verifin-pipeline/4.2` (recorded in every result) |
| Components | MiniLM sentence embeddings and BM25 (reciprocal rank fusion), `cross-encoder/nli-deberta-v3-small` (sentence windows), deterministic checks, a fixed-priority verdict policy |
| Hardware | CPU only, about 1 s per claim |
| Outputs | verdict, the rule that decided it (`decided_by`), evidence page and sentence, confidence |
| Held-out result | macro-F1 95.2 [92.3, 97.7], accuracy 94.6 [91.7, 97.5], 240 claims, rules frozen before scoring |

## Intended use

- Screening LLM-written summaries or answers about a financial report, to flag statements an analyst should check.
- Producing a traceable record (evidence page, deciding rule, document hash) of why a statement was flagged.

## Not intended for

- Replacing review of material statements. It is a screening aid: 5.4% of held-out claims were classified wrongly.
- Documents it was not tested on (see Data). It has not been measured on prospectuses, regulatory filings other than the
  reports below, non-English text, or scanned reports of poor quality.
- Reading a verdict as a probability. The confidence value is an evidence-alignment score; calibration error is 0.183 on test.
- Judging opinions, forecasts, or causal claims ("reflecting disciplined cost control"); only checkable facts and figures are in scope.

## How a verdict is produced

Retrieval finds the three best chunks; NLI scores sentence windows of them; deterministic checks test figures, names, periods,
tables and derived values; the policy returns the first rule that fires in this order: `entity_novelty`, `figure_conflict`,
`table_mismatch`, `temporal`, `multi_hop`, `nli`, `grounded_support`. See [ARCHITECTURE.md](ARCHITECTURE.md). No generative model
takes part in a verdict.

## Data

| | |
|---|---|
| Corpus | six public documents: JPMorgan 2025, Reliance 2025-26, SBI 2025-26 and Tata Motors 2024-25 annual reports, an HDFC Bank AGM transcript, a Wipro AGM notice (about 16,000 chunks) |
| Claims | 594, labels correct by construction: 282 supported (verbatim sentences or number-preserving paraphrases), 212 contradicted (one controlled edit: number, unit, period or direction), 100 unverifiable (plausible claims about invented entities) |
| Split | by hash of (document, page): dev 354, test 240; seed 1337 |
| Use of splits | all rules and thresholds were set on dev. The test split was scored after the rules were frozen, and re-run once on pipeline 4.2 as a regression check |

The system has no trained parameters of its own; the models are used as published. The dev split guided the rules, so dev
numbers are optimistic; quote the test numbers.

## Results

Held-out test split (n = 240):

| System | Accuracy | Macro-F1 |
|---|---|---|
| VERIFIN | 94.6 [91.7, 97.5] | **95.2** [92.3, 97.7] |
| VERIFIN, raw NLI only (no deterministic checks) | 75.8 | 66.8 |
| `number_match` heuristic (no ML) | 81.7 | 79.7 |
| Qwen 2.5 7B judge, given the same retrieved evidence | 83.8 | 82.2 |
| Qwen 2.5 7B judge, no document | 20.0 | 14.6 |

Confusion on test (rows = truth; columns supported / contradicted / unverifiable): supported 100 / 8 / 1, contradicted 3 / 88 / 0,
unverifiable 0 / 1 / 39. Flagging any non-supported claim: precision 93.4%, recall 97.7%, false-positive rate 8.3%.

Dev split, by error type: number change 98.4%, period swap 100%, direction flip 95.7%, unit swap 94.7%, verbatim supported
95.7%, paraphrased supported 91.1%. On test the weakest areas were paraphrased supported claims (83.9%) and unit swaps (93.3%).

Contribution of each rule (dev, leave-one-out): entity novelty -20.3 macro-F1 when removed, figure conflict -4.0, grounded
support -2.8, period check -1.5. Derived-value recomputation and table arithmetic show no effect on the benchmark because it
has no such claims (see below).

### Changes in pipeline 4.1 and 4.2

Pipeline 4.0 produced the test numbers above. Version 4.1 fixed table-check defects found while rehearsing a demo (below). It
was re-scored on dev: macro-F1 96.7, identical to 4.0 claim for claim (McNemar p = 1.0), as expected because the dev set
contains no structured-table claims.

After 4.2 the test split was run a second time, as a regression check and not for tuning (nothing was changed afterwards):
macro-F1 95.2, accuracy 94.6, with all 240 verdicts identical to the 4.0 run (McNemar p = 1.0). The 95.2 therefore holds
for the pipeline that ships. Results: `data/eval/results/v4_2/report_test.md`.

Version 4.2 stops section numbers such as the "4.1" in "4.1 Revenue" being read as figures, which had put a heading number
into explanations ("the evidence says 4.2"). Dev macro-F1 is again 96.7 with no verdict changed, and the probe below is
unchanged at 21 / 24. Also in 4.2, outside the verdict path: a conflict explanation now quotes the figure from the evidence
sentence that best matches the claim, and the optional fact-extraction step has a 45-second budget before it falls back to
sentences that contain figures. Neither changes a verdict.

## Table-heavy report probe

The benchmark is built from sentences of narrative reports, so it cannot show how the system handles financial statements laid
out as tables. To see this, the sample report `VERIFIN_sample_financial_report.pdf` (Northstar Technologies, synthetic, seven
pages of statements) was used with 24 claims labelled by reading its figures: 11 are the report's own "management summary"
highlights, several of which contradict its statements by design; 8 are true restatements of table rows; 5 are edits (number,
direction, period, unit, invented entity). Script: `scripts/probe_report.py`; data: `data/eval/northstar_probe.json`.

| Result with pipeline 4.2 (same as 4.1) | |
|---|---|
| Accuracy | **21 / 24 = 87.5%** |
| Management-summary highlights | 9 / 11 |
| True restatements | 7 / 8 |
| Edited claims | 5 / 5 |

Before the 4.1 fixes the system flagged correct restatements of table rows as contradicted (for example a right figure stated
in "USD million" against a table in thousands), which a reviewer would have seen at once. The three remaining errors:

- **MS-2** (true; operating expenses 201.33 and R&D 92.1): wrongly marked `CONTRADICTED` by the figure-conflict rule.
- **MS-3** (false; "net profit increased by 9.1%" when it decreased by 9.1%): wrongly marked `SUPPORTED` by NLI. Every figure in
  the claim appears in the report; only the direction is wrong, and nothing in the pipeline checks it against the table.
- **T-2** (true; gross margin fell from 57.0% to 56.0%): wrongly marked `CONTRADICTED` by NLI.

Probe confusion (rows = truth; columns supported / contradicted / unverifiable): supported 8 / 2 / 0, contradicted 1 / 12 / 0,
unverifiable 0 / 0 / 1. Two of the three errors are false alarms on true claims, one is a missed error.

The probe is 24 claims on one synthetic document. It was used to find and fix bugs, so 87.5% is a development figure, not a
held-out result, and it has wide uncertainty (95% interval roughly 68% to 97%). Its purpose is to show the kind of layout where
the main benchmark's confidence does not carry over.

## Limitations

1. **Tables and statement layouts.** Narrow benchmark coverage (above). Table lookup works when the row label, column period
   and unit are all recognised; it deliberately makes no judgement when they are ambiguous, so such claims fall through to
   NLI and the figure rules, which are weaker on numbers.
2. **Direction claims.** "Increased" against "decreased" is caught when a sentence states the direction (95.7% on dev), but a
   wrong direction on figures that are otherwise right was missed in the probe (MS-3).
3. **NLI misreads.** The small NLI model occasionally contradicts a correct claim (3 dev cases) or misses paraphrases
   (paraphrased supported claims 91.1% dev, 83.9% test).
4. **Retrieval.** Page Recall@3 is 95.0% on test. If the right sentence is not retrieved, the verdict can be wrong; boilerplate that
   repeats across years is the usual cause.
5. **The "unverifiable" class is narrow.** It is solved by a rule that flags names absent from the document. Plausible facts the
   report simply does not state, but which use no new names, are not represented and are likely to be marked supported or
   contradicted instead.
6. **Contradictions are synthetic edits**, mostly numeric. Subtle semantic contradictions are under-represented. Period swaps
   are arguable when a report states both years.
7. **Labels have not been human-audited.** They are correct by construction, but nobody has checked a sample against the
   documents and measured agreement.
8. **Language and scope.** English reports; Indian digit grouping, crore and lakh are handled, other number conventions are not
   tested. Scanned pages go through OCR when Tesseract is available; OCR accuracy has not been measured.
9. **Calibration.** Confidence is not a probability (ECE 0.183 test).
10. **LLM-judge comparison.** The judge baseline is one small local model at temperature 0 with an untuned prompt. It shows what a
    7B model does with this evidence, not what LLM judging can do.
11. **Fact extraction** (optional, needs `HF_TOKEN`) uses a hosted LLM and is not part of any measured result.

## Fairness and misuse

The system has no personal attributes as inputs. The main risk is over-trust: a green `SUPPORTED` badge on a statement the
system got wrong. Mitigations in the product are the displayed evidence and deciding rule, the `UNVERIFIED` status instead of
a forced guess, and the audit trail of what was shown. Users should treat `SUPPORTED` as "no problem found", not "confirmed".

## Reproducing the numbers

```bash
cd backend
python -m eval.run --split dev --systems verifin --run v4_1
python -m eval.report --split dev --systems verifin --run v4,v4_1
python -m pytest
python ../scripts/probe_report.py http://127.0.0.1:8000     # needs a running API and SMOKE_EMAIL / SMOKE_PASSWORD
```

Per-claim predictions are stored in `data/eval/results/<run>/<split>/`.
