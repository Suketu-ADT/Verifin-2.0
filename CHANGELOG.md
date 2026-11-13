# Changelog

Newest first. Only user-visible changes and changes to how the project is built or documented are listed.

## Unreleased: interface redesign and motion polish (2026-11-13)

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
- Responsive from 375 px (no horizontal scroll on any route) and keyboard accessible (skip link, visible focus, labelled controls, focus trap in dialogs and the drawer).

### Documentation

- README "Design Philosophy" rewritten (vision, principles, colour system, typography, motion, responsiveness, accessibility).
- New [docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md): tokens, scales, motion, component catalogue, chart conventions, colour-blind note, accessibility and responsive rules, how to add a page or component, demo build recipe.
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): new Frontend section (routes, shell, state and auth, API layer, charts, build); [frontend/README.md](frontend/README.md) replaced the Vite template text.
- [docs/DEMO_SCRIPT.md](docs/DEMO_SCRIPT.md) and [docs/VIDEO_SHOT_LIST.md](docs/VIDEO_SHOT_LIST.md) use the new labels ("Use sample", "Verify claims", "Download PDF", Administration > "Audit trail" > "Verify integrity", "Show technical details", "Open full claim audit"); the narration facts are unchanged.
- Demo build recipe: build the interface with `VITE_API_BASE_URL=/` and `VITE_BASE=/` (in PowerShell) so the API can serve it; `scripts/start_demo.ps1` does this.

### Known limits

- Report figures in `docs/report/` still show the previous interface and were not touched.
- `Tabs` has no roving arrow-key behaviour yet; a screen-reader pass, forced-colours mode and print output were not verified by a person.
- The main JavaScript chunk is about 1.5 MB; code-splitting is not done.
