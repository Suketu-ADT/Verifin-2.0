import { useMemo, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { AlertTriangle, ArrowRight, CheckCircle2, FileText, ListChecks, RefreshCw, Search } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input, Select } from "@/components/ui/input"
import { Segmented } from "@/components/ui/tabs"
import { PageHeading } from "@/components/shared/PageHeading"
import { MetricCard } from "@/components/shared/MetricCard"
import { DataTable, type Column } from "@/components/shared/DataTable"
import { EmptyState, ErrorState } from "@/components/shared/states"
import { VerdictBar } from "@/components/charts/chartKit"
import { RiskIndicator } from "@/components/verification/indicators"
import { formatDateTime, plural } from "@/lib/format"
import { VERDICTS } from "@/lib/verdict"
import type { VerificationSummary } from "../lib/api"
import { countOf, isClean, totalClaims, useHistory } from "../lib/useHistory"

type Outcome = "all" | "flagged" | "clean"
type Range = "all" | "7" | "30" | "90"

const DAY = 86_400_000

export default function History() {
  const navigate = useNavigate()
  const { sessions, loading, error, reload } = useHistory(100)
  const [outcome, setOutcome] = useState<Outcome>("all")
  const [range, setRange] = useState<Range>("all")
  const [search, setSearch] = useState("")

  const finished = sessions.filter((s) => s.status === "completed")
  const cleanCount = finished.filter(isClean).length
  const flaggedCount = finished.length - cleanCount
  const claims = finished.reduce((acc, s) => acc + totalClaims(s), 0)
  const cleanRate = finished.length > 0 ? Math.round((cleanCount / finished.length) * 100) : null

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    const cutoff = range === "all" ? 0 : Date.now() - Number(range) * DAY
    return sessions.filter((s) => {
      if (q && !(s.document_name ?? "").toLowerCase().includes(q) && !s.statement_preview.toLowerCase().includes(q)) return false
      if (cutoff && new Date(s.created_at).getTime() < cutoff) return false
      if (outcome === "flagged") return s.status === "completed" && !isClean(s)
      if (outcome === "clean") return isClean(s)
      return true
    })
  }, [sessions, outcome, range, search])

  const columns: Column<VerificationSummary>[] = [
    {
      key: "statement",
      header: "Statement checked",
      sortValue: (s) => s.statement_preview,
      cell: (s) => (
        <div className="min-w-0 max-w-xs">
          <div className="line-clamp-2 text-ink">{s.statement_preview || "No preview"}</div>
          <div className="num mt-0.5 text-xs text-muted">ID {s.id.slice(0, 8)}</div>
        </div>
      ),
    },
    {
      key: "document",
      header: "Document",
      hideBelow: "xl",
      sortValue: (s) => s.document_name ?? "",
      cell: (s) => (
        <span className="inline-flex max-w-48 items-center gap-1.5 text-ink">
          <FileText className="size-3.5 shrink-0 text-muted" aria-hidden="true" />
          <span className="truncate">{s.document_name ?? "Deleted document"}</span>
        </span>
      ),
    },
    {
      key: "claims",
      header: "Claims",
      hideBelow: "md",
      sortValue: totalClaims,
      cell: (s) => {
        const sup = countOf(s, "SUPPORTED")
        const con = countOf(s, "CONTRADICTED")
        const unv = countOf(s, "UNVERIFIED")
        const total = sup + con + unv
        if (s.status !== "completed" || total === 0) return <span className="text-muted">{s.status === "completed" ? "Not recorded" : s.status}</span>
        return (
          <div className="w-40">
            <div className="num flex items-center gap-2 text-xs text-muted">
              <span className="font-semibold text-ink">{total}</span>
              <span className="inline-flex items-center gap-0.5" title="Supported"><VERDICTS.SUPPORTED.Icon className="size-3" aria-hidden="true" />{sup}</span>
              <span className="inline-flex items-center gap-0.5" title="Contradicted"><VERDICTS.CONTRADICTED.Icon className="size-3" aria-hidden="true" />{con}</span>
              <span className="inline-flex items-center gap-0.5" title="Unverifiable"><VERDICTS.UNVERIFIABLE.Icon className="size-3" aria-hidden="true" />{unv}</span>
            </div>
            <VerdictBar supported={sup} contradicted={con} unverifiable={unv} height="h-1.5" className="mt-1.5" />
          </div>
        )
      },
    },
    {
      key: "outcome",
      header: "Outcome",
      sortValue: (s) => (isClean(s) ? 0 : s.status === "completed" ? 1 : 2),
      cell: (s) =>
        s.status !== "completed" ? (
          <Badge tone={s.status === "failed" ? "danger" : "neutral"} className="capitalize">{s.status}</Badge>
        ) : isClean(s) ? (
          <Badge tone="success"><CheckCircle2 /> Clean</Badge>
        ) : (
          <Badge tone="danger"><AlertTriangle /> Flagged</Badge>
        ),
    },
    {
      key: "risk",
      header: "Risk",
      hideBelow: "sm",
      sortValue: (s) => ({ LOW: 1, MEDIUM: 2, HIGH: 3 })[s.risk_level.toUpperCase() as "LOW"] ?? 0,
      cell: (s) => (s.status === "completed" ? <RiskIndicator level={s.risk_level} size="sm" /> : <span className="text-muted">–</span>),
    },
    {
      key: "date",
      header: "Run at",
      hideBelow: "xl",
      sortValue: (s) => new Date(s.created_at).getTime(),
      cell: (s) => <span className="num whitespace-nowrap text-muted">{formatDateTime(s.created_at)}</span>,
    },
    {
      key: "open",
      header: <span className="sr-only">Open</span>,
      align: "right",
      cell: (s) =>
        s.status === "completed" ? (
          <Link to={`/verify/results/${s.id}`} onClick={(e) => e.stopPropagation()}>
            <Button size="sm">Open <ArrowRight /></Button>
          </Link>
        ) : (
          <span className="text-xs text-muted">Unavailable</span>
        ),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeading
        title="Verification history"
        subtitle="Your organisation's most recent verifications (up to 100), newest first."
        actions={<Button size="sm" onClick={() => void reload()} loading={loading}>{!loading && <RefreshCw />} Refresh</Button>}
      />

      {error ? (
        <ErrorState title="History could not be loaded" message={error} onRetry={() => void reload()} />
      ) : !loading && sessions.length === 0 ? (
        <EmptyState
          title="No verifications yet"
          message="Upload a financial report and check an AI answer against it. Every run will be listed here."
          actionLabel="Start a verification"
          onAction={() => navigate("/verify")}
        />
      ) : (
        <>
          <div className="stagger grid gap-4 sm:grid-cols-3">
            <MetricCard label="Verification runs" icon={ListChecks} value={sessions.length} loading={loading} hint={`${plural(claims, "claim")} evaluated in finished runs`} />
            <MetricCard label="Clean runs" icon={CheckCircle2} value={cleanRate === null ? "–" : `${cleanRate}%`} loading={loading} hint={`${cleanCount} with no contradiction and not high risk`} />
            <MetricCard label="Flagged runs" icon={AlertTriangle} value={flaggedCount} loading={loading} hint="Contradicted claims or high risk found" />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Segmented<Outcome>
              label="Filter by outcome"
              value={outcome}
              onChange={setOutcome}
              options={[
                { value: "all", label: "All", count: sessions.length },
                { value: "flagged", label: "Flagged", count: flaggedCount },
                { value: "clean", label: "Clean", count: cleanCount },
              ]}
            />
            <div className="w-40">
              <Select aria-label="Filter by date" value={range} onChange={(e) => setRange(e.target.value as Range)} className="h-9">
                <option value="all">Any time</option>
                <option value="7">Last 7 days</option>
                <option value="30">Last 30 days</option>
                <option value="90">Last 90 days</option>
              </Select>
            </div>
            <div className="relative min-w-56 flex-1 sm:max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
              <Input aria-label="Search verifications" placeholder="Search documents or statements" value={search} onChange={(e) => setSearch(e.target.value)} className="h-9 pl-9" />
            </div>
          </div>

          <DataTable
            caption="Verification history"
            columns={columns}
            rows={rows}
            rowKey={(s) => s.id}
            loading={loading}
            defaultSort={{ key: "date", dir: "desc" }}
            onRowClick={(s) => s.status === "completed" && navigate(`/verify/results/${s.id}`)}
            empty="No verification matches these filters."
          />
          <p className="text-xs text-muted">{rows.length === sessions.length ? `Showing all ${sessions.length}` : `Showing ${rows.length} of ${sessions.length}`}. Runs recorded before claim counts were stored show “Not recorded”.</p>
        </>
      )}
    </div>
  )
}
