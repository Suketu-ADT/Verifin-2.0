# Demo script

About ten minutes. Every verdict below was produced by the running system on the sample report
(`data/VERIFIN_sample_financial_report.pdf`, a synthetic seven-page annual report for "Northstar Technologies") with pipeline
4.2 and was re-run just before this was written. Run the checks in [RUNBOOK.md](RUNBOOK.md) first; on Cloud Run, open the site
two minutes early so the instance is awake.

## Setup

1. Sign in as an analyst or admin. Have the sample PDF at hand.
2. On New Verification, click *Try the Northstar sample report*: it uploads the bundled PDF and fills in the statement below. (Uploading `data/VERIFIN_sample_financial_report.pdf` yourself works the same way; the claim extractor is optional and can take a minute on CPU.)

## Story in one line

"An LLM summarised this report. Some of what it wrote is wrong. Can we tell which, and can we show why?"

## Part 1. A statement with planted errors (4 min)

If you did not use the sample button, paste:

> Revenue grew 22.5% year over year to USD 486.75 million in FY2025. Operating income for FY2025 was USD 74.25 million. Interest expense for FY2025 amounted to USD 9,450 million. Total assets reached USD 470.0 million at 31 March 2025. Cash and cash equivalents increased by USD 11.5 million during FY2025. Net profit decreased from USD 51.0 million in FY2024 to USD 46.35 million in FY2025. Northstar completed the acquisition of Helios Data Systems in FY2025.

Expected result, claim by claim:

| Claim | Verdict | Deciding rule | What to say |
|---|---|---|---|
| Revenue grew 22.5% ... | contradicted | `figure_conflict` | the report says 18.0%; the figure is shown next to the evidence page |
| Operating income was 74.25 | contradicted | `table_mismatch` | 74.25 is last year's value; FY2025 is 71.25, found in the income statement table |
| Interest expense 9,450 million | contradicted | `table_mismatch` | wrong unit: the table says 9.45 million |
| Total assets 470.0 | supported | `nli` | a true claim passes, so the system is not just flagging everything |
| Cash increased by 11.5 | contradicted | `table_mismatch` | it decreased. Be exact about what the page shows: it compares 11.5 with the closing balance row (46.9), so the printed reason is crude; the evidence sentence beside it says "decreased by USD 11.5 million" |
| Net profit decreased ... | supported | `nli` | true |
| Acquisition of Helios Data Systems | unverified | `entity_novelty` | the name appears nowhere in the report; the system says it cannot verify, rather than guessing |

Point out: the statement risk is the worst claim, so the summary is high risk. Open one claim to show the evidence and the
"Decided by" rule on its detail page (the results list itself shows the verdict and claim text only). Open Reports and
download the report to show it is exportable.

## Part 2. Why it can be trusted (3 min)

- Open the claim detail for the interest-expense claim and read "Decided by: table_mismatch": "this was decided by a rule, not by a model's
  opinion". No LLM is called during verification, so the same input gives the same verdict.
- Open Admin, Audit, and click *Verify chain*: every action above was recorded in a hash-chained trail. Say what it proves
  (nobody without database access altered or removed events) and what it does not (it cannot stop a database administrator
  rewriting the whole chain).
- Open the downloaded PDF report from Reports and show its Provenance block: pipeline version, models, settings, document SHA-256.

## Part 3. The numbers (2 min)

Use the results deck. Three figures to state:

- Held-out test, 240 claims, rules frozen before scoring: **macro-F1 95.2** (same on pipeline 4.2, all verdicts identical); raw NLI alone 66.8.
- A 7B LLM judge given the same evidence: 82.2, at 12 s per claim against 1.0 s.
- The deterministic layer, not the model size, accounts for most of the gain (leave-one-out ablation).

## Part 4. Where it is weak (1 min)

Say this before anyone asks. On this very report, 24 hand-labelled claims score 21 correct (87.5%). The three misses:

| Claim | Truth | System said | Why it matters |
|---|---|---|---|
| "Operating expenses increased to USD 201.33 million, including research and development of USD 92.1 million" | true | contradicted (`figure_conflict`) | false alarm on a two-figure claim |
| "Net profit increased by 9.1% to USD 46.35 million" | false (it fell 9.1%) | supported (`nli`) | the figures are right and the direction is wrong; nothing checks it |
| "Gross margin decreased from 57.0% to 56.0%" | true | contradicted (`nli`) | NLI misread a true percentage claim |

This is why the model card says tables and statement layouts are the weakest area, and why the 24-claim probe is not
presented as a benchmark.

## Claims that work and claims to avoid

Safe to type live. The seven-claim statement above was re-run on pipeline 4.2; the lists below were verified on 4.1, and 4.2 changes only how section numbers are read:

- Contradicted: revenue 22.5% growth; operating income 74.25; interest 9,450 million; total assets grew 25.0%; free cash flow
  positive 7.2 million; gross margin expanded to 58.0%; Cloud Infrastructure Services above 60% of revenue; cash increased
  by 11.5; revenue 520.0 million; interest expense in FY2024 of 9.45 million; dividends of 20.0 billion.
- Supported: total assets 470.0 at 31 March 2025; revenue 412.5 to 486.75, up 74.25 or 18.0%; net profit 51.0 to 46.35;
  cash decreased by 11.5 to 46.9; interest expense 9.45; total assets up 17.5%; dividends 20.0; 50.0 million shares in both years.

Do not use live: the three misses above.

## If something goes wrong

| Problem | Do this |
|---|---|
| First request is slow | the instance is waking up; wait, then repeat |
| A verdict differs from this page | say so; check the pipeline version in provenance; this page is dated to version 4.2 |
| Job seems stuck | refresh History; the job continues in the background |
| No network | run locally: `backend` with `uvicorn app.main:app`, frontend with `npm run dev` |
