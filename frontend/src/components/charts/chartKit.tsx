import { useEffect, useState, type ReactNode } from "react"
import { CHART_DRAW_MS } from "@/lib/motion"
import { BarChart3, Table2 } from "lucide-react"
import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { VERDICTS, VERDICT_ORDER, type Verdict } from "@/lib/verdict"

export { humanize, percent, shortDate } from "@/lib/format"

/**
 * Shared pieces for every chart.
 *
 * Colour: the three verdict colours are fixed by the design system (supported #16a34a, contradicted #dc2626, unverifiable #d97706).
 * Checked with the data-viz palette validator on a white surface they pass the lightness, chroma and contrast checks but NOT the
 * colour-blind separation check (green against red, ΔE 5.0 for deuteranopia) or the normal-vision floor for amber against red.
 * Per the validator's own rule that is acceptable only with secondary encoding, so every verdict mark here also carries:
 *   - a texture (solid = supported, diagonal stripes = contradicted, dots = unverifiable), via VerdictPatterns / .tex-* classes
 *   - a legend with an icon and the word, and direct values in the tooltip and the table view
 *   - a 2px surface-coloured gap between touching marks
 */
export const SURFACE = "#ffffff"
export const VERDICT = {
  SUPPORTED: VERDICTS.SUPPORTED,
  CONTRADICTED: VERDICTS.CONTRADICTED,
  UNVERIFIED: VERDICTS.UNVERIFIABLE,
} as const
/** One hue for plain magnitudes (counts of things that are not a verdict). */
export const MAGNITUDE = "#1e3a5f"
/** The systems VERIFIN is compared with. */
export const COMPARED = "#64748b"
export const INK = { primary: "#172033", secondary: "#64748b", muted: "#64748b" }
export const GRID = "#e2e8f0"
export const CURSOR = { fill: "rgba(20,43,74,0.05)" }
export const GAP = { stroke: SURFACE, strokeWidth: 2 }

export const axisTick = { fill: INK.secondary, fontSize: 12 }

/** Chart animation on, unless the person asked for reduced motion. */
export function useChartMotion() {
  const [reduced, setReduced] = useState(() => (typeof window !== "undefined" ? window.matchMedia("(prefers-reduced-motion: reduce)").matches : false))
  useEffect(() => {
    const q = window.matchMedia("(prefers-reduced-motion: reduce)")
    const on = () => setReduced(q.matches)
    q.addEventListener("change", on)
    return () => q.removeEventListener("change", on)
  }, [])
  return { isAnimationActive: !reduced, animationDuration: CHART_DRAW_MS, animationEasing: "ease-out" as const }
}

/** SVG pattern fills, to be placed inside a recharts chart (as a child) or an svg. */
export function VerdictPatterns() {
  return (
    <defs>
      <pattern id="vt-contradicted" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <rect width="6" height="6" fill={VERDICTS.CONTRADICTED.color} />
        <rect width="2" height="6" fill="rgba(255,255,255,0.55)" />
      </pattern>
      <pattern id="vt-unverifiable" width="6" height="6" patternUnits="userSpaceOnUse">
        <rect width="6" height="6" fill={VERDICTS.UNVERIFIABLE.color} />
        <circle cx="3" cy="3" r="1.2" fill="rgba(255,255,255,0.75)" />
      </pattern>
    </defs>
  )
}

export function verdictFill(v: Verdict): string {
  return v === "CONTRADICTED" ? "url(#vt-contradicted)" : v === "UNVERIFIABLE" ? "url(#vt-unverifiable)" : VERDICTS.SUPPORTED.color
}

/** Legend row: a swatch (with the verdict's texture) and the name in text ink, with an icon for verdicts. */
export function Legend({ items, className }: { items: { label: string; color: string; texture?: string; Icon?: React.ComponentType<{ className?: string }> }[]; className?: string }) {
  return (
    <ul className={cn("flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px] text-ink", className)} aria-label="Legend">
      {items.map(({ label, color, texture, Icon }) => (
        <li key={label} className="flex items-center gap-1.5">
          <span className={cn("size-3 rounded-[3px]", texture)} style={{ backgroundColor: color }} aria-hidden="true" />
          {Icon && <Icon className="size-3.5 text-muted" aria-hidden="true" />}
          {label}
        </li>
      ))}
    </ul>
  )
}

export const verdictLegend = VERDICT_ORDER.map((k) => {
  const v = VERDICTS[k]
  return { label: v.label, color: v.color, texture: v.texture, Icon: v.Icon }
})

/** Tooltip card. `rows` are label/value pairs, each with an optional swatch. */
export function TooltipCard({ title, rows }: { title: string; rows: { label: string; value: string; color?: string }[] }) {
  return (
    <div className="rounded-lg border border-line bg-surface p-2.5 text-xs shadow-md">
      <div className="mb-1.5 font-semibold text-ink">{title}</div>
      <div className="space-y-1">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between gap-6">
            <span className="flex items-center gap-1.5 text-muted">
              {r.color && <span className="size-2 rounded-[2px]" style={{ backgroundColor: r.color }} aria-hidden="true" />}
              {r.label}
            </span>
            <span className="num font-semibold text-ink">{r.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export interface TableColumn<T> {
  header: string
  cell: (row: T) => ReactNode
  align?: "left" | "right"
}

export function ChartTable<T>({ columns, rows, caption }: { columns: TableColumn<T>[]; rows: T[]; caption: string }) {
  return (
    <div className="max-h-72 overflow-auto rounded-lg border border-line" tabIndex={0} role="region" aria-label={`${caption} (scrollable)`}>
      <table className="w-full text-left text-[13px]">
        <caption className="sr-only">{caption}</caption>
        <thead className="sticky top-0 bg-canvas text-xs text-muted">
          <tr>
            {columns.map((c) => (
              <th key={c.header} scope="col" className={cn("px-3 py-2 font-medium", c.align === "right" && "text-right")}>{c.header}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line text-ink">
          {rows.map((row, i) => (
            <tr key={i}>
              {columns.map((c) => (
                <td key={c.header} className={cn("px-3 py-1.5", c.align === "right" && "num text-right")}>{c.cell(row)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

interface ChartCardProps<T> {
  title: string
  subtitle?: string
  /** Text read out for the picture, for screen readers. */
  summary: string
  legend?: ReactNode
  /** Rows for the table view; when given, the card offers a Chart / Table switch. */
  table?: { columns: TableColumn<T>[]; rows: T[]; caption: string }
  forceTable?: boolean
  className?: string
  children: ReactNode
}

export function ChartCard<T>({ title, subtitle, summary, legend, table, forceTable = false, className = "", children }: ChartCardProps<T>) {
  const [showTable, setShowTable] = useState(false)
  const tableVisible = !!table && (forceTable || showTable)
  return (
    <Card className={cn("p-5", className)}>
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold tracking-tight text-ink">{title}</h2>
          {subtitle && <p className="mt-0.5 text-[13px] text-muted">{subtitle}</p>}
        </div>
        {table && !forceTable && (
          <button
            type="button"
            onClick={() => setShowTable((v) => !v)}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-line-strong bg-surface px-2.5 text-xs font-medium text-ink shadow-xs transition-colors hover:bg-subtle"
            aria-pressed={showTable}
          >
            {showTable ? <BarChart3 className="size-3.5" /> : <Table2 className="size-3.5" />}
            {showTable ? "Show chart" : "Show table"}
          </button>
        )}
      </header>
      {legend && <div className="mb-3">{legend}</div>}
      {tableVisible && table ? <ChartTable {...table} /> : <div role="img" aria-label={`${title}. ${summary}`}>{children}</div>}
    </Card>
  )
}

/**
 * A single horizontal bar split by verdict, with textures and the counts written out. Pure HTML, so it works in cards and tables.
 */
export function VerdictBar({ supported, contradicted, unverifiable, height = "h-2.5", className }: { supported: number; contradicted: number; unverifiable: number; height?: string; className?: string }) {
  const total = supported + contradicted + unverifiable
  const label = `${supported} supported, ${contradicted} contradicted, ${unverifiable} unverifiable`
  if (total === 0) return <div className={cn("rounded-full bg-line", height, className)} role="img" aria-label="No claims" />
  const parts: { v: Verdict; n: number }[] = [
    { v: "SUPPORTED", n: supported },
    { v: "CONTRADICTED", n: contradicted },
    { v: "UNVERIFIABLE", n: unverifiable },
  ]
  return (
    <div className={cn("flex gap-0.5 overflow-hidden rounded-full bg-surface", height, className)} role="img" aria-label={label} title={label}>
      {parts.filter((p) => p.n > 0).map((p) => (
        <div key={p.v} className={cn("h-full transition-[width] duration-[var(--motion-slow)] ease-[var(--ease-out-soft)]", VERDICTS[p.v].bar, VERDICTS[p.v].texture)} style={{ width: `${(p.n / total) * 100}%` }} />
      ))}
    </div>
  )
}
