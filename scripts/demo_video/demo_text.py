"""Narration (spoken) and captions (on screen) for the VERIFIN demo video, one entry per shot."""

NARRATION = {
    "s1": "Large language models write fluent summaries of financial reports, and some of what they write is wrong. A figure off by a decimal, a year swapped, a company that is not in the report at all. VERIFIN checks every statement against the source document, and shows why.",
    "s2": "People can sign in with a password, a six digit code sent to their email, or Google. Everything after this is scoped to the organisation, so nobody can see another organisation's documents.",
    "s3": "This is a synthetic annual report for a company called Northstar, and a seven sentence summary of it. Some sentences are right and some have planted errors. Can the system tell which? Let's check it.",
    "s4": "Seven claims: four contradicted, two supported, one unverifiable. The statement is rated high risk, because it is as risky as its worst claim. Revenue growth of twenty two point five percent is contradicted: the report says eighteen. Operating income of seventy four point two five is last year's value. Interest expense of nine thousand four hundred and fifty million is the wrong unit; the table says nine point four five. A true claim, total assets of four hundred and seventy million, passes, so the system is not simply flagging everything. And Helios Data Systems appears nowhere in the report, so the system says it cannot verify the acquisition, instead of guessing.",
    "s5": "Every verdict names the rule that made it. Here, the language model alone gave ninety eight point seven percent entailment, but a table check found the figure is nine point four five million, not nine thousand four hundred and fifty. A rule decided this, not a model's opinion, and no language model is called during verification, so the same input always gives the same answer. This is why the deterministic checks matter.",
    "s6": "Every action is recorded in a hash chained audit trail. Verify integrity recomputes the chain, and it shows chain intact. This proves nobody without database access changed or removed an event. It does not stop someone with full database access from rewriting everything, and the threat model says so.",
    "s7": "Results export as a report, as P D F or C S V. The P D F records the pipeline version, the models, the settings and the document's S H A two fifty six hash, so a result can be tied to the exact file and rules that produced it.",
    "s8": "On two hundred and forty held out claims, with the rules frozen before scoring, VERIFIN reaches a macro F one of ninety five point two. The same language model without the deterministic checks scores sixty six point eight. A seven billion parameter language model given the same evidence scores eighty two point two, and takes twelve seconds a claim, against one. The labels are built by editing real report sentences, so this measures the method on known errors, not claims written by a real model.",
    "s9": "Over time, the Analytics page shows the hallucination rate, which documents and claim types are most affected, and the flagged claims worth a reviewer's time. Every chart has a table view. These charts use generated sample data, so they show the layout and not real usage.",
    "s10": "It is not perfect. On a hand labelled probe of this very report it gets twenty one of twenty four right. It missed a claim where the figures were right but the direction was wrong. Treat supported as no problem found, not as confirmed. It is a screening aid for an analyst, not a replacement for one.",
}

CAPTIONS = {
    "s1": "VERIFIN checks every statement against the source document",
    "s2": "Sign in with a password, an emailed code, or Google",
    "s3": "A seven-sentence summary of a synthetic annual report, with planted errors",
    "s4": "Four contradicted · two supported · one unverifiable",
    "s5": "Every verdict names the rule that decided it",
    "s6": "A hash-chained audit trail, verified on demand",
    "s7": "Exportable reports record the pipeline, models and document hash",
    "s8": "Held-out benchmark: 240 claims, rules frozen before scoring",
    "s9": "Analytics (generated sample data)",
    "s10": "A screening aid, not a replacement for an analyst",
}
