# VERIFIN 2.0 architecture

VERIFIN checks whether statements written by an LLM about a financial report are supported by that report. Every verdict
names the rule that produced it and the evidence page it rests on. This page describes how the parts fit together and why
they are built that way. Operational detail is in [RUNBOOK.md](RUNBOOK.md), security in [THREAT_MODEL.md](THREAT_MODEL.md),
measured quality in [MODEL_CARD.md](MODEL_CARD.md).

## System context

```mermaid
flowchart LR
    U[Analyst or reviewer<br/>browser] -->|HTTPS| FE[React frontend<br/>GitHub Pages]
    S[Client system<br/>X-API-Key] -->|HTTPS| API
    FE -->|HTTPS, JWT| API[FastAPI service<br/>one container, CPU only]
    API --> DB[(MongoDB Atlas<br/>documents, chunks, sessions,<br/>users, audit chain)]
    API -.->|optional, fact extraction only| HF[Hugging Face<br/>inference API]
    API -.->|EDGAR import only| SEC[SEC EDGAR<br/>www.sec.gov, data.sec.gov]
    API --- M[Models held in memory:<br/>MiniLM embeddings, DeBERTa-v3-small NLI]
```

The verification path is fully local. Claim extraction, retrieval, NLI and the verdict rules run inside the container with
models baked into the image, so no document text leaves the deployment while a statement is being checked. The two dotted
connections are optional and off unless configured: the Hugging Face call is used only by the document fact-extraction
endpoint when `HF_TOKEN` is set, and the SEC calls only by the EDGAR import endpoints.

## Verification pipeline

```mermaid
flowchart TD
    A[LLM statement] --> B[Claim extraction<br/>split into atomic claims]
    B --> C[Hybrid retrieval<br/>MiniLM dense + BM25, reciprocal rank fusion]
    C --> D[NLI cross-encoder<br/>sentence-window scoring]
    C --> E[Deterministic checks<br/>figure grounding, entity novelty,<br/>fiscal period, table lookup, derived values]
    D --> F[Verdict policy<br/>fixed priority order]
    E --> F
    F --> G[Verdict: SUPPORTED, CONTRADICTED, UNVERIFIED<br/>decided_by, evidence page, confidence]
    G --> H[Session + provenance + audit event]
```

1. **Ingestion** (on upload). The PDF is validated (extension, MIME type, `%PDF-` header, size), hashed (SHA-256), split into
   page-aware chunks stored for retrieval, and its tables are extracted with unit and period detection. Scanned pages go through OCR
   when Tesseract is present.
2. **Claim extraction** splits a statement into atomic claims, repairing sentence splits at abbreviations and keeping each
   sub-claim's subject and reporting period.
3. **Retrieval** returns the top three chunks per claim using dense and BM25 rankings merged by reciprocal rank fusion.
   An optional cross-encoder reranker exists and is off by default (see the model card).
4. **NLI** scores entailment and contradiction between the claim and sentence-sized windows of the evidence, and only the
   windows that align best with the claim are allowed to decide.
5. **Deterministic checks** run in parallel with NLI. They exist because the NLI model alone is unreliable on numbers:
   figure grounding (does the evidence state this figure, or a different one for the same fact), entity novelty (names that
   appear nowhere in the document), fiscal-period alignment, structured-table lookup, and recomputation of derived values
   such as growth and margins.
6. **Verdict policy** (`verdict_policy.py`) applies the checks in a fixed order and returns the first that fires:
   `entity_novelty`, `figure_conflict`, `table_mismatch`, `temporal`, `multi_hop`, `nli`, `grounded_support`. The winning
   rule is stored as `decided_by`, so a reviewer sees why, and the leave-one-out ablation in the README can measure each rule.

A statement's risk is derived from its claims: it is as risky as its worst claim.

## Service layout

| Layer | Where | Responsibility |
|---|---|---|
| API | `app/api/` | versioned routes under `/api/v1` (the unversioned `/api` is kept and marked deprecated) |
| Security | `app/security/` | JWT and API-key authentication, roles (viewer < analyst < admin), tenant scoping, rate limits |
| Services | `app/services/` | ingestion, retrieval, NLI, numeric grounding, verdict policy, export, EDGAR, audit, job runner |
| Repositories | `app/repositories/` | the only code that touches the database; every query is tenant-scoped |
| Observability | `app/observability/` | request IDs and W3C `traceparent`, JSON logs, Prometheus metrics |
| Frontend | `frontend/src/` | React 19, TypeScript, Tailwind; token held in `sessionStorage`; route guards by role |

### Background jobs

`POST /verification/jobs` returns `202` with a status URL immediately. An in-process `JobRunner` runs jobs under a bounded
semaphore (default two at once) with a queue limit (default 50, then `429`). Sessions move `queued`, `running`,
`completed` or `failed`. On start-up the runner marks sessions left unfinished by a crash as `failed`, and on shutdown it
cancels running work. Batch submission accepts up to 25 statements and returns a batch ID.

### Multi-tenancy

Every user belongs to one tenant, created at registration. Every record carries `tenant_id`, repositories filter on it, and a
request for another tenant's record returns `404`, not `403`, so IDs cannot be probed. Roles are read from the database on
each request, so a role change or deactivation applies immediately.

### Audit trail and provenance

- Each tenant has a hash chain: an event stores `seq`, `prev_hash` and its own SHA-256 over its content. `/audit/verify`
  recomputes the chain and reports the first broken sequence number. A unique `(tenant_id, seq)` index prevents two writers
  from forking the chain. Secrets are stripped from event details by key name.
- Every session stores provenance: pipeline version (`verifin-pipeline/4.2`), model identifiers, retrieval and policy
  settings, SHA-256 of the document and of the statement, and per-rule decision counts. It records identifiers and settings
  only, never document text or credentials, so a result can be tied to the exact bytes and rules that produced it.

## Deployment

Frontend on GitHub Pages, API on Cloud Run (one instance, 2 vCPU, 4 GiB, CPU always on), data on a MongoDB Atlas free
cluster. Steps and free-tier limits are in [DEPLOY.md](DEPLOY.md). In `ENVIRONMENT=production` the service forces
authentication on, disables the in-memory database fallback, refuses to start without a strong `JWT_SECRET` or a reachable
database, and hides `/metrics` unless a token is set.

## Design decisions and their costs

| Decision | Reason | Cost |
|---|---|---|
| Deterministic rules around a small NLI model | raw NLI scored 66.8 macro-F1 on test; the rules lift it to 95.2 | rules are tuned to the error types seen; tables and new layouts need their own checks (see the model card) |
| No LLM in the verification path | an LLM judge with the same evidence scored 82.2 and took 12 s per claim; verdicts must be reproducible and traceable | no free-text reasoning over multi-step claims beyond the implemented checks |
| One process, in-memory limiter and queue | simplest correct design for one free instance | does not scale out; needs a shared queue and rate-limit store first |
| Per-tenant hash chain, best-effort writes | tamper evidence without an external ledger | a failed audit write is counted and logged but does not fail the request; the chain proves tampering, it does not prevent it |
| Uploaded files on local disk | no object store on the free tiers | files do not survive a restart; verdicts and reports do (Atlas) |
