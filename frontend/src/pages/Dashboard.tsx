import { useEffect, useMemo, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { ArrowRight, ArrowUpRight, FileText, Plus, Search, ShieldCheck } from "lucide-react"
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardBody, CardHeader } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Segmented } from "@/components/ui/tabs"
import { PageHeading } from "@/components/shared/PageHeading"
import { MetricCard } from "@/components/shared/MetricCard"
import { DataTable, type Column } from "@/components/shared/DataTable"
import { EmptyState, ErrorState } from "@/components/shared/states"
import { VerdictDonut } from "@/components/charts/VerdictDonut"
import { ChartCard, CURSOR, GRID, GAP, TooltipCard, VerdictPatterns, axisTick, shortDate, useChartMotion, verdictFill, verdictLegend, Legend } from "@/components/charts/chartKit"
import { ConfidenceIndicator, RiskIndicator, StatusBadge } from "@/components/verification/indicators"
import { formatDateTime, percent, plural, timeAgo } from "@/lib/format"
import { normalizeRisk, normalizeVerdict, VERDICTS, VERDICT_ORDER, type Verdict } from "@/lib/verdict"
import { getVerificationResults, type ClaimResponse } from "../lib/api"
import { countOf, isClean, totalClaims, useHistory } from "../lib/useHistory"

type ClaimFilter = "ALL" | Verdict

const RISKS = ["LOW", "MEDIUM", "HIGH"] as const

export default function Dashboard() {
  const navigate = useNavigate()
  const motion = useChartMotion()
  const { sessions, loading, error, reload } = useHistory(100)
  const [claimFilter, setClaimFilter] = useState<ClaimFilter>("ALL")
  const [query, setQuery] = useState("")
  const [ledger, setLedger] = useState<{ sessionId: string; claims: ClaimResponse[] } | null>(null)
  const [ledgerLoading, setLedgerLoading] = useState(false)

  const finished = useMemo(() => sessions.filter((s) => s.status === "completed"), [sessions])
  const latest = finished[0]

  const counts = useMemo(() => {
    const c: Record<Verdict, number> = {
      SUPPORTED: finished.reduce((a, s) => a + countOf(s, "SUPPORTED"), 0),
      CONTRADICTED: finished.reduce((a, s) => a + countOf(s, "CONTRADICTED"), 0),
      UNVERIFIABLE: finished.reduce((a, s) => a + countOf(s, "UNVERIFIED"), 0),
    }
    return { ...c, total: c.SUPPORTED + c.CONTRADICTED + c.UNVERIFIABLE }
  }, [finished])

  const risk = useMemo(() => {
    const r: Record<(typeof RISKS)[number], number> = { LOW: 0, MEDIUM: 0, HIGH: 0 }
    finished.forEach((s) => { const k = normalizeRisk(s.risk_level); if (k in r) r[k as keyof typeof r]++ })
    return r
  }, [finished])

  // oldest first, so the chart reads left to right in time
  const trend = useMemo(
    () => [...finished].slice(0, 12).reverse().map((s) => ({
      id: s.id,
      label: shortDate(s.created_at),
      doc: s.document_name ?? "Deleted document",
      Supported: countOf(s, "SUPPORTED"),
      Contradicted: countOf(s, "CONTRADICTED"),
      Unverifiable: countOf(s, "UNVERIFIED"),
    })),
    [finished],
  )

  // the ledger shows the claims of the most recent finished run
  const latestId = latest?.id
  useEffect(() => {
    if (!latestId) { setLedger(null); return }
    let cancelled = false
    setLedgerLoading(true)
    getVerificationResults(latestId)
      .then((r) => !cancelled && setLedger({ sessionId: latestId, claims: r.claims }))
      .catch(() => !cancelled && setLedger(null))
      .finally(() => !cancelled && setLedgerLoading(false))
    return () => { cancelled = true }
  }, [latestId])

  const claims = ledger?.claims ?? []
  const ledgerCounts = useMemo(() => {
    const c: Record<Verdict, number> = { SUPPORTED: 0, CONTRADICTED: 0, UNVERIFIABLE: 0 }
    claims.forEach((x) => { c[normalizeVerdict(x.status)]++ })
    return c
  }, [claims])
  const filteredClaims = claims.filter((c) => {
    const q = query.trim().toLowerCase()
    return (claimFilter === "ALL" || normalizeVerdict(c.status) === claimFilter) && (!q || c.claim_text.toLowerCase().includes(q) || c.claim_type.toLowerCase().includes(q))
  })

  const columns: Column<ClaimResponse>[] = [
    { key: "claim", header: "Claim", cell: (c) => <span className="line-clamp-2 max-w-lg text-ink">{c.claim_text}</span> },
    { key: "verdict", header: "Verdict", sortValue: (c) => normalizeVerdict(c.status), cell: (c) => <StatusBadge status={c.status} size="sm" /> },
    { key: "conf", header: "Confidence", hideBelow: "md", sortValue: (c) => c.confidence ?? -1, cell: (c) => <ConfidenceIndicator value={c.confidence} /> },
    { key: "risk", header: "Risk", hideBelow: "lg", cell: (c) => <RiskIndicator level={c.risk_level} size="sm" /> },
    { key: "page", header: "Evidence", hideBelow: "sm", numeric: true, cell: (c) => (c.evidence && c.evidence.page_number > 0 ? `Page ${c.evidence.page_number}` : <span className="text-muted">None</span>) },
    {
      key: "audit", header: <span className="sr-only">Audit</span>, align: "right",
      cell: (c) => <Link to={`/verify/results/${ledger?.sessionId}/claim/${c.id}`} onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-1 text-[13px] font-medium text-brand-2 hover:underline">Audit <ArrowRight className="size-3.5" /></Link>,
    },
  ]

  const empty = !error && !loading && finished.length === 0

  return (
    <div className="space-y-6">
      <PageHeading
        title="Dashboard"
        subtitle={`An overview of verification activity across your organisation's ${plural(finished.length, "most recent finished run")}.`}
        actions={
          <>
            <Link to="/review"><Button size="sm"><ShieldCheck /> Review queue</Button></Link>
            <Link to="/verify"><Button size="sm" variant="primary"><Plus /> New verification</Button></Link>
          </>
        }
      />

      {error ? (
        <ErrorState title="The dashboard could not be loaded" message={error} onRetry={() => void reload()} />
      ) : empty ? (
        <EmptyState
          title="No finished verifications yet"
          message="Upload a financial report and check an AI answer against it. Totals, charts and the claim ledger fill in as runs complete."
          actionLabel="Start a verification"
          onAction={() => navigate("/verify")}
        />
      ) : (
        <>
          <div className="stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard label="Claims audited" icon={FileText} loading={loading} value={counts.total} hint={`Across ${plural(finished.length, "finished run")}`} to="/history" />
            <MetricCard label="Supported" verdict="SUPPORTED" icon={VERDICTS.SUPPORTED.Icon} loading={loading} value={counts.SUPPORTED} hint={counts.total ? `${percent(counts.SUPPORTED / counts.total, 0)} of claims` : "–"} />
            <MetricCard label="Contradicted" verdict="CONTRADICTED" icon={VERDICTS.CONTRADICTED.Icon} loading={loading} value={counts.CONTRADICTED} hint={counts.total ? `${percent(counts.CONTRADICTED / counts.total, 0)} of claims` : "–"} />
            <MetricCard label="Unverifiable" verdict="UNVERIFIABLE" icon={VERDICTS.UNVERIFIABLE.Icon} loading={loading} value={counts.UNVERIFIABLE} hint={counts.total ? `${percent(counts.UNVERIFIABLE / counts.total, 0)} lack evidence` : "–"} />
          </div>

          <div className="stagger grid gap-4 lg:grid-cols-5">
            <Card className="p-5 lg:col-span-2">
              <h2 className="mb-4 text-[15px] font-semibold tracking-tight text-ink">Claims by verdict</h2>
              <VerdictDonut counts={counts} className="sm:flex-col lg:flex-col xl:flex-row" />
            </Card>

            <ChartCard
              className="lg:col-span-3"
              title="Verdicts per run"
              subtitle={`The ${plural(trend.length, "latest run")}, oldest first`}
              summary={`${trend.length} runs; claims split by verdict in each.`}
              legend={<Legend items={verdictLegend} />}
              table={{
                caption: "Claims by verdict for each recent run",
                rows: trend,
                columns: [
                  { header: "Run", cell: (r) => `${r.label} · ${r.doc}` },
                  { header: "Supported", cell: (r) => r.Supported, align: "right" },
                  { header: "Contradicted", cell: (r) => r.Contradicted, align: "right" },
                  { header: "Unverifiable", cell: (r) => r.Unverifiable, align: "right" },
                ],
              }}
            >
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={trend} margin={{ top: 8, right: 8, left: -12, bottom: 0 }} barCategoryGap="22%">
                    <VerdictPatterns />
                    <CartesianGrid stroke={GRID} vertical={false} />
                    <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: GRID }} tick={axisTick} interval="preserveStartEnd" />
                    <YAxis tickLine={false} axisLine={false} tick={axisTick} allowDecimals={false} />
                    <Tooltip cursor={CURSOR} content={({ active, payload }) => {
                      if (!active || !payload?.length) return null
                      const r = payload[0].payload as (typeof trend)[number]
                      return <TooltipCard title={`${r.label} · ${r.doc}`} rows={VERDICT_ORDER.map((k) => ({ label: VERDICTS[k].label, value: String(r[VERDICTS[k].label as "Supported"]), color: VERDICTS[k].color }))} />
                    }} />
                    <Bar dataKey="Supported" stackId="v" fill={verdictFill("SUPPORTED")} {...GAP} {...motion} />
                    <Bar dataKey="Contradicted" stackId="v" fill={verdictFill("CONTRADICTED")} {...GAP} {...motion} />
                    <Bar dataKey="Unverifiable" stackId="v" fill={verdictFill("UNVERIFIABLE")} radius={[4, 4, 0, 0]} {...GAP} {...motion} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>
          </div>

          <div className="stagger grid gap-4 lg:grid-cols-5">
            <Card className="lg:col-span-2">
              <CardHeader title="Risk distribution" description="Finished runs by their overall risk level" />
              <CardBody className="space-y-4">
                {RISKS.map((k) => {
                  const n = risk[k]
                  const pct = finished.length ? (n / finished.length) * 100 : 0
                  return (
                    <div key={k}>
                      <div className="mb-1.5 flex items-center justify-between">
                        <RiskIndicator level={k} />
                        <span className="num text-[13px] text-ink"><span className="font-semibold">{n}</span> <span className="text-muted">{n === 1 ? "run" : "runs"}</span></span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-line"><div className="h-full rounded-full bg-brand-2 transition-[width] duration-[var(--motion-slow)] ease-[var(--ease-out-soft)]" style={{ width: `${pct}%` }} /></div>
                    </div>
                  )
                })}
                <p className="text-xs text-muted">Risk describes how likely a run contains hallucinated claims. It is separate from the verdict counts above.</p>
              </CardBody>
            </Card>

            <Card className="lg:col-span-3">
              <CardHeader
                title="Recent activity"
                description="Your latest runs"
                action={<Link to="/history" className="inline-flex items-center gap-1 text-[13px] font-medium text-brand-2 hover:underline">All history <ArrowUpRight className="size-3.5" /></Link>}
              />
              <ul className="divide-y divide-line">
                {finished.slice(0, 5).map((s) => {
                  const con = countOf(s, "CONTRADICTED")
                  return (
                    <li key={s.id}>
                      <Link to={`/verify/results/${s.id}`} className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-canvas">
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[13px] font-medium text-ink">{s.statement_preview || "No preview"}</div>
                          <div className="mt-0.5 flex items-center gap-2 text-xs text-muted">
                            <span className="truncate">{s.document_name ?? "Deleted document"}</span>
                            <span aria-hidden="true">·</span>
                            <span title={formatDateTime(s.created_at)} className="whitespace-nowrap">{timeAgo(s.created_at)}</span>
                          </div>
                        </div>
                        <span className="num hidden text-xs text-muted sm:block">{plural(totalClaims(s), "claim")}</span>
                        {isClean(s) ? <Badge tone="success">Clean</Badge> : <Badge tone="danger">{con > 0 ? `${con} contradicted` : "High risk"}</Badge>}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </Card>
          </div>

          <section aria-labelledby="ledger" className="space-y-3">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 id="ledger" className="text-lg font-semibold tracking-tight text-ink">Claims in the latest run</h2>
                <p className="text-[13px] text-muted">{latest ? `${latest.document_name ?? "Deleted document"} · ${formatDateTime(latest.created_at)}` : ""}</p>
              </div>
              <div className="flex min-w-0 max-w-full flex-wrap items-center gap-3">
                <Segmented<ClaimFilter>
                  label="Filter claims by verdict"
                  size="sm"
                  value={claimFilter}
                  onChange={setClaimFilter}
                  options={[{ value: "ALL", label: "All", count: claims.length }, ...VERDICT_ORDER.map((k) => ({ value: k as ClaimFilter, label: VERDICTS[k].label, count: ledgerCounts[k] }))]}
                />
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted" aria-hidden="true" />
                  <Input aria-label="Filter claims" placeholder="Filter claim text" value={query} onChange={(e) => setQuery(e.target.value)} className="h-8 w-48 pl-8 text-[13px]" />
                </div>
              </div>
            </div>
            <DataTable
              caption="Claims in the latest verification run"
              columns={columns}
              rows={filteredClaims}
              rowKey={(c) => c.id}
              loading={ledgerLoading}
              onRowClick={(c) => navigate(`/verify/results/${ledger?.sessionId}/claim/${c.id}`)}
              empty="No claims match this filter."
            />
          </section>
        </>
      )}
    </div>
  )
}
