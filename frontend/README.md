# VERIFIN frontend

The web interface for VERIFIN 2.0: React 19, TypeScript, Vite, Tailwind CSS v4, React Router 7, recharts, framer-motion and pdf.js. It only calls the REST API under `/api/v1`; verification logic lives in the backend.

Design language, tokens and component catalogue: [../docs/DESIGN_SYSTEM.md](../docs/DESIGN_SYSTEM.md). How the interface fits the rest of the system: [../docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md#frontend).

## Commands

```bash
npm install          # or npm ci for a clean install
npm run dev          # Vite dev server on http://localhost:5173
npm run build        # tsc -b, then vite build into dist/
npm run lint         # oxlint
npm run preview      # serve dist/ locally
```

The API address comes from `VITE_API_BASE_URL` (default `http://localhost:8000`). Copy `.env.example` to `.env` to change it. With authentication enabled on the API, sign in first; with `AUTH_ENABLED=false` the app opens as a local anonymous user.

## Structure

```
src/
  main.tsx              entry: font, MotionConfig (reduced motion), ToastProvider
  App.tsx               routes, auth guards
  index.css             Tailwind @theme: every design token, motion variables, utilities
  pages/                one file per route
  components/
    ui/                 primitives: button, input/Field, card, badge, modal, dropdown, toast, tabs, collapse, skeleton
    shared/             PageHeading, MetricCard, DataTable, EmptyState/ErrorState/Notice
    verification/       StatusBadge, RiskIndicator, ClaimCard, EvidencePanel, TechnicalDetails
    charts/             chartKit (ChartCard, Legend, tooltips, patterns), VerdictDonut
    layout/             Layout, Sidebar, Header, nav.ts (the navigation list)
  lib/
    api.ts              the only network module (axios, bearer token, 401 handling, response types)
    AuthContext.tsx     AuthProvider, useAuth, RequireAuth, RequireRole
    verdict.ts          how a verdict or risk level looks (single source)
    motion.ts           motion durations and easing for JavaScript animation
    hooks.ts            useStoredState, useMediaQuery, useSystemHealth
```

## Working rules

- Use token classes (`bg-surface`, `text-muted`, `border-line`), not raw colours. Tokens are declared once in `src/index.css`; there is no `tailwind.config.js`.
- A verdict or risk is always drawn through `lib/verdict.ts` and `StatusBadge` / `RiskIndicator`, with an icon and the word, never colour alone.
- Do not show a number the API did not return; use `EmptyState` or "unavailable".
- Animate with the motion tokens (`--motion-fast|base|slow`, `--ease-out-soft`, `lib/motion.ts`), 150 to 300 ms, and honour `prefers-reduced-motion`.
- A new page: create it in `pages/`, add the route in `App.tsx`, add it to `NAV` in `layout/nav.ts`. See [Adding a page or component](../docs/DESIGN_SYSTEM.md#adding-a-page-or-component).
- Test at 375px and 1280px wide, with the keyboard, and with reduced motion on.

## Build for the API-hosted demo

The API can serve the built interface from `frontend/dist` (`FRONTEND_DIST`), so the site and API share one address. Build with both variables set to `/`, in PowerShell (Git Bash rewrites a bare `/` into a Windows path):

```powershell
$env:VITE_API_BASE_URL = "/"
$env:VITE_BASE = "/"
npm run build
```

`scripts/start_demo.ps1` in the repository root does this and starts the API. For GitHub Pages the deploy workflow sets `VITE_BASE=/<repository>/` and `VITE_API_BASE_URL` to the deployed API.

## Demo recording hooks

The scripted demo recording and the demo script depend on these labels and ids; change them only together with the script: "Use sample", "Verify claims", "Download PDF", "Verify integrity", the "Audit trail" tab, claim rows named by their number (`01`, `02`, ...), "Open full claim audit", the `#statements` field and the `#login-email` / `#login-password` fields. The page scrolls with the window, not an inner container.
