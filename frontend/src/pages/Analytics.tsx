import { motion } from "framer-motion"
import { useCallback, useEffect, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { ArrowDown, ArrowRight, ArrowUp, BarChart3, Loader2, Table2 } from "lucide-react"
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import EmptyState from "../components/shared/EmptyState"
import ErrorState from "../components/shared/ErrorState"
import {
  ChartCard, GRID, INK, Legend, MAGNITUDE, SURFACE, TooltipCard, VERDICT, axisTick, humanize, percent, shortDate, verdictLegend,
  type TableColumn,
} from "../components/charts/chartKit"
import { errorMessage, getAnalyticsOverview, type AnalyticsOverview, type AnalyticsTotals } from "../lib/api"

const RANGES = [7, 30, 90] as const
const GAP = { stroke: SURFACE, strokeWidth: 2 } // the 2px surface gap between stacked segments
const cursor = { fill: "rgba(255,255,255,0.04)" }

function verdictOf(status: string): keyof typeof VERDICT {
  const v = status.toUpperCase()
  return v === "CONTRADICTED" ? "CONTRADICTED" : v === "UNVERIFIED" ? "UNVERIFIED" : "SUPPORTED"
}

function Tile({ label, value, note, delta }: { label: string; value: string; note?: string; delta?: { text: string; direction: "up" | "down" | "flat" } }) {
  const Arrow = delta?.direction === "up" ? ArrowUp : delta?.direction === "down" ? ArrowDown : ArrowRight
  return (
    <div className="glass-card p-4">
      <div className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">{label}</div>
      <div className="mt-1.5 font-mono text-3xl font-bold text-white">{value}</div>
      {delta && (
        <div className="mt-1 flex items-center gap-1 text-[11px] text-slate-300">
          <Arrow className="h-3 w-3" aria-hidden="true" /> {delta.text}
        </div>
      )}
      {note && <div className="mt-1 text-[11px] text-slate-500">{note}</div>}
    </div>
  )
}

/** Change in a rate, in percentage points, against the window before. Lower is better for hallucinations, but we only describe the change. */
function rateDelta(now: AnalyticsTotals, before: AnalyticsTotals, days: number) {
  if (before.claims === 0) return { text: `No data in the previous ${days} days`, direction: "flat" as const }
  const points = (now.hallucination_rate - before.hallucination_rate) * 100
  if (Math.abs(points) < 0.05) return { text: `Unchanged vs previous ${days} days`, direction: "flat" as const }
  return { text: `${Math.abs(points).toFixed(1)} pts ${points > 0 ? "higher" : "lower"} than the previous ${days} days`, direction: points > 0 ? ("up" as const) : ("down" as const) }
}

interface Bars { name: string; value: number }

/** One-hue horizontal bars for plain counts. */
function CountBars({ data, unit }: { data: Bars[]; unit: string }) {
  const height = Math.max(120, data.length * 34 + 24)
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ left: 0, right: 16, top: 4, bottom: 4 }} barCategoryGap={8}>
        <CartesianGrid horizontal={false} stroke={GRID} />
        <XAxis type="number" allowDecimals={false} tick={axisTick} axisLine={false} tickLine={false} />
        <YAxis type="category" dataKey="name" width={150} tick={axisTick} axisLine={false} tickLine={false} />
        <Tooltip cursor={cursor} content={({ active, payload }) => active && payload?.length
          ? <TooltipCard title={String(payload[0].payload.name)} rows={[{ label: unit, value: String(payload[0].value), color: MAGNITUDE }]} /> : null} />
        <Bar dataKey="value" fill={MAGNITUDE} barSize={14} radius={[0, 4, 4, 0]} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  )
}

const countColumns = (what: string, unit: string): TableColumn<Bars>[] => [
  { header: what, cell: (r) => r.name }, { header: unit, cell: (r) => r.value, align: "right" },
]

/** 100%-stacked horizontal bars: each row's three verdicts add up to all of its claims. */
function VerdictShareBars({ rows }: { rows: { name: string; supported: number; contradicted: number; unverified: number; claims: number }[] }) {
  const height = Math.max(140, rows.length * 38 + 24)
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={rows} layout="vertical" stackOffset="expand" margin={{ left: 0, right: 16, top: 4, bottom: 4 }} barCategoryGap={8}>
        <CartesianGrid horizontal={false} stroke={GRID} />
        <XAxis type="number" tickFormatter={(v) => `${Math.round(v * 100)}%`} tick={axisTick} axisLine={false} tickLine={false} />
        <YAxis type="category" dataKey="name" width={150} tick={axisTick} axisLine={false} tickLine={false}
          tickFormatter={(v: string) => (v.length > 22 ? `${v.slice(0, 21)}…` : v)} />
        <Tooltip cursor={cursor} content={({ active, payload }) => {
          if (!active || !payload?.length) return null
          const r = payload[0].payload
          return <TooltipCard title={r.name} rows={[
            { label: "Claims", value: String(r.claims) },
            { label: VERDICT.SUPPORTED.label, value: String(r.supported), color: VERDICT.SUPPORTED.color },
            { label: VERDICT.CONTRADICTED.label, value: String(r.contradicted), color: VERDICT.CONTRADICTED.color },
            { label: VERDICT.UNVERIFIED.label, value: String(r.unverified), color: VERDICT.UNVERIFIED.color },
          ]} />
        }} />
        <Bar dataKey="contradicted" stackId="v" fill={VERDICT.CONTRADICTED.color} barSize={16} {...GAP} isAnimationActive={false} />
        <Bar dataKey="unverified" stackId="v" fill={VERDICT.UNVERIFIED.color} barSize={16} {...GAP} isAnimationActive={false} />
        <Bar dataKey="supported" stackId="v" fill={VERDICT.SUPPORTED.color} barSize={16} radius={[0, 4, 4, 0]} {...GAP} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  )
}

const shareColumns = (what: string): TableColumn<{ name: string; supported: number; contradicted: number; unverified: number; claims: number }>[] => [
  { header: what, cell: (r) => r.name },
  { header: "Claims", cell: (r) => r.claims, align: "right" },
  { header: "Supported", cell: (r) => r.supported, align: "right" },
  { header: "Contradicted", cell: (r) => r.contradicted, align: "right" },
  { header: "Unverified", cell: (r) => r.unverified, align: "right" },
]

export default function Analytics() {
  const navigate = useNavigate()
  const [days, setDays] = useState<number>(30)
  const [data, setData] = useState<AnalyticsOverview | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [tables, setTables] = useState(false)

  const load = useCallback(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    getAnalyticsOverview(days)
      .then((d) => { if (!cancelled) setData(d) })
      .catch((e) => { if (!cancelled) setError(errorMessage(e, "Could not load the analytics.")) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [days])
  useEffect(() => load(), [load])

  const header = (
    <div className="glass-strong relative overflow-hidden rounded-2xl border border-white/10 p-6">
      <div className="pointer-events-none absolute right-0 top-0 h-80 w-80 rounded-full bg-indigo-500/10 blur-3xl" />
      <div className="relative z-10 flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
        <div className="space-y-1.5">
          <h1 className="text-2xl font-extrabold tracking-tight text-white lg:text-3xl">Analytics</h1>
          <p className="max-w-2xl text-sm leading-relaxed text-slate-300">
            How often claims are contradicted or left unverified, which documents and claim types are most affected, and how that is changing.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div role="group" aria-label="Time range" className="flex rounded-lg border border-white/10 p-0.5">
            {RANGES.map((r) => (
              <button key={r} type="button" onClick={() => setDays(r)} aria-pressed={days === r}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${days === r ? "bg-amber-500 text-black" : "text-slate-300 hover:bg-white/5"}`}>
                {r} days
              </button>
            ))}
          </div>
          <button type="button" onClick={() => setTables((v) => !v)} aria-pressed={tables}
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${tables ? "border-amber-500/50 bg-amber-500/10 text-amber-200" : "border-white/10 text-slate-300 hover:bg-white/5"}`}>
            <Table2 className="h-3.5 w-3.5" /> Show data tables
          </button>
        </div>
      </div>
    </div>
  )

  if (error && !data) return <div className="space-y-6">{header}<ErrorState title="Analytics unavailable" message={error} onRetry={load} /></div>
  if (!data) return <div className="space-y-6">{header}<div className="flex justify-center py-20 text-slate-400"><Loader2 className="h-6 w-6 animate-spin" aria-label="Loading" /></div></div>

  const { totals, previous, trend } = data
  if (totals.verifications === 0) {
    return (
      <div className="space-y-6">
        {header}
        <EmptyState icon={BarChart3} title={`No verifications in the last ${days} days`}
          message={data.previous.verifications > 0 ? "Try a longer range, or run a new verification." : "Run a verification and its results will appear here."}
          actionLabel="New verification" onAction={() => navigate("/verify")} />
      </div>
    )
  }

  const trendRows = trend.map((p) => ({ ...p, label: shortDate(p.date) }))
  const documentRows = data.documents.map((d) => ({ name: d.document_name, supported: d.supported, contradicted: d.contradicted, unverified: d.unverified, claims: d.claims }))
  const typeRows = data.claim_types.map((t) => ({ name: humanize(t.claim_type), supported: t.supported, contradicted: t.contradicted, unverified: t.unverified, claims: t.claims }))
  const hallucinationBars: Bars[] = data.hallucination_types.map((t) => ({ name: humanize(t.name), value: t.claims }))
  const ruleBars: Bars[] = data.rules.map((t) => ({ name: humanize(t.name), value: t.claims }))
  const riskOrder = ["LOW", "MEDIUM", "HIGH", "UNKNOWN"]
  const riskRows = [...data.risk_levels].sort((a, b) => riskOrder.indexOf(a.name) - riskOrder.indexOf(b.name)).map((r) => ({ name: humanize(r.name), value: r.verifications }))
  const riskColor: Record<string, string> = { Low: VERDICT.SUPPORTED.color, Medium: VERDICT.UNVERIFIED.color, High: VERDICT.CONTRADICTED.color }
  const binRows = data.score_bins.map((b) => ({ name: `${b.lower}–${b.upper}%`, value: b.verifications }))
  const worst = data.documents[0]

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={`space-y-6 ${loading ? "opacity-70 transition-opacity" : ""}`}>
      {header}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Tile label="Verifications" value={String(totals.verifications)} note={`${previous.verifications} in the previous ${days} days`} />
        <Tile label="Claims checked" value={String(totals.claims)} note={`${totals.unverified} unverified`} />
        <Tile label="Hallucination rate" value={percent(totals.hallucination_rate)} delta={rateDelta(totals, previous, days)} note={`${totals.contradicted} contradicted claims`} />
        <Tile label="Supported" value={percent(totals.support_rate)} note={`Average score ${totals.average_score.toFixed(1)}%`} />
      </div>

      <ChartCard title="Claims checked per day" subtitle="Each bar is one day (UTC), split by verdict"
        summary={`${totals.claims} claims over ${days} days: ${totals.supported} supported, ${totals.contradicted} contradicted, ${totals.unverified} unverified.`}
        legend={<Legend items={verdictLegend} />} forceTable={tables}
        table={{ caption: "Claims per day by verdict", rows: trendRows, columns: [
          { header: "Day", cell: (r) => r.date }, { header: "Claims", cell: (r) => r.claims, align: "right" },
          { header: "Supported", cell: (r) => r.supported, align: "right" }, { header: "Contradicted", cell: (r) => r.contradicted, align: "right" },
          { header: "Unverified", cell: (r) => r.unverified, align: "right" }] }}>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={trendRows} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke={GRID} />
            <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} minTickGap={24} />
            <YAxis allowDecimals={false} tick={axisTick} axisLine={false} tickLine={false} width={32} />
            <Tooltip cursor={cursor} content={({ active, payload }) => {
              if (!active || !payload?.length) return null
              const r = payload[0].payload
              return <TooltipCard title={shortDate(r.date)} rows={[
                { label: "Claims", value: String(r.claims) },
                { label: VERDICT.SUPPORTED.label, value: String(r.supported), color: VERDICT.SUPPORTED.color },
                { label: VERDICT.CONTRADICTED.label, value: String(r.contradicted), color: VERDICT.CONTRADICTED.color },
                { label: VERDICT.UNVERIFIED.label, value: String(r.unverified), color: VERDICT.UNVERIFIED.color },
              ]} />
            }} />
            <Bar dataKey="supported" stackId="v" fill={VERDICT.SUPPORTED.color} {...GAP} isAnimationActive={false} />
            <Bar dataKey="unverified" stackId="v" fill={VERDICT.UNVERIFIED.color} {...GAP} isAnimationActive={false} />
            <Bar dataKey="contradicted" stackId="v" fill={VERDICT.CONTRADICTED.color} radius={[4, 4, 0, 0]} {...GAP} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Hallucination rate over time" subtitle="Share of each day's claims that were contradicted (days without claims are shown as 0%)"
        summary={`Overall ${percent(totals.hallucination_rate)} over ${days} days.`} forceTable={tables}
        table={{ caption: "Daily hallucination rate", rows: trendRows, columns: [
          { header: "Day", cell: (r) => r.date }, { header: "Claims", cell: (r) => r.claims, align: "right" },
          { header: "Contradicted", cell: (r) => r.contradicted, align: "right" }, { header: "Rate", cell: (r) => percent(r.hallucination_rate), align: "right" }] }}>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={trendRows} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke={GRID} />
            <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} minTickGap={24} />
            <YAxis domain={[0, 1]} tickFormatter={(v) => `${Math.round(v * 100)}%`} tick={axisTick} axisLine={false} tickLine={false} width={40} />
            <Tooltip cursor={{ stroke: INK.muted }} content={({ active, payload }) => {
              if (!active || !payload?.length) return null
              const r = payload[0].payload
              return <TooltipCard title={shortDate(r.date)} rows={[
                { label: "Hallucination rate", value: percent(r.hallucination_rate), color: MAGNITUDE },
                { label: "Contradicted", value: `${r.contradicted} of ${r.claims}` },
              ]} />
            }} />
            <Line type="linear"dataKey="hallucination_rate" stroke={MAGNITUDE} strokeWidth={2} isAnimationActive={false}
              dot={{ r: 4, fill: MAGNITUDE, stroke: SURFACE, strokeWidth: 2 }} activeDot={{ r: 5, fill: MAGNITUDE, stroke: SURFACE, strokeWidth: 2 }} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard title="Documents most affected" subtitle={worst ? `${worst.document_name} has the highest contradicted share (${percent(worst.hallucination_rate)})` : undefined}
          summary="Verdict mix of the claims in each document, most contradicted first." legend={<Legend items={verdictLegend} />} forceTable={tables}
          table={{ caption: "Verdicts by document", rows: documentRows, columns: shareColumns("Document") }}>
          <VerdictShareBars rows={documentRows} />
        </ChartCard>
        <ChartCard title="By claim type" subtitle="Verdict mix for each kind of claim"
          summary="Verdict mix of the claims, grouped by claim type." legend={<Legend items={verdictLegend} />} forceTable={tables}
          table={{ caption: "Verdicts by claim type", rows: typeRows, columns: shareColumns("Claim type") }}>
          <VerdictShareBars rows={typeRows} />
        </ChartCard>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard title="Kinds of hallucination" subtitle="Flagged claims (contradicted or unverified) by the problem found"
          summary={hallucinationBars.length ? `Most common: ${hallucinationBars[0].name}, ${hallucinationBars[0].value} claims.` : "No flagged claims."} forceTable={tables}
          table={{ caption: "Flagged claims by kind", rows: hallucinationBars, columns: countColumns("Kind", "Claims") }}>
          {hallucinationBars.length ? <CountBars data={hallucinationBars} unit="Claims" /> : <p className="py-8 text-center text-sm text-slate-400">No flagged claims in this period.</p>}
        </ChartCard>
        <ChartCard title="What decided each claim" subtitle="The verification step that produced the verdict"
          summary={ruleBars.length ? `Most often: ${ruleBars[0].name}, ${ruleBars[0].value} claims.` : "No claims."} forceTable={tables}
          table={{ caption: "Claims by deciding rule", rows: ruleBars, columns: countColumns("Decided by", "Claims") }}>
          <CountBars data={ruleBars} unit="Claims" />
        </ChartCard>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard title="Verifications by risk level" subtitle="Overall risk assigned to each finished verification"
          summary={riskRows.map((r) => `${r.name}: ${r.value}`).join(", ")} forceTable={tables}
          table={{ caption: "Verifications by risk level", rows: riskRows, columns: countColumns("Risk", "Verifications") }}>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={riskRows} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke={GRID} />
              <XAxis dataKey="name" tick={axisTick} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={axisTick} axisLine={false} tickLine={false} width={32} />
              <Tooltip cursor={cursor} content={({ active, payload }) => active && payload?.length
                ? <TooltipCard title={`${payload[0].payload.name} risk`} rows={[{ label: "Verifications", value: String(payload[0].value), color: riskColor[payload[0].payload.name] ?? MAGNITUDE }]} /> : null} />
              <Bar dataKey="value" barSize={36} radius={[4, 4, 0, 0]} isAnimationActive={false}
                shape={(p: any) => <rect x={p.x} y={p.y} width={p.width} height={p.height} rx={4} fill={riskColor[p.name] ?? MAGNITUDE} />} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Score distribution" subtitle="Verifications by the share of their claims that were supported"
          summary={`Average score ${totals.average_score.toFixed(1)}%.`} forceTable={tables}
          table={{ caption: "Verifications by score range", rows: binRows, columns: countColumns("Score", "Verifications") }}>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={binRows} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke={GRID} />
              <XAxis dataKey="name" tick={axisTick} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={axisTick} axisLine={false} tickLine={false} width={32} />
              <Tooltip cursor={cursor} content={({ active, payload }) => active && payload?.length
                ? <TooltipCard title={`Score ${payload[0].payload.name}`} rows={[{ label: "Verifications", value: String(payload[0].value), color: MAGNITUDE }]} /> : null} />
              <Bar dataKey="value" fill={MAGNITUDE} barSize={36} radius={[4, 4, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <section className="glass-card p-5">
        <h2 className="text-sm font-bold text-white">Claims most worth reviewing</h2>
        <p className="mt-0.5 text-[11px] text-slate-400">Contradicted claims first, then unverified, highest risk score first</p>
        {data.top_claims.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-400">Nothing flagged in this period.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <caption className="sr-only">Highest-risk flagged claims</caption>
              <thead className="text-slate-400">
                <tr>
                  <th scope="col" className="py-2 pr-3 font-semibold">Verdict</th>
                  <th scope="col" className="py-2 pr-3 font-semibold">Claim</th>
                  <th scope="col" className="py-2 pr-3 font-semibold">Document</th>
                  <th scope="col" className="py-2 pr-3 text-right font-semibold">Risk</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-slate-200">
                {data.top_claims.map((c) => {
                  const v = VERDICT[verdictOf(c.verdict)]
                  return (
                    <tr key={`${c.session_id}-${c.claim_id}`} className="hover:bg-white/[0.03]">
                      <td className="whitespace-nowrap py-2 pr-3">
                        <span className="inline-flex items-center gap-1.5">
                          <v.Icon className="h-3.5 w-3.5" style={{ color: v.color }} aria-hidden="true" /> {v.label}
                        </span>
                      </td>
                      <td className="max-w-md py-2 pr-3">
                        <Link to={`/verify/results/${c.session_id}/claim/${c.claim_id}`} className="text-slate-100 underline-offset-2 hover:text-amber-300 hover:underline">{c.claim_text}</Link>
                        <div className="mt-0.5 text-[10px] text-slate-500">{humanize(c.claim_type)}{c.hallucination_type !== "none" ? ` · ${humanize(c.hallucination_type)}` : ""}</div>
                      </td>
                      <td className="py-2 pr-3 text-slate-300">{c.document_name}</td>
                      <td className="py-2 pr-3 text-right font-mono">{c.risk_score.toFixed(2)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </motion.div>
  )
}
