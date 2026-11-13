import { useState, type ReactNode } from "react"
import { AlertTriangle, CheckCircle2, HelpCircle, Table2, BarChart3 } from "lucide-react"

/**
 * Shared pieces for the Analytics charts.
 *
 * Colours were checked with the data-viz palette validator against the card surface (#0e1016): the three verdict colours pass the
 * lightness band, chroma floor, colour-blind separation (worst pair 9.4) and contrast checks. Verdicts are never shown by colour
 * alone: every chart has a legend with an icon, and a table view of the same numbers.
 */

export const SURFACE = "#0e1016"
export const VERDICT = {
  SUPPORTED: { color: "#0d9488", label: "Supported", Icon: CheckCircle2 },
  CONTRADICTED: { color: "#e11d48", label: "Contradicted", Icon: AlertTriangle },
  UNVERIFIED: { color: "#d97706", label: "Unverified", Icon: HelpCircle },
} as const
/** One hue for plain magnitudes (counts of things that are not a verdict). */
export const MAGNITUDE = "#6366f1"
export const INK = { primary: "#f1f5f9", secondary: "#94a3b8", muted: "#64748b" }
export const GRID = "rgba(255,255,255,0.06)"

export const axisTick = { fill: INK.secondary, fontSize: 11 }

export const percent = (share: number, digits = 1) => `${(share * 100).toFixed(digits)}%`

export function humanize(raw: string): string {
  const spaced = raw.replace(/[_-]+/g, " ").trim().toLowerCase()
  return spaced ? spaced.charAt(0).toUpperCase() + spaced.slice(1) : "None"
}

export function shortDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`)
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" })
}

/** Legend row: a swatch and the name in text ink (never the series colour), with an icon for verdicts. */
export function Legend({ items }: { items: { label: string; color: string; Icon?: typeof CheckCircle2 }[] }) {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-300" aria-label="Legend">
      {items.map(({ label, color, Icon }) => (
        <li key={label} className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-[3px]" style={{ backgroundColor: color }} aria-hidden="true" />
          {Icon && <Icon className="h-3 w-3 text-slate-400" aria-hidden="true" />}
          {label}
        </li>
      ))}
    </ul>
  )
}

export const verdictLegend = Object.values(VERDICT).map(({ color, label, Icon }) => ({ color, label, Icon }))

/** Tooltip card in the site's glass style. `rows` are label/value pairs, each with an optional swatch. */
export function TooltipCard({ title, rows }: { title: string; rows: { label: string; value: string; color?: string }[] }) {
  return (
    <div className="rounded-xl border border-white/15 bg-[#0b0d13]/95 p-2.5 text-xs shadow-xl backdrop-blur">
      <div className="mb-1.5 font-semibold text-white">{title}</div>
      <div className="space-y-1">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between gap-6">
            <span className="flex items-center gap-1.5 text-slate-300">
              {r.color && <span className="h-2 w-2 rounded-[2px]" style={{ backgroundColor: r.color }} aria-hidden="true" />}
              {r.label}
            </span>
            <span className="font-mono font-semibold text-white">{r.value}</span>
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

export function DataTable<T>({ columns, rows, caption }: { columns: TableColumn<T>[]; rows: T[]; caption: string }) {
  return (
    <div className="mt-3 max-h-64 overflow-auto rounded-lg border border-white/10">
      <table className="w-full text-left text-[11px]">
        <caption className="sr-only">{caption}</caption>
        <thead className="sticky top-0 bg-[#0b0d13] text-slate-400">
          <tr>
            {columns.map((c) => (
              <th key={c.header} scope="col" className={`px-3 py-2 font-semibold ${c.align === "right" ? "text-right" : ""}`}>{c.header}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5 text-slate-200">
          {rows.map((row, i) => (
            <tr key={i}>
              {columns.map((c) => (
                <td key={c.header} className={`px-3 py-1.5 ${c.align === "right" ? "text-right font-mono" : ""}`}>{c.cell(row)}</td>
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
    <section className={`glass-card p-5 ${className}`}>
      <header className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-white">{title}</h2>
          {subtitle && <p className="mt-0.5 text-[11px] text-slate-400">{subtitle}</p>}
        </div>
        {table && !forceTable && (
          <button
            type="button"
            onClick={() => setShowTable((v) => !v)}
            className="flex items-center gap-1.5 rounded-lg border border-white/10 px-2 py-1 text-[11px] font-medium text-slate-300 hover:bg-white/5"
            aria-pressed={showTable}
          >
            {showTable ? <BarChart3 className="h-3 w-3" /> : <Table2 className="h-3 w-3" />}
            {showTable ? "Chart" : "Table"}
          </button>
        )}
      </header>
      {legend && <div className="mb-2">{legend}</div>}
      {tableVisible && table ? (
        <DataTable {...table} />
      ) : (
        <div role="img" aria-label={`${title}. ${summary}`}>{children}</div>
      )}
    </section>
  )
}
