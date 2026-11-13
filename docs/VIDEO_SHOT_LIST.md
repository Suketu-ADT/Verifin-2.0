# Demo video: shot list and narration

A seven-minute screen recording of VERIFIN. It follows [DEMO_SCRIPT.md](DEMO_SCRIPT.md), so every verdict shown is one the running
system produced on the bundled Northstar sample report. Read the narration in your own words; it is written to be said aloud, at
roughly 140 words a minute.

## Before you record

| Step | How |
|---|---|
| Start the app | `.\scripts\start_demo.ps1 -NoTunnel`, then open http://localhost:8000 |
| Warm it up | Run the sample (*Use sample*, then *Verify claims*) once and wait for results, so the models are loaded and the recording has no dead time |
| Clean data | Use a demo account. Close other tabs, turn on Do Not Disturb, hide bookmarks and personal email |
| Screen | 1920x1080, browser zoom 100% (or 110% so text reads on a phone), sidebar visible |
| Recorder (free) | OBS Studio (Display Capture plus your microphone), or Windows Game Bar (Win+G, Capture). Record audio separately if your microphone is noisy |
| Download managers | If *Use sample* says the file is empty, pause Internet Download Manager's browser integration (it intercepts the PDF) |
| Do not show | Your `.env`, API keys, the Atlas page, your email inbox with real codes |

## Shots

| # | Time | On screen | Narration |
|---|---|---|---|
| 1 | 0:00 to 0:30 | Landing page, then the sign-in page | "Large language models write fluent summaries of financial reports, and some of what they write is wrong: a figure off by a decimal, a year swapped, a company that is not in the report at all. VERIFIN checks every statement against the source document and shows why." |
| 2 | 0:30 to 1:00 | Sign-in: show *Password*, *Email code* and *Continue with Google*, then sign in | "People can sign in with a password, a six-digit code sent to their email, or Google. Everything after this is scoped to the organisation: nobody can see another organisation's documents." |
| 3 | 1:00 to 1:40 | New Verification: click *Use sample*; show the seven-claim statement | "This is a synthetic annual report for a company called Northstar, and a seven-sentence summary of it. Some sentences are right and some have planted errors. Can the system tell which?" Click *Verify claims*. |
| 4 | 1:40 to 3:00 | Results page. Scroll through all seven claims; expand a few rows | "Seven claims, four contradicted, two supported, one unverifiable, and the statement is rated high risk because it is as risky as its worst claim. Revenue growth of 22.5% is contradicted: the report says 18%. Operating income of 74.25 is last year's value. Interest expense of 9,450 million is the wrong unit; the table says 9.45. A true claim, total assets of 470, passes, so the system is not simply flagging everything. And Helios Data Systems appears nowhere in the report, so the system says it cannot verify the acquisition instead of guessing." |
| 5 | 3:00 to 4:00 | Expand the interest-expense claim; *Show technical details*, then *Open full claim audit* | "Every verdict names the rule that made it. Here the language model alone gave 98.7% entailment, but a table check found the figure is 9.45 million, not 9,450. A rule decided this, not a model's opinion, and no language model is called during verification, so the same input always gives the same answer. This is why the deterministic checks matter." |
| 6 | 4:00 to 4:40 | Administration, *Audit trail* tab, *Verify integrity* | "Every action is recorded in a hash-chained audit trail. Verify integrity recomputes the chain: it shows 'chain intact'. This proves nobody without database access changed or removed an event. It does not stop someone with full database access from rewriting everything, and we say so in the threat model." |
| 7 | 4:40 to 5:20 | Reports: click *Download PDF*; show its provenance block | "Results export as a report. It records the pipeline version, the models, the settings and the document's SHA-256 hash, so a result can be tied to the exact file and rules that produced it." |
| 8 | 5:20 to 6:10 | Benchmark page | "On 240 held-out claims, with the rules frozen before scoring, VERIFIN reaches a macro-F1 of 95.2. The same language model without the deterministic checks scores 66.8. A seven-billion-parameter language model given the same evidence scores 82.2, and takes twelve seconds a claim against one. The labels are built by editing real report sentences, so this measures the method on known errors, not claims written by a real model." |
| 9 | 6:10 to 6:40 | Analytics page | "Over time, the Analytics page shows the hallucination rate, which documents and claim types are most affected, and the flagged claims worth a reviewer's time. Every chart has a table view." Say it is sample data if you used the seeded demo. |
| 10 | 6:40 to 7:10 | Back to results, or the Benchmark limitations | "It is not perfect. On a hand-labelled probe of this very report it gets 21 of 24 right. It missed a claim where the figures were right but the direction was wrong. Treat 'supported' as 'no problem found', not 'confirmed'. It is a screening aid for an analyst, not a replacement for one." |

## Tips

- Keep the mouse still while you talk; move it only to point.
- If a verdict differs from the table in the demo script, say so and show the pipeline version in the report's provenance block.
- Export at 1080p. Trim silence in Clipchamp (free with Windows) or DaVinci Resolve.
- Add one caption slide at the start with the project name and one at the end with where the code and the report live.
