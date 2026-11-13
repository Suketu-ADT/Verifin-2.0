# VERIFIN design system

> Trust Through Transparency. Intelligence Through Evidence.

This is the reference for the interface in `frontend/`. It describes what the code does today; where a value is declared, the file is named so the two can be kept in step. The redesign is frontend only: no backend, API, authentication or verification logic changed, and no metric on screen is invented.

Contents: [Principles](#principles) · [Tokens](#tokens) · [Typography](#typography) · [Spacing, radius, shadow](#spacing-radius-and-shadow) · [Motion](#motion) · [Verdicts and risk](#verdicts-and-risk) · [Component catalogue](#component-catalogue) · [Charts](#charts) · [Colour-blind safety](#colour-blind-safety-an-honest-note) · [Accessibility](#accessibility) · [Responsive rules](#responsive-rules) · [Adding a page or component](#adding-a-page-or-component) · [Building for a demo](#building-for-a-demo)

## Principles

1. **Trustworthy and professional.** Light canvas, deep-navy sidebar, neutral greys, one typeface.
2. **Transparency over complexity.** A verdict always shows its evidence, its page and the rule that decided it. Technical detail is available but never forced.
3. **Data-driven visuals.** Charts show what the API or the recorded evaluation returned. Missing data renders as "unavailable" or an empty state, never a placeholder number.
4. **Clarity over noise.** One accent for interaction. Colour is reserved for meaning (verdict, risk, health), so it still means something when it appears.
5. **Enterprise UX, progressive disclosure.** Summary, then claim, then evidence, then technical record.

## Tokens

Every token is declared once, in the `@theme` block of `frontend/src/index.css` (Tailwind v4, CSS-first; there is no `tailwind.config.js`). Each token becomes a utility class, so `--color-surface` is `bg-surface`, `text-surface`, `border-surface`. **Use the token class, never a raw hex value in a component.** The only places hex values appear are `lib/verdict.ts` and `components/charts/chartKit.tsx`, because SVG marks cannot read Tailwind classes; they hold the same values as the tokens.

### Neutrals and brand

| Token | Value | Use |
|---|---|---|
| `canvas` | `#f7f9fc` | page background |
| `surface` | `#ffffff` | cards, inputs, popovers |
| `subtle` | `#f1f5f9` | hover fill, table header, skeleton base |
| `line` | `#e2e8f0` | hairlines and card borders (also the default border colour) |
| `line-strong` | `#cbd5e1` | input and secondary-button borders |
| `ink` | `#172033` | primary text |
| `muted` | `#64748b` | secondary text |
| `faint` | `#94a3b8` | decorative only (icons, dividers); never used for text |
| `navy` | `#0b1220` | sidebar background |
| `navy-line` | `#1b2638` | dividers inside the sidebar |
| `brand` | `#142b4a` | primary button, key accents |
| `brand-2` | `#1e3a5f` | hover state, links, single-hue chart magnitude |
| `brand-tint` | `#eaf0f8` | brand chips and selected rows |
| `focus` | `#2f6bb3` | focus ring on light surfaces |
| `sky` | `#8db4e8` | active marker and focus ring on the navy sidebar |

### Status

Each status has four tokens: the base colour (marks, icons, bars), `-fg` (text on its tint; darker so it passes contrast), `-tint` (background) and `-line` (border).

| Status | Base | `-fg` | `-tint` | `-line` | Meaning |
|---|---|---|---|---|---|
| `supported` | `#16a34a` | `#15803d` | `#f0fdf4` | `#bbf7d0` | the document backs the claim; healthy |
| `contradicted` | `#dc2626` | `#b91c1c` | `#fef2f2` | `#fecaca` | the document says otherwise; error |
| `unverifiable` | `#d97706` | `#b45309` | `#fffbeb` | `#fde68a` | no evidence either way; degraded |
| `neutral` | `#64748b` | `#475569` | `#f1f5f9` | `#e2e8f0` | plain facts, no judgement |

The four base colours are fixed by the product (Supported #16A34A, Contradicted #DC2626, Unverifiable #D97706, Neutral #64748B) and are not themeable. Do not use a status colour for decoration or as "series 4" in a chart.

### Risk scale

Risk is a separate scale so it cannot be mistaken for a verdict: three navy steps, `risk-low` `#8fa6c4`, `risk-medium` `#4d6d97`, `risk-high` `#142b4a`. `RiskIndicator` draws it as a three-segment meter with the word ("Low risk", "Medium risk", "High risk"); `RISKS` in `lib/verdict.ts` holds the same values and the meaning text. Confidence is a plain neutral bar (`ConfidenceIndicator`), never a status colour.

## Typography

| Role | Font | Notes |
|---|---|---|
| Interface | `--font-sans`: Inter Variable | bundled by `import "@fontsource-variable/inter"` in `main.tsx`, so there is no request to a font CDN. Base size 14px, line height 1.5, `cv11` and `ss03` features on |
| Source quotes | `--font-serif` | the `.excerpt` class, for text copied from the document so it reads as a quotation |
| Code, ids, hashes | `--font-mono` | |

Use `.num` (tabular numerals) on any figure that sits in a column or a metric. Page titles are `text-2xl font-semibold tracking-tight` (via `PageHeading`), card titles `text-[15px] font-semibold`, secondary text `text-[13px] text-muted`, chips `text-xs`. Body text on a coloured tint uses the `-fg` token, not the base colour.

## Spacing, radius and shadow

- **Spacing** is the stock Tailwind 4px scale. Page gutters are `px-4 sm:px-6 lg:px-8`; vertical rhythm between sections is `space-y-6` (`gap-4` inside a grid of cards); the content column is capped at `max-w-[1280px]`.
- **Radius**: `xs` 4px (swatches), `sm` 6px, `md` 8px (buttons, inputs, chips), `lg` 12px (cards, tooltips), `xl` 16px (modals, hero panels).
- **Shadow**: `xs` (buttons, inputs), `sm` (cards at rest), `md` (hover lift, menus, tooltips), `lg` (modals, toasts). Shadows are low and cool-grey; elevation is shown with border first, shadow second.

## Motion

Quiet, short and consistent. Motion explains a change; it never makes anyone wait.

| Token | Value | Use |
|---|---|---|
| `--motion-fast` / `DURATION.fast` | 150 ms | hover, press, colour changes |
| `--motion-base` / `DURATION.base` | 200 ms | route change, fades, expand and collapse |
| `--motion-slow` / `DURATION.slow` | 300 ms | entrance of cards and charts, bar widths |
| `CHART_DRAW_MS` | 450 ms | recharts drawing bars, lines and rings once on mount. The only duration above 300 ms |
| `--ease-out-soft` / `EASE` | `cubic-bezier(0.22, 0.61, 0.36, 1)` | everything that enters or changes |
| `--ease-in-out-soft` | `cubic-bezier(0.4, 0, 0.2, 1)` | expand and collapse |

The CSS variables are in `index.css`; the JavaScript constants for framer-motion and recharts are in `frontend/src/lib/motion.ts`. **Keep the two in step.**

What moves:

- **Route change**: `Layout` wraps the outlet in a `motion.div key={pathname}` that fades in and slides up 6px in `DURATION.base`. The sidebar and header do not re-mount, so there is no layout jump. `html { scrollbar-gutter: stable }` stops a page without a scrollbar from shifting sideways.
- **Staggered entrance**: add `stagger` to a grid or list and each direct child rises in (`--animate-rise`, 300 ms) with delays of 0/40/80/120/160/200 ms, capped at 240 ms from the seventh child. Used for metric cards, claim lists and chart blocks. The animation uses a `backwards` fill, so it leaves no transform behind (menus and tooltips inside a card are not trapped in a new stacking context).
- **Expand and collapse**: `Collapse` animates `grid-template-rows` between `0fr` and `1fr`, so no heights are measured, content stays mounted and collapsed content is `inert`. The claim card and the "Technical details" section use it.
- **Hover and press**: `Button` darkens and moves 1px on press; an interactive `Card` lifts to `shadow-md` and settles on press; sidebar links change background and colour; all in `--motion-fast`.
- **Sidebar active state**: the active marker fades in (`animate-fade-in`) and the link colours transition.
- **Skeleton to content**: `Skeleton` shimmers; `MetricCard` values and `DataTable` bodies fade in (`animate-fade-in`) when data arrives, and a `stagger` container replays its entrance for the real children.
- **Charts**: recharts draws once on mount using `useChartMotion()` from `chartKit.tsx`; the three verdict-bar and meter widths transition in `--motion-slow`.
- **Overlays**: `Modal`, `Dropdown` and `ToastProvider` use framer-motion with the same tokens.

Rules: no bounce, no overshoot, no parallax, no looping animation except the skeleton shimmer and the spinner, nothing that blocks input (everything is `pointer-events`-neutral and finishes within 300 ms), no animation of layout properties other than the `Collapse` row.

**Reduced motion.** `main.tsx` wraps the app in `<MotionConfig reducedMotion="user">`, so framer-motion drops transforms and keeps opacity. In `index.css`, `@media (prefers-reduced-motion: reduce)` sets all animation and transition durations to 0.001 ms, removes the `.stagger` animation and the skeleton shimmer, and `useChartMotion()` turns chart drawing off. Result: pages change with a plain fade, expansions are instant, nothing slides, nothing shimmers.

## Verdicts and risk

`frontend/src/lib/verdict.ts` is the single place that decides how a verdict or risk looks; badges, charts, tables and cards all read from it.

- `VERDICTS`, `VERDICT_ORDER` (`SUPPORTED`, `CONTRADICTED`, `UNVERIFIABLE`), `verdictMeta(raw)`, `normalizeVerdict(raw)` (maps `ENTAILMENT`, `VERIFIED` and so on onto the three).
- The backend key `UNVERIFIED` is displayed as **Unverifiable** everywhere (`VerdictMeta.backendKey` keeps the mapping).
- Each verdict has a label, one-sentence meaning, icon (`CheckCircle2`, `AlertTriangle`, `HelpCircle`), colour, `chip`/`tint`/`border`/`bar` classes and a texture class (`tex-contradicted` stripes, `tex-unverifiable` dots).
- `RISKS`, `riskMeta(raw)`, `normalizeRisk(raw)` for the risk scale (`UNKNOWN` renders as "Risk unavailable").

**A status is never colour alone**: always icon + word (`StatusBadge`), and a texture plus legend plus tooltip plus table view in charts.

## Component catalogue

Components live in `frontend/src/components/`, grouped by role. Import with the `@/` alias (`@/components/ui/button`). Props below are the ones in use; check the file for the complete type.

### `ui/` primitives

| Component | Props and notes |
|---|---|
| `Button` (`button.tsx`, also `buttonVariants`) | `variant`: `primary` · `secondary` (default) · `ghost` · `danger` · `link`. `size`: `sm` · `md` (default) · `lg` · `icon` · `icon-sm`. `loading` shows a spinner, disables the button and sets `aria-busy`. Use one `primary` per view; `danger` only for destructive actions |
| `Input`, `Textarea`, `Select`, `Field` (`input.tsx`) | `Field({ label, htmlFor, hint, error, children })` renders the label, hint and error and wires them up; always wrap a control in a `Field` or give it its own `<label>`. `fieldClass` is exported for custom controls |
| `Card`, `CardHeader`, `CardBody`, `CardFooter`, `Section`, `DetailRow` (`card.tsx`) | `Card({ interactive })` adds the hover lift for clickable cards. `CardHeader({ title, description, action })`. `Section({ title, description })` is a titled settings block. `DetailRow({ label, hint, children })` is a label/value line |
| `Badge` (`badge.tsx`) | `tone`: `neutral` (default) · `outline` · `brand` · `success` · `danger` · `warning`. For plain facts ("Page 12", "Hybrid") and non-verdict states ("Healthy", "Degraded"). Verdicts use `StatusBadge` instead |
| `Skeleton`, `SkeletonMetricCard`, `SkeletonCard({ lines })`, `SkeletonRows({ rows })`, `PageSkeleton` (`skeleton.tsx`) | placeholders that match the shape of the real content so nothing jumps when it arrives |
| `Modal` (`modal.tsx`) | `{ open, onClose, title, description, children, footer, size: "sm" \| "md" \| "lg" }`. Traps focus, closes on Escape, restores focus to the opener |
| `Dropdown`, `DropdownItem`, `DropdownLabel`, `DropdownSeparator` (`dropdown.tsx`) | `Dropdown({ trigger, placement, menuClassName })`; `DropdownItem({ icon, onSelect, to, danger })` |
| `ToastProvider`, `useToast()` (`toast.tsx`) | `toast({ title, description, tone: "success" \| "error" \| "info" })`. Errors stay 8 s, others 5 s; at most four visible. The provider is mounted in `main.tsx` |
| `Segmented`, `Tabs` (`tabs.tsx`) | `Segmented({ value, onChange, options: [{ value, label, count }], label, size })` is a compact switch (filters, Chart/Table). `Tabs({ value, onChange, tabs: [{ value, label, icon }], label })` is a `tablist` of `role="tab"` buttons (`aria-selected`, `aria-controls="panel-<value>"`; each tab is its own Tab stop, there is no roving arrow-key behaviour yet) |
| `Collapse` (`collapse.tsx`) | `{ open, children, id, className }`. Smooth expand and collapse, content stays mounted and is `inert` when closed. Pair the toggle with `aria-expanded` and `aria-controls={id}` |

### `shared/` building blocks

| Component | Props and notes |
|---|---|
| `PageHeading` | `{ title, subtitle, actions, back, meta }`. The one `<h1>` of a page |
| `MetricCard` | `{ label, value, hint, icon, verdict, kind: "usage" \| "performance", loading, to }`. `verdict` tints the icon with a status colour; `to` makes the card a link; `loading` shows a skeleton and crossfades to the value |
| `DataTable<T>` | `{ columns, rows, rowKey, caption, loading, empty, onRowClick, bare, dense, maxHeight, defaultSort }`. `Column { key, header, cell, align, sortValue, hideBelow: "sm" \| "md" \| "lg" \| "xl", className, numeric }`. A column with `sortValue` gets a sortable header (`aria-sort`); `hideBelow` drops low-priority columns on narrow screens; `onRowClick` rows are keyboard-focusable and open on Enter |
| `EmptyState`, `ErrorState`, `Notice` (`states.tsx`) | `EmptyState({ icon, title, message, actionLabel, onAction, bare })`, `ErrorState({ title, message, onRetry, bare })`, `Notice({ tone: "info" \| "success" \| "warning" \| "error", title, action })` for inline messages |

### `verification/`

| Component | Props and notes |
|---|---|
| `StatusBadge` | `{ status, size: "sm" \| "md" \| "lg", iconOnly }`. Accepts any API or NLI status string; renders icon + word in the verdict's colours |
| `RiskIndicator` | `{ level, score, size, showLabel }`. Three-segment navy meter with the word |
| `ConfidenceIndicator` | `{ value, label, width }`. Neutral bar plus the percentage, `.num` |
| `NliBar` | `{ nli: { entailment, neutral, contradiction } }`. The language-model reading as a three-part bar |
| `EvidencePanel` | `{ evidence, documentName, showScores }`. The quoted passage (`.excerpt`), its page, retrieval method and optional scores. `hasEvidence()` and `retrievalLabel()` are exported helpers |
| `TechnicalDetails` | `{ claim }`. Full technical record of one claim (retrieval scores, NLI, numeric finding, deciding rule) |
| `ClaimCard` | `{ claim, index, sessionId, documentName, open, onToggle }`. Collapsed row (number, text, verdict, confidence, risk, evidence page, deciding rule) that expands to the explanation, evidence and a "Show technical details" toggle, with an "Open full claim audit" link. When the language model alone would say the opposite of the final verdict it says so ("Language model alone: … overruled by <rule>") |

### `charts/`

`chartKit.tsx` and `VerdictDonut.tsx`; see [Charts](#charts).

### `layout/`

| File | Role |
|---|---|
| `Layout.tsx` | the shell for every signed-in route: skip link, `Sidebar`, `Header`, `<main id="main">` and the animated outlet |
| `Sidebar.tsx` | `{ collapsed, onToggleCollapsed, drawerOpen, onCloseDrawer, isDesktop }`. Grouped navigation from `NAV`, the profile menu (My account, Settings, Sign out) at the foot, collapsible rail on desktop (state kept in `localStorage` under `verifin.sidebar.collapsed`), drawer below 1024px with focus moved in, Escape to close, focus restored |
| `Header.tsx` | breadcrumb from `locate()`, `EngineStatus` health chip (live from `/system/health`, "checking" until the first answer), "New verification" button, and the menu button that opens the drawer on small screens |
| `nav.ts` | `NAV` (the sidebar items, grouped Workspace / Insights / System, `role: "admin"` hides an item), `EXTRA_TITLES`, `isActive()`, `locate()` |

### Others

`PdfEvidenceViewer` (pdf.js viewer with highlighted evidence boxes), `EmailCodeForm`, `PasswordResetForm`, `GoogleSignInButton` (sign-in pieces used by `pages/Auth.tsx` and Settings/Account).

### Hooks and helpers (`frontend/src/lib/`)

`useStoredState(key, initial)` (localStorage with in-memory fallback), `useMediaQuery(query)`, `useSystemHealth()`, `useHistory(limit)`, `useToast()`, `useAuth()`; `format.ts` (`humanize`, `percent`, `shortDate`), `utils.ts` (`cn`), `rules.ts` (`ruleInfo`, names for the deciding rules), `figureCheck.ts`.

## Charts

All charts are recharts, wrapped in the shared kit `components/charts/chartKit.tsx` so they look and behave the same:

- **`ChartCard`** gives every chart a title, optional subtitle, a legend slot, a screen-reader `summary` (the chart is `role="img"` with that text) and a **Show table / Show chart** switch when `table` rows are passed. Always pass `table`.
- **`Legend`** is always present for two or more series and carries swatch, texture and, for verdicts, the icon. `verdictLegend` is the ready-made verdict legend.
- **`VerdictPatterns`** adds the SVG `<pattern>` fills (`vt-contradicted` stripes, `vt-unverifiable` dots) inside a chart; `verdictFill(verdict)` returns the right fill. HTML bars use the `.tex-contradicted` / `.tex-unverifiable` classes instead.
- **`VerdictBar`** is a single HTML bar split by verdict with textures and a text label; **`VerdictDonut`** is the ring version with the total in the centre.
- **`TooltipCard`** is the tooltip every chart uses (title plus label/value rows, `.num` values).
- **`ChartTable`** is the accessible table view (caption, scoped headers, scrollable region).
- Constants: `SURFACE` (white), `VERDICT`, `MAGNITUDE` (`#1e3a5f`, one hue for plain counts), `COMPARED` (`#64748b`, for the systems VERIFIN is compared with), `INK`, `GRID`, `CURSOR`, `GAP` (a 2px surface-coloured stroke between touching marks), `axisTick`.
- **`useChartMotion()`** returns the recharts animation props and switches animation off for reduced motion.

Conventions: thin marks, 4px rounded data ends, a 2px surface gap between touching fills, recessive grid, text in ink tokens (never in the series colour), one y-axis (no dual-axis charts), and colour follows the entity: Supported is always green, never repainted by a filter. Verdict colours come from `VERDICTS`; plain magnitudes use `MAGNITUDE`.

## Colour-blind safety: an honest note

The mandated verdict colours were run through the data-viz palette validator on the white chart surface (light mode):

- Lightness band, chroma floor and contrast: **pass**.
- Colour-blind separation of Supported (green) from Contradicted (red): **fail**, ΔE 5.0 under deuteranopia (the target is 8 or more; 6 to 8 is allowed only with a secondary encoding).
- Normal-vision separation of Unverifiable (amber) from Contradicted (red): **fail**, ΔE 14.4 against a floor of 15.

So colour alone does not keep the three verdicts apart for every viewer, and the palette was not changed because the colours are a product requirement. The interface therefore never depends on colour alone:

1. every verdict mark carries an **icon and the word** (`StatusBadge`, `Legend`);
2. chart and bar fills carry a **texture**: solid for Supported, diagonal stripes for Contradicted, dots for Unverifiable;
3. touching marks are separated by a **2px surface gap**;
4. every chart has a **tooltip with the exact values** and a **table view**;
5. risk uses a separate navy scale, so it never competes with the verdict colours.

If the palette is ever allowed to change, re-run the validator and replace these mitigations only after the pairs pass. There is no dark theme, so no dark-mode validation applies.

## Accessibility

- **Focus**: every interactive element has a visible 2px ring (`--color-focus`; `--color-sky` inside `.on-navy`), never removed without a replacement. Focus moves into drawers and modals and returns to the opener on close.
- **Landmarks and headings**: "Skip to content" link first, `<main id="main">`, one `<h1>` per page via `PageHeading`, headings in order; sections are named with `aria-labelledby`.
- **Forms**: each control has a visible label (`Field`), errors and hints are associated with the control, errors are announced.
- **Tabs, menus, expandable rows**: `Tabs` uses `tablist`/`tab` roles; `Dropdown` closes on Escape and moves with the arrow keys; `Segmented` uses `aria-pressed` buttons; expanders use `aria-expanded` and `aria-controls`; collapsed content is `inert`; clickable table rows are focusable and open on Enter.
- **Live regions**: toasts, loading states (`role="status"`) and errors (`role="alert"`) are announced.
- **Tables**: captions, scoped headers, `aria-sort` on sortable columns.
- **Contrast**: body text is `ink` or `muted` on `surface`/`canvas`; text on a status tint uses the `-fg` token; `faint` is decorative only.
- **Not colour alone**: see above.
- **Reduced motion**: see [Motion](#motion).
- **Print**: `.no-print` and the print stylesheet hide the sidebar and header.

Not verified by a person: a screen-reader pass, forced-colours mode and print output.

## Responsive rules

Mobile-first, Tailwind breakpoints (`sm` 640, `md` 768, `lg` 1024, `xl` 1280).

- Below `lg` (1024px) the sidebar is a drawer opened from the header menu button; at `lg` and above it is a rail that can collapse to icons.
- Page gutters grow `px-4` → `sm:px-6` → `lg:px-8`; the content column is capped at 1280px and centred.
- Grids start at one column and add columns at `sm`/`lg`/`xl` (KPI cards 1 → 2 → 4); two-chart rows stack until `xl`.
- Tables: use `hideBelow` to drop secondary columns; the table scrolls inside its own container, never the page.
- Every flex or grid child that holds text needs `min-w-0` so long names truncate or wrap instead of widening the page (`Card` already has it).
- The scroll container is the window (`window.scrollTo`), not an inner element.
- Rule of thumb: no page may scroll sideways at 375px wide.

## Adding a page or component

**A page**

1. Create `frontend/src/pages/MyPage.tsx` with a default export. Start with `<div className="space-y-6">` and `<PageHeading title="…" subtitle="…" />`.
2. Register the route in `frontend/src/App.tsx` inside the `RequireAuth` and `Layout` routes (wrap in `<RequireRole minimum="admin">` if restricted).
3. Add it to `NAV` in `components/layout/nav.ts` (group, icon, `role`); that also drives the header breadcrumb through `locate()`. Pages reached from elsewhere go in `EXTRA_TITLES`.
4. Load data through `lib/api.ts`. Show `Skeleton*` while loading, `EmptyState` when empty and `ErrorState` with `onRetry` on failure. Never show a number you did not receive.
5. Put `stagger` on grids of cards you want to enter in turn. Use `MetricCard` for KPIs, `DataTable` for tables, `ChartCard` for charts.
6. Check it at 375px and 1280px, with the keyboard, and with reduced motion on.

**A component**

1. Put it in `ui/` (generic), `shared/` (page-level building block), `verification/` (about claims and verdicts) or `charts/`.
2. Use token classes only (`bg-surface`, `text-muted`, `border-line`, `rounded-md`, `shadow-sm`); no raw colours, no `style={{ color }}` except for SVG marks.
3. Variants with `cva` (see `button.tsx`), classes merged with `cn()`. Accept `className` and spread the native props.
4. Transitions use `duration-[var(--motion-fast)]` and `ease-[var(--ease-out-soft)]`; JavaScript animation imports `DURATION` and `EASE` from `lib/motion.ts`.
5. A new status or verdict display goes through `lib/verdict.ts`, never a new colour.
6. Add the component to this catalogue.

**A token**: add it to `@theme` in `index.css`; it becomes a utility class automatically. If an SVG needs it, mirror the value in `chartKit.tsx` and add a line to the tables above.

## Building for a demo

The API can serve the built interface itself, which is how the recorded demo runs. Build with both variables set to `/` so assets and API calls use the same address that served the page:

```powershell
cd frontend
$env:VITE_API_BASE_URL = "/"
$env:VITE_BASE = "/"
npm ci
npm run build        # writes frontend/dist
```

Use PowerShell: Git Bash rewrites a bare `/` into a Windows path. `scripts/start_demo.ps1` sets both variables and starts the API with `FRONTEND_DIST` pointing at the build. For GitHub Pages the deploy workflow sets `VITE_BASE=/<repository>/` instead.
