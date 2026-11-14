# Changelog

Newest first. Only user-visible changes and changes to how the project is built or documented are listed.

## Unreleased: page speed, landmark and robots.txt fixes (2026-11-14)

Fixes from a Lighthouse run (mobile, simulated slow connection) of the landing page served by the API. Measured again with the same tool on the rebuilt app: performance 0.56 to 0.95, accessibility 0.98 to 1.00, SEO 0.91 to 1.00; first contentful paint 10.7 s to 2.3 s, largest contentful paint 11.0 s to 2.4 s. Best practices stays at 0.96.

- Every page except the landing page is loaded on demand (`React.lazy`). The entry script went from about 1.56 MB to 384 KB (121 KB compressed); heavy pages (charts, PDF viewer) load only when opened.
- The API now compresses the built interface's text files with gzip when the browser accepts it and sends `Cache-Control: public, max-age=31536000, immutable` for the hashed files under `assets/` and `no-cache` for the shell, so repeat visits download nothing.
- The landing page has a `<main>` landmark.
- New `frontend/public/robots.txt`; before, `/robots.txt` returned the app's HTML page.
- Not changed: signed-out visitors still see one 401 in the browser console, from the sign-in check (`/api/v1/auth/me`); the call is needed so that local mode without authentication opens straight into the app. Source maps for the production bundle are not published.

## Unreleased: interface redesign and motion polish (2026-11-13)

### Backend: draft-from-document limits are settings

- `OLLAMA_NUM_CTX` and `OLLAMA_KEEP_ALIVE` (both optional) set the context window and how long the model stays loaded. Ollama's OpenAI-compatible `/v1` endpoint ignores them, so when either is set the provider calls Ollama's native `/api/chat`. Checked against Ollama 0.32.9: the context went from 4096 to 8192 and the model stayed loaded for the requested time.
- The JSON-mode call to a custom endpoint (Ollama, Groq) now honours `LLM_MAX_OUTPUT_TOKENS`; it was silently capped at 1500 tokens.
- `FACT_SAMPLE_MAX_CHUNKS`, `FACT_SAMPLE_MAX_PAGES`, `FACT_MAX_CLAIMS` and `FACT_FALLBACK_MAX_CLAIMS` replace hard-coded caps (12 chunks, 8 pages, 10 claims returned, 8 claims from the plain extractor). Defaults are unchanged; each is bounded to 1 to 200. `.env.example` documents them with measured timings for a local CPU model.

Frontend and documentation only. No backend, API contract, authentication or verification logic changed, and no metric on screen is invented.

### Motion polish

- Motion tokens: `--motion-fast` 150 ms, `--motion-base` 200 ms, `--motion-slow` 300 ms and two easings (`--ease-out-soft`, `--ease-in-out-soft`) in `frontend/src/index.css`, mirrored for JavaScript in `frontend/src/lib/motion.ts` (`DURATION`, `EASE`, `CHART_DRAW_MS`).
- Route changes fade and slide up 6 px; the sidebar and header stay put, so nothing jumps. `scrollbar-gutter: stable` stops sideways shifts.
- Staggered entrances (`.stagger`) for metric cards, claim cards and chart blocks on Dashboard, Results, History, Review queue, Analytics and Benchmark.
- Smooth expand and collapse for claim details and the Technical details section (new `Collapse` component, no height measuring, collapsed content is `inert`).
- Subtle hover and press states on buttons, interactive cards and sidebar links; the sidebar active marker fades in.
- Skeletons crossfade into content (metric values, table bodies); charts draw once on mount; verdict and confidence bars use the same tokens.
- `prefers-reduced-motion`: animations and transitions are removed or made instant, charts do not animate, pages change with a plain fade.
- No new dependencies.

### Interface redesign

- New light, premium design system: tokens declared once in a Tailwind v4 `@theme` block (neutrals, brand, status, risk, radius, shadow, type); Inter Variable bundled with the app; `tailwind.config.js` removed.
- Fixed verdict colours (Supported #16A34A, Contradicted #DC2626, Unverifiable #D97706, Neutral #64748B) used identically everywhere through `lib/verdict.ts`; every verdict shows an icon and the word, and charts add textures, legends, tooltips and a table view. The palette does not pass the colour-blind separation check on colour alone; this is documented in `docs/DESIGN_SYSTEM.md`.
- One app shell: grouped sidebar (collapsible rail, drawer below 1024 px with focus management), header with breadcrumb, live engine-status chip and "New verification".
- Every page rebuilt on shared components: Dashboard, New Verification ("Use sample", "Verify claims"), Results (claim cards with evidence, deciding rule and "Show technical details"), Claim audit ("Open full claim audit", PDF evidence viewer), Evidence Explorer, History, Review queue, Reports ("Download PDF"), Analytics, Benchmark, System status, Settings, Account, Administration (Overview, People, API keys, "Audit trail" with "Verify integrity"), sign-in and sign-up, landing page.
- New shared components: `Button`, `Input`/`Field`, `Card`, `Badge`, `Modal`, `Dropdown`, `Toast`, `Tabs`/`Segmented`, `Skeleton`, `Collapse`, `PageHeading`, `MetricCard`, `DataTable`, `EmptyState`/`ErrorState`/`Notice`, `StatusBadge`, `RiskIndicator`, `ConfidenceIndicator`, `NliBar`, `ClaimCard`, `EvidencePanel`, `TechnicalDetails`, `ChartCard`, `VerdictDonut`.
- Honest data: removed the non-functional header search and bell, the static "LIVE" pill and other hard-coded figures; the landing page's example scores are labelled "Illustration only"; the OCR floor and engine settings are read from the engine configuration.
- "Unverifiable" is shown wherever the backend key is `UNVERIFIED`. A claim whose language-model reading disagrees with the final verdict now says "Language model alone: ... overruled by <rule>" instead of showing "entails" beside a Contradicted badge.
- Responsive from 375 px (no horizontal scroll on any route) and keyboard accessible (skip link, visible focus, labelled controls, focus trap in dialogs and the drawer, arrow-key navigation in tabs).
- `scroll-padding-top` on `html`: focused or scrolled-to elements no longer end up hidden under the sticky header (this also removed a ~1 s retry delay when the demo recorder clicked claim rows).
- Forced-colours (Windows high contrast) rules so the current page, pressed filters, selected tabs and sidebar icons stay visible.

### Documentation

- README "Second test (2026-11-13)": the held-out test split was re-run unchanged on pipeline 4.2 (`data/eval/results/second_test/`); all 960 verdicts match the first run (VERIFIN 95.2 macro-F1, 94.6% accuracy). the two Qwen 7B judge baselines were re-run with a fresh answer cache and also match the original run (14.6 and 82.2 macro-F1). The dev split was not re-run.
- README "Design Philosophy" rewritten (vision, principles, colour system, typography, motion, responsiveness, accessibility).
- New [docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md): tokens, scales, motion, component catalogue, chart conventions, colour-blind note, accessibility and responsive rules, how to add a page or component, demo build recipe.
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): new Frontend section (routes, shell, state and auth, API layer, charts, build); [frontend/README.md](frontend/README.md) replaced the Vite template text.
- [docs/DEMO_SCRIPT.md](docs/DEMO_SCRIPT.md) and [docs/VIDEO_SHOT_LIST.md](docs/VIDEO_SHOT_LIST.md) use the new labels ("Use sample", "Verify claims", "Download PDF", Administration > "Audit trail" > "Verify integrity", "Show technical details", "Open full claim audit"); the narration facts are unchanged.
- Demo build recipe: build the interface with `VITE_API_BASE_URL=/` and `VITE_BASE=/` (in PowerShell) so the API can serve it; `scripts/start_demo.ps1` does this.

### Known limits

- Report figures in `docs/report/` still show the previous interface and were not touched.
- A real screen reader, a real OS high-contrast theme and a physical print of the results page were not checked by a person (keyboard, forced-colours and print behaviour were checked with browser emulation).
