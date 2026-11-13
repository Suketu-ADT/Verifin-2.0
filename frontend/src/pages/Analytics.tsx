import { useCallback, useEffect, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { ArrowDown, ArrowRight, ArrowUp, BarChart3, FileCheck2, ListChecks, ShieldAlert, ShieldCheck, Table2 } from "lucide-react"
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { Button } from "@/components/ui/button"
import { Card, CardHeader } from "@/components/ui/card"
import { Segmented } from "@/components/ui/tabs"
import { SkeletonCard, SkeletonMetricCard } from "@/components/ui/skeleton"
import { PageHeading } from "@/components/shared/PageHeading"
import { MetricCard } from "@/components/shared/MetricCard"
import { DataTable, type Column } from "@/components/shared/DataTable"
import { EmptyState, ErrorState } from "@/components/shared/states"
import { StatusBadge } from "@/components/verification/indicators"
import {
  ChartCard, CURSOR, GAP, GRID, INK, Legend, MAGNITUDE, SURFACE, TooltipCard, VERDICT, VerdictPatterns, axisTick, humanize, percent, shortDate,
  useChartMotion, verdictFill, verdictLegend, type TableColumn,
} from "@/components/charts/chartKit"
import { riskMeta } from "@/lib/verdict"
import { errorMessage, getAnalyticsOverview, type AnalyticsOverview, type AnalyticsTopClaim, type AnalyticsTotals } from "../lib/api"

const RANGES = [7, 30, 90] as const

/** Change in a rate, in percentage points, against the window before. We only describe the change; whether it is good is the reader's call. */
function rateDelta(now: AnalyticsTotals, before: AnalyticsTotals, days: number) {
  if (before.claims === 0) return { text: `No data in the previous ${days} days`, Icon: ArrowRight }
  const points = (now.hallucination_rate - before.hallucination_rate) * 100
  if (Math.abs(points) < 0.05) return { text: `Unchanged vs the previous ${days} days`, Icon: ArrowRight }
  return { text: `${Math.abs(points).toFixed(1)} pts ${points > 0 ? "higher" : "lower"} than the previous ${days} days`, Icon: points > 0 ? ArrowUp : ArrowDown }
}

interface Bars { name: string; value: number }
interface ShareRow { name: string; supported: number; contradicted: number; unverified: number; claims: number }

/** One-hue horizontal bars for plain counts. */
function CountBars({ data, unit }: { data: Bars[]; unit: string }) {
  const motion = useChartMotion()
  const height = Math.max(120, data.length * 34 + 24)
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ left: 0, right: 16, top: 4, bottom: 4 }} barCategoryGap={8}>
        <CartesianGrid horizontal={false} stroke={GRID} />
        <XAxis type="number" allowDecimals={false} tick={axisTick} axisLine={false} tickLine={false} />
        <YAxis type="category" dataKey="name" width={150} tick={axisTick} axisLine={false} tickLine={false} />
        <Tooltip cursor={CURSOR} content={({ active, payload }) => active && payload?.length
          ? <TooltipCard title={String(payload[0].payload.name)} rows={[{ label: unit, value: String(payload[0].value), color: MAGNITUDE }]} /> : null} />
        <Bar dataKey="value" fill={MAGNITUDE} barSize={14} radius={[0, 4, 4, 0]} {...motion} />
      </BarChart>
    </ResponsiveContainer>
  )
}

const countColumns = (what: string, unit: string): TableColumn<Bars>[] => [
  { header: what, cell: (r) => r.name }, { header: unit, cell: (r) => r.value, align: "right" },
]

/** 100%-stacked horizontal bars: each row's three verdicts add up to all of its claims. */
function VerdictShareBars({ rows }: { rows: ShareRow[] }) {
  const motion = useChartMotion()
  const height = Math.max(140, rows.length * 38 + 24)
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={rows} layout="vertical" stackOffset="expand" margin={{ left: 0, right: 16, top: 4, bottom: 4 }} barCategoryGap={8}>
        <VerdictPatterns />
        <CartesianGrid horizontal={false} stroke={GRID} />
        <XAxis type="number" tickFormatter={(v) => `${Math.round(v * 100)}%`} tick={axisTick} axisLine={false} tickLine={false} />
        <YAxis type="category" dataKey="name" width={150} tick={axisTick} axisLine={false} tickLine={false}
          tickFormatter={(v: string) => (v.length > 22 ? `${v.slice(0, 21)}…` : v)} />
        <Tooltip cursor={CURSOR} content={({ active, payload }) => {
          if (!active || !payload?.length) return null
          const r = payload[0].payload as ShareRow
          return <TooltipCard title={r.name} rows={[
            { label: "Claims", value: String(r.claims) },
            { label: VERDICT.SUPPORTED.label, value: String(r.supported), color: VERDICT.SUPPORTED.color },
            { label: VERDICT.CONTRADICTED.label, value: String(r.contradicted), color: VERDICT.CONTRADICTED.color },
            { label: VERDICT.UNVERIFIED.label, value: String(r.unverified), color: VERDICT.UNVERIFIED.color },
          ]} />
        }} />
        <Bar dataKey="contradicted" stackId="v" fill={verdictFill("CONTRADICTED")} barSize={16} {...GAP} {...motion} />
        <Bar dataKey="unverified" stackId="v" fill={verdictFill("UNVERIFIABLE")} barSize={16} {...GAP} {...motion} />
        <Bar dataKey="supported" stackId="v" fill={verdictFill("SUPPORTED")} barSize={16} radius={[0, 4, 4, 0]} {...GAP} {...motion} />
      </BarChart>
    </ResponsiveContainer>
  )
}

const shareColumns = (what: string): TableColumn<ShareRow>[] => [
  { header: what, cell: (r) => r.name },
  { header: "Claims", cell: (r) => r.claims, align: "right" },
  { header: "Supported", cell: (r) => r.supported, align: "right" },
  { header: "Contradicted", cell: (r) => r.contradicted, align: "right" },
  { header: "Unverifiable", cell: (r) => r.unverified, align: "right" },
]

export default function Analytics() {
  const navigate = useNavigate()
  const motion = useChartMotion()
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

  const heading = (
    <PageHeading
      title="Analytics"
      subtitle="How often claims are contradicted or left unverifiable, which documents and claim types are most affected, and how that is changing. These are usage statistics from your own verifications, not model accuracy."
      actions={
        <>
          <Segmented label="Time range" size="sm" value={String(days)} onChange={(v) => setDays(Number(v))} options={RANGES.map((r) => ({ value: String(r), label: `${r} days` }))} />
          <Button size="sm" onClick={() => setTables((v) => !v)} aria-pressed={tables}><Table2 /> {tables ? "Show charts" : "Show data tables"}</Button>
        </>
      }
    />
  )

  if (error && !data) return <div>{heading}<ErrorState title="Analytics unavailable" message={error} onRetry={load} /></div>
  if (!data) {
    return (
      <div role="status" aria-label="Loading analytics">
        {heading}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <SkeletonMetricCard key={i} />)}</div>
        <div className="mt-6 space-y-6"><SkeletonCard lines={6} /><SkeletonCard lines={6} /></div>
      </div>
    )
  }

  const { totals, previous, trend } = data
  if (totals.verifications === 0) {
    return (
      <div>
        {heading}
        <EmptyState icon={BarChart3} title={`No verifications in the last ${days} days`}
          message={previous.verifications > 0 ? "Try a longer range, or run a new verification." : "Run a verification and its results will appear here."}
          actionLabel="New verification" onAction={() => navigate("/verify")} />
      </div>
    )
  }

  const trendRows = trend.map((p) => ({ ...p, label: shortDate(p.date) }))
  const documentRows: ShareRow[] = data.documents.map((d) => ({ name: d.document_name, supported: d.supported, contradicted: d.contradicted, unverified: d.unverified, claims: d.claims }))
  const typeRows: ShareRow[] = data.claim_types.map((t) => ({ name: humanize(t.claim_type), supported: t.supported, contradicted: t.contradicted, unverified: t.unverified, claims: t.claims }))
  const hallucinationBars: Bars[] = data.hallucination_types.map((t) => ({ name: humanize(t.name), value: t.claims }))
  const ruleBars: Bars[] = data.rules.map((t) => ({ name: humanize(t.name), value: t.claims }))
  const riskOrder = ["LOW", "MEDIUM", "HIGH", "UNKNOWN"]
  const riskRows = [...data.risk_levels].sort((a, b) => riskOrder.indexOf(a.name) - riskOrder.indexOf(b.name)).map((r) => ({ key: r.name, name: humanize(r.name), value: r.verifications }))
  const binRows = data.score_bins.map((b) => ({ name: `${b.lower}–${b.upper}%`, value: b.verifications }))
  const worst = data.documents[0]
  const delta = rateDelta(totals, previous, days)

  const topColumns: Column<AnalyticsTopClaim>[] = [
    { key: "verdict", header: "Verdict", cell: (c) => <StatusBadge status={c.verdict} size="sm" /> },
    {
      key: "claim", header: "Claim",
      cell: (c) => (
        <div className="max-w-lg">
          <Link to={`/verify/results/${c.session_id}/claim/${c.claim_id}`} className="text-ink underline-offset-2 hover:text-brand-2 hover:underline">{c.claim_text}</Link>
          <div className="mt-0.5 text-xs text-muted">{humanize(c.claim_type)}{c.hallucination_type !== "none" ? ` · ${humanize(c.hallucination_type)}` : ""}</div>
        </div>
      ),
    },
    { key: "doc", header: "Document", hideBelow: "md", cell: (c) => <span className="text-muted">{c.document_name}</span> },
    { key: "risk", header: "Risk score", numeric: true, align: "right", sortValue: (c) => c.risk_score, cell: (c) => c.risk_score.toFixed(2) },
  ]

  return (
    <div className={loading ? "opacity-70 transition-opacity" : "transition-opacity"}>
      {heading}
      <div className="space-y-6">
        <div className="stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard label="Verifications" icon={FileCheck2} value={totals.verifications} hint={`${previous.verifications} in the previous ${days} days`} />
          <MetricCard label="Claims checked" icon={ListChecks} value={totals.claims} hint={`${totals.unverified} unverifiable`} />
          <MetricCard label="Contradicted rate" icon={ShieldAlert} verdict="CONTRADICTED" value={percent(totals.hallucination_rate)}
            hint={<span className="inline-flex items-center gap-1"><delta.Icon className="size-3" aria-hidden="true" />{delta.text}</span>} />
          <MetricCard label="Supported rate" icon={ShieldCheck} verdict="SUPPORTED" value={percent(totals.support_rate)} hint={`Average score ${totals.average_score.toFixed(1)}%`} />
        </div>

        <ChartCard title="Claims checked per day" subtitle="Each bar is one day (UTC), split by verdict"
          summary={`${totals.claims} claims over ${days} days: ${totals.supported} supported, ${totals.contradicted} contradicted, ${totals.unverified} unverifiable.`}
          legend={<Legend items={verdictLegend} />} forceTable={tables}
          table={{ caption: "Claims per day by verdict", rows: trendRows, columns: [
            { header: "Day", cell: (r) => r.date }, { header: "Claims", cell: (r) => r.claims, align: "right" },
            { header: "Supported", cell: (r) => r.supported, align: "right" }, { header: "Contradicted", cell: (r) => r.contradicted, align: "right" },
            { header: "Unverifiable", cell: (r) => r.unverified, align: "right" }] }}>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={trendRows} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
              <VerdictPatterns />
              <CartesianGrid vertical={false} stroke={GRID} />
              <XAxis dataKey="label" tick={axisTick} axisLine={{ stroke: GRID }} tickLine={false} minTickGap={24} />
              <YAxis allowDecimals={false} tick={axisTick} axisLine={false} tickLine={false} width={32} />
              <Tooltip cursor={CURSOR} content={({ active, payload }) => {
                if (!active || !payload?.length) return null
                const r = payload[0].payload
                return <TooltipCard title={shortDate(r.date)} rows={[
                  { label: "Claims", value: String(r.claims) },
                  { label: VERDICT.SUPPORTED.label, value: String(r.supported), color: VERDICT.SUPPORTED.color },
                  { label: VERDICT.CONTRADICTED.label, value: String(r.contradicted), color: VERDICT.CONTRADICTED.color },
                  { label: VERDICT.UNVERIFIED.label, value: String(r.unverified), color: VERDICT.UNVERIFIED.color },
                ]} />
              }} />
              <Bar dataKey="supported" stackId="v" fill={verdictFill("SUPPORTED")} {...GAP} {...motion} />
              <Bar dataKey="unverified" stackId="v" fill={verdictFill("UNVERIFIABLE")} {...GAP} {...motion} />
              <Bar dataKey="contradicted" stackId="v" fill={verdictFill("CONTRADICTED")} radius={[4, 4, 0, 0]} {...GAP} {...motion} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Contradicted rate over time" subtitle="Share of each day's claims that were contradicted (days without claims show 0%)"
          summary={`Overall ${percent(totals.hallucination_rate)} over ${days} days.`} forceTable={tables}
          table={{ caption: "Daily contradicted rate", rows: trendRows, columns: [
            { header: "Day", cell: (r) => r.date }, { header: "Claims", cell: (r) => r.claims, align: "right" },
            { header: "Contradicted", cell: (r) => r.contradicted, align: "right" }, { header: "Rate", cell: (r) => percent(r.hallucination_rate), align: "right" }] }}>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={trendRows} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke={GRID} />
              <XAxis dataKey="label" tick={axisTick} axisLine={{ stroke: GRID }} tickLine={false} minTickGap={24} />
              <YAxis domain={[0, 1]} tickFormatter={(v) => `${Math.round(v * 100)}%`} tick={axisTick} axisLine={false} tickLine={false} width={40} />
              <Tooltip cursor={{ stroke: INK.muted }} content={({ active, payload }) => {
                if (!active || !payload?.length) return null
                const r = payload[0].payload
                return <TooltipCard title={shortDate(r.date)} rows={[
                  { label: "Contradicted rate", value: percent(r.hallucination_rate), color: MAGNITUDE },
                  { label: "Contradicted", value: `${r.contradicted} of ${r.claims}` },
                ]} />
              }} />
              <Line type="linear" dataKey="hallucination_rate" stroke={MAGNITUDE} strokeWidth={2} {...motion}
                dot={{ r: 4, fill: MAGNITUDE, stroke: SURFACE, strokeWidth: 2 }} activeDot={{ r: 5, fill: MAGNITUDE, stroke: SURFACE, strokeWidth: 2 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <div className="stagger grid gap-6 lg:grid-cols-2">
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

        <div className="stagger grid gap-6 lg:grid-cols-2">
          <ChartCard title="Kinds of hallucination" subtitle="Flagged claims (contradicted or unverifiable) by the problem found"
            summary={hallucinationBars.length ? `Most common: ${hallucinationBars[0].name}, ${hallucinationBars[0].value} claims.` : "No flagged claims."} forceTable={tables}
            table={{ caption: "Flagged claims by kind", rows: hallucinationBars, columns: countColumns("Kind", "Claims") }}>
            {hallucinationBars.length ? <CountBars data={hallucinationBars} unit="Claims" /> : <p className="py-8 text-center text-sm text-muted">No flagged claims in this period.</p>}
          </ChartCard>
          <ChartCard title="What decided each claim" subtitle="The verification step that produced the verdict"
            summary={ruleBars.length ? `Most often: ${ruleBars[0].name}, ${ruleBars[0].value} claims.` : "No claims."} forceTable={tables}
            table={{ caption: "Claims by deciding rule", rows: ruleBars, columns: countColumns("Decided by", "Claims") }}>
            <CountBars data={ruleBars} unit="Claims" />
          </ChartCard>
        </div>

        <div className="stagger grid gap-6 lg:grid-cols-2">
          <ChartCard title="Verifications by risk level" subtitle="Overall risk assigned to each finished verification"
            summary={riskRows.map((r) => `${r.name}: ${r.value}`).join(", ")} forceTable={tables}
            table={{ caption: "Verifications by risk level", rows: riskRows, columns: countColumns("Risk", "Verifications") }}>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={riskRows} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke={GRID} />
                <XAxis dataKey="name" tick={axisTick} axisLine={{ stroke: GRID }} tickLine={false} />
                <YAxis allowDecimals={false} tick={axisTick} axisLine={false} tickLine={false} width={32} />
                <Tooltip cursor={CURSOR} content={({ active, payload }) => active && payload?.length
                  ? <TooltipCard title={`${payload[0].payload.name} risk`} rows={[{ label: "Verifications", value: String(payload[0].value), color: riskMeta(payload[0].payload.key).color }]} /> : null} />
                {/* risk has its own single-hue navy scale, so it can never be read as a verdict */}
                <Bar dataKey="value" barSize={36} radius={[4, 4, 0, 0]} {...motion}
                  shape={(p: any) => <rect x={p.x} y={p.y} width={p.width} height={p.height} rx={4} fill={riskMeta(p.key).color} />} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
          <ChartCard title="Score distribution" subtitle="Verifications by the share of their claims that were supported"
            summary={`Average score ${totals.average_score.toFixed(1)}%.`} forceTable={tables}
            table={{ caption: "Verifications by score range", rows: binRows, columns: countColumns("Score", "Verifications") }}>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={binRows} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke={GRID} />
                <XAxis dataKey="name" tick={axisTick} axisLine={{ stroke: GRID }} tickLine={false} />
                <YAxis allowDecimals={false} tick={axisTick} axisLine={false} tickLine={false} width={32} />
                <Tooltip cursor={CURSOR} content={({ active, payload }) => active && payload?.length
                  ? <TooltipCard title={`Score ${payload[0].payload.name}`} rows={[{ label: "Verifications", value: String(payload[0].value), color: MAGNITUDE }]} /> : null} />
                <Bar dataKey="value" fill={MAGNITUDE} barSize={36} radius={[4, 4, 0, 0]} {...motion} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>

        <section aria-labelledby="top-claims" className="space-y-3">
          <Card>
            <CardHeader title={<span id="top-claims">Claims most worth reviewing</span>} description="Contradicted claims first, then unverifiable, highest risk score first" />
            {data.top_claims.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted">Nothing flagged in this period.</p>
            ) : (
              <DataTable bare caption="Highest-risk flagged claims" columns={topColumns} rows={data.top_claims} rowKey={(c) => `${c.session_id}-${c.claim_id}`} />
            )}
          </Card>
        </section>
      </div>
    </div>
  )
}
