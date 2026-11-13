import { useEffect, useMemo, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { ArrowRight, FileDown, FileSpreadsheet, FileText, Printer } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardBody } from "@/components/ui/card"
import { Field, Select } from "@/components/ui/input"
import { PageHeading } from "@/components/shared/PageHeading"
import { MetricCard } from "@/components/shared/MetricCard"
import { DataTable, type Column } from "@/components/shared/DataTable"
import { EmptyState, ErrorState, Notice } from "@/components/shared/states"
import { ConfidenceIndicator, RiskIndicator, StatusBadge } from "@/components/verification/indicators"
import { formatDateTime, humanize, percent } from "@/lib/format"
import { ruleInfo } from "@/lib/rules"
import { normalizeVerdict, VERDICTS, type Verdict } from "@/lib/verdict"
import { downloadReport, errorMessage, getVerificationResults, type ClaimResponse, type VerificationResultResponse } from "../lib/api"
import { totalClaims, useHistory } from "../lib/useHistory"

export default function Reports() {
  const navigate = useNavigate()
  const { sessions, loading: listLoading, error: listError, reload } = useHistory(100)
  const finished = useMemo(() => sessions.filter((s) => s.status === "completed"), [sessions])

  const [sessionId, setSessionId] = useState<string | null>(null)
  const [result, setResult] = useState<VerificationResultResponse | null>(null)
  const [resultLoading, setResultLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [downloading, setDownloading] = useState<"pdf" | "csv" | null>(null)

  const selectedId = sessionId ?? finished[0]?.id ?? null
  const summary = finished.find((s) => s.id === selectedId)

  useEffect(() => {
    if (!selectedId) return
    let cancelled = false
    setResultLoading(true)
    setError(null)
    getVerificationResults(selectedId)
      .then((r) => { if (!cancelled) setResult(r) })
      .catch((err) => { if (!cancelled) { setResult(null); setError(errorMessage(err, "Could not load this report.")) } })
      .finally(() => { if (!cancelled) setResultLoading(false) })
    return () => { cancelled = true }
  }, [selectedId])

  const download = async (format: "pdf" | "csv") => {
    if (!selectedId) return
    setDownloading(format)
    setError(null)
    try {
      await downloadReport(selectedId, format)
    } catch (err) {
      setError(errorMessage(err, "The download failed."))
    } finally {
      setDownloading(null)
    }
  }

  if (listError) return <ErrorState title="Reports could not be loaded" message={listError} onRetry={() => void reload()} />

  if (!listLoading && finished.length === 0) {
    return (
      <>
        <PageHeading title="Reports" subtitle="Claim-by-claim reports with provenance, as PDF or CSV." />
        <EmptyState
          title="No reports yet"
          message="Reports are generated from finished verifications. Run one and its PDF and CSV report will be available here."
          actionLabel="Start a verification"
          onAction={() => navigate("/verify")}
        />
      </>
    )
  }

  const claims = result?.claims ?? []
  const counts: Record<Verdict, number> = { SUPPORTED: 0, CONTRADICTED: 0, UNVERIFIABLE: 0 }
  claims.forEach((c) => { counts[normalizeVerdict(c.status)]++ })
  const supportRate = claims.length > 0 ? counts.SUPPORTED / claims.length : null

  const columns: Column<ClaimResponse>[] = [
    { key: "n", header: "#", numeric: true, className: "w-12", cell: (_c, i) => String(i + 1).padStart(2, "0") },
    {
      key: "claim", header: "Claim",
      cell: (c) => (
        <div className="max-w-lg">
          <p className="text-ink">{c.claim_text}</p>
          {c.hallucination_type && c.hallucination_type.toUpperCase() !== "NONE" && <p className="mt-0.5 text-xs text-muted">Flagged: {humanize(c.hallucination_type)}</p>}
        </div>
      ),
    },
    { key: "evidence", header: "Evidence", hideBelow: "sm", sortValue: (c) => c.evidence?.page_number ?? 0, cell: (c) => (c.evidence && c.evidence.page_number > 0 ? <span className="num">Page {c.evidence.page_number}</span> : <span className="text-muted">No passage</span>) },
    { key: "rule", header: "Decided by", hideBelow: "lg", cell: (c) => ruleInfo(c.decided_by)?.label ?? <span className="text-muted">Not recorded</span> },
    { key: "conf", header: "Confidence", hideBelow: "md", sortValue: (c) => c.confidence ?? -1, cell: (c) => <ConfidenceIndicator value={c.confidence} /> },
    { key: "verdict", header: "Verdict", align: "right", sortValue: (c) => normalizeVerdict(c.status), cell: (c) => <StatusBadge status={c.status} size="sm" /> },
  ]

  return (
    <div className="space-y-6">
      <PageHeading
        title="Reports"
        subtitle="Claim-by-claim reports with provenance, as PDF or CSV."
        actions={
          <>
            <Button size="sm" disabled={!selectedId || downloading !== null} loading={downloading === "pdf"} onClick={() => void download("pdf")}>{downloading !== "pdf" && <FileDown />} Download PDF</Button>
            <Button size="sm" disabled={!selectedId || downloading !== null} loading={downloading === "csv"} onClick={() => void download("csv")}>{downloading !== "csv" && <FileSpreadsheet />} Download CSV</Button>
            <Button size="sm" onClick={() => window.print()}><Printer /> Print</Button>
          </>
        }
      />

      {error && <Notice tone="error" title="Something went wrong">{error}</Notice>}

      <div className="no-print max-w-xl">
        <Field label="Verification" htmlFor="report-run" hint="Showing your most recent finished runs.">
          <Select id="report-run" value={selectedId ?? ""} onChange={(e) => setSessionId(e.target.value)}>
            {finished.map((s) => <option key={s.id} value={s.id}>{(s.document_name ?? "Deleted document")} · {formatDateTime(s.created_at)}</option>)}
          </Select>
        </Field>
      </div>

      {summary && (
        <Card>
          <CardBody className="grid gap-6 md:grid-cols-3">
            <div className="min-w-0">
              <div className="text-xs text-muted">Source document</div>
              <div className="mt-1 flex items-center gap-2 text-[15px] font-medium text-ink"><FileText className="size-4 shrink-0 text-muted" aria-hidden="true" /><span className="truncate">{summary.document_name ?? "Deleted document"}</span></div>
              <div className="num mt-1 break-all text-xs text-muted">Verification {summary.id}</div>
            </div>
            <div>
              <div className="text-xs text-muted">Overall risk</div>
              <div className="mt-1.5"><RiskIndicator level={summary.risk_level} size="lg" /></div>
              <div className="num mt-1 text-xs text-muted">Support score {summary.overall_score.toFixed(0)} / 100</div>
            </div>
            <div>
              <div className="text-xs text-muted">Supported claims</div>
              <div className="num mt-1 text-2xl font-semibold text-ink">{supportRate === null ? "–" : percent(supportRate, 0)}</div>
              <div className="num text-xs text-muted">{counts.SUPPORTED} of {claims.length || totalClaims(summary)} claims</div>
            </div>
            <div className="space-y-1.5 border-t border-line pt-4 md:col-span-3">
              <div className="text-xs font-medium text-muted">Statement that was checked</div>
              <p className="text-[14px] leading-relaxed text-ink">“{summary.statement_preview}”</p>
            </div>
          </CardBody>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        {(["SUPPORTED", "CONTRADICTED", "UNVERIFIABLE"] as const).map((k) => (
          <MetricCard key={k} label={VERDICTS[k].label} verdict={k} icon={VERDICTS[k].Icon} value={counts[k]} loading={resultLoading} />
        ))}
      </div>

      <section aria-labelledby="ledger" className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 id="ledger" className="text-lg font-semibold tracking-tight text-ink">Claim ledger</h2>
          {selectedId && <Link to={`/verify/results/${selectedId}`} className="no-print inline-flex items-center gap-1 text-[13px] font-medium text-brand-2 hover:underline">Open full results <ArrowRight className="size-3.5" /></Link>}
        </div>
        <DataTable caption="Claims in the selected verification" columns={columns} rows={claims} rowKey={(c) => c.id} loading={resultLoading} empty="This verification has no claims." />
      </section>
    </div>
  )
}
