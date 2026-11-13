import { useEffect, useMemo, useState } from "react"
import { Link, useParams } from "react-router-dom"
import { Check, ChevronDown, ChevronsDownUp, ChevronsUpDown, Copy, Download, FileText, Printer, Search, ShieldCheck, Gauge, ListChecks } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardBody, CardHeader, DetailRow } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Segmented } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { PageHeading } from "@/components/shared/PageHeading"
import { MetricCard } from "@/components/shared/MetricCard"
import { DataTable, type Column } from "@/components/shared/DataTable"
import { EmptyState, ErrorState, Notice } from "@/components/shared/states"
import { VerdictDonut } from "@/components/charts/VerdictDonut"
import { VerdictBar } from "@/components/charts/chartKit"
import { ClaimCard } from "@/components/verification/ClaimCard"
import { Collapse } from "@/components/ui/collapse"
import { RiskIndicator, StatusBadge } from "@/components/verification/indicators"
import { hasEvidence, retrievalLabel } from "@/components/verification/EvidencePanel"
import { cn } from "@/lib/utils"
import { formatDateTime, humanize, percent, plural } from "@/lib/format"
import { RULES, ruleInfo } from "@/lib/rules"
import { normalizeRisk, normalizeVerdict, VERDICT_ORDER, VERDICTS, type Verdict } from "@/lib/verdict"
import { demoSessions } from "../lib/demoData"
import {
  downloadReport,
  errorMessage,
  getDocument,
  getEngineConfig,
  getVerificationResults,
  type ClaimResponse,
  type DocumentResponse,
  type EngineConfig,
  type VerificationResultResponse,
} from "../lib/api"

type Filter = "ALL" | Verdict

interface ResultView {
  id: string
  title: string
  documentName: string
  claims: ClaimResponse[]
  overallScore: number
  risk: string
  status?: string
  /** Sample run shipped with the app (lib/demoData.ts), not a stored verification. */
  demo: boolean
  llmOutput?: string
  ranAt?: string
}

const RISK_RANK: Record<string, number> = { LOW: 1, MEDIUM: 2, HIGH: 3 }

/** The shipped sample sessions use their own claim shape; this maps it onto the live one so one set of components renders both. */
function fromDemo(id: string): ResultView | null {
  const s = demoSessions.find((d) => d.id === id)
  if (!s) return null
  const claims = s.claims.map((c) => ({ ...c, status: c.nli?.label ?? "UNVERIFIABLE" })) as unknown as ClaimResponse[]
  const supported = claims.filter((c) => normalizeVerdict(c.status) === "SUPPORTED").length
  const risk = claims.reduce((worst, c) => ((RISK_RANK[normalizeRisk(c.risk_level)] ?? 0) > (RISK_RANK[worst] ?? 0) ? normalizeRisk(c.risk_level) : worst), "UNKNOWN")
  return {
    id: s.id, title: s.title, documentName: s.document, claims, demo: true, llmOutput: s.llm_output, ranAt: s.ran_at, risk,
    overallScore: claims.length ? Math.round((supported / claims.length) * 100) : 0,
  }
}

function fromLive(r: VerificationResultResponse, doc: DocumentResponse | null): ResultView {
  return {
    id: r.id, title: "Verification results", documentName: doc?.filename ?? "Source document", claims: r.claims,
    overallScore: r.overall_score, risk: r.risk_level, status: r.status, demo: false,
  }
}

export default function ResultsDashboard() {
  const { id = "" } = useParams()
  const [live, setLive] = useState<VerificationResultResponse | null>(null)
  const [docMeta, setDocMeta] = useState<DocumentResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [reload, setReload] = useState(0)

  const [filter, setFilter] = useState<Filter>("ALL")
  const [query, setQuery] = useState("")
  const [openIds, setOpenIds] = useState<Set<string>>(new Set())
  const [copied, setCopied] = useState(false)
  const [exporting, setExporting] = useState<"pdf" | "csv" | null>(null)
  const [exportError, setExportError] = useState<string | null>(null)
  const [showTech, setShowTech] = useState(false)
  const [engine, setEngine] = useState<EngineConfig | null>(null)

  const demo = useMemo(() => fromDemo(id), [id])

  useEffect(() => {
    if (demo || !id) return
    let cancelled = false
    setLoading(true)
    setLoadError(null)
    getVerificationResults(id)
      .then((res) => {
        if (cancelled) return
        setLive(res)
        if (res.document_id) getDocument(res.document_id).then((d) => !cancelled && setDocMeta(d)).catch(() => {})
      })
      .catch((err) => {
        if (cancelled) return
        const detail = err?.response?.data?.detail || err?.message || `Session "${id}" was not found.`
        setLoadError(typeof detail === "string" ? detail : JSON.stringify(detail))
      })
      .finally(() => !cancelled && setLoading(false))
    return () => { cancelled = true }
  }, [id, demo, reload])

  // engine settings are only fetched when the reader opens Technical details
  useEffect(() => {
    if (showTech && !engine) getEngineConfig().then(setEngine).catch(() => {})
  }, [showTech, engine])

  const view: ResultView | null = demo ?? (live ? fromLive(live, docMeta) : null)

  const stats = useMemo(() => {
    const claims = view?.claims ?? []
    const counts: Record<Verdict, number> = { SUPPORTED: 0, CONTRADICTED: 0, UNVERIFIABLE: 0 }
    claims.forEach((c) => { counts[normalizeVerdict(c.status)]++ })
    const confs = claims.map((c) => c.confidence).filter((x): x is number => typeof x === "number")
    const rules = new Map<string, number>()
    claims.forEach((c) => { if (c.decided_by) rules.set(c.decided_by, (rules.get(c.decided_by) ?? 0) + 1) })
    const methods = [...new Set(claims.map((c) => c.evidence?.retrieval_method).filter((m): m is string => !!m))]
    return { counts, total: claims.length, avgConfidence: confs.length ? confs.reduce((a, b) => a + b, 0) / confs.length : null, rules, methods }
  }, [view])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (view?.claims ?? []).filter((c) => (filter === "ALL" || normalizeVerdict(c.status) === filter) && (!q || c.claim_text.toLowerCase().includes(q)))
  }, [view, filter, query])

  const toggle = (claimId: string) => setOpenIds((s) => { const n = new Set(s); if (n.has(claimId)) n.delete(claimId); else n.add(claimId); return n })
  const allOpen = visible.length > 0 && visible.every((c) => openIds.has(c.id))
  const setAll = (open: boolean) => setOpenIds(open ? new Set(visible.map((c) => c.id)) : new Set())

  const jumpTo = (claimId: string) => {
    setFilter("ALL")
    setQuery("")
    setOpenIds((s) => new Set(s).add(claimId))
    window.setTimeout(() => document.getElementById(`claim-${claimId}`)?.scrollIntoView({ behavior: "smooth", block: "start" }), 60)
  }

  const copyId = () => {
    void navigator.clipboard?.writeText(id).then(() => { setCopied(true); window.setTimeout(() => setCopied(false), 1800) })
  }

  const print = () => {
    // every claim is shown in full on paper
    setOpenIds(new Set((view?.claims ?? []).map((c) => c.id)))
    window.setTimeout(() => window.print(), 250)
  }

  const exportReport = async (format: "pdf" | "csv") => {
    if (!live) return
    setExporting(format)
    setExportError(null)
    try {
      await downloadReport(live.id, format)
    } catch (err) {
      setExportError(errorMessage(err, "The report could not be downloaded."))
    } finally {
      setExporting(null)
    }
  }

  if (loading || (!view && !loadError)) {
    return (
      <div className="space-y-6" role="status" aria-label="Loading verification results">
        <Skeleton className="h-9 w-72" />
        <Skeleton className="h-40 w-full" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28" />)}</div>
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }
  if (loadError || !view) {
    return <ErrorState title="These results could not be loaded" message={loadError ?? "The verification was not found."} onRetry={() => setReload((n) => n + 1)} />
  }

  const { counts, total } = stats
  const headline =
    total === 0 ? { v: "UNVERIFIABLE" as Verdict, text: "No claims were found in this response." }
    : counts.CONTRADICTED > 0 ? { v: "CONTRADICTED" as Verdict, text: `${plural(counts.CONTRADICTED, "claim")} of ${total} contradict the document.` }
    : counts.UNVERIFIABLE > 0 ? { v: "UNVERIFIABLE" as Verdict, text: `No contradictions, but ${plural(counts.UNVERIFIABLE, "claim")} could not be verified.` }
    : { v: "SUPPORTED" as Verdict, text: `All ${total} claims are supported by the document.` }
  const H = VERDICTS[headline.v]

  const evidenceRows = view.claims.map((c, i) => ({ c, i }))
  const evidenceColumns: Column<{ c: ClaimResponse; i: number }>[] = [
    { key: "n", header: "#", cell: ({ i }) => String(i + 1).padStart(2, "0"), numeric: true, sortValue: ({ i }) => i, className: "w-12" },
    { key: "claim", header: "Claim", cell: ({ c }) => <span className="line-clamp-2 min-w-48 max-w-md text-ink">{c.claim_text}</span> },
    { key: "verdict", header: "Verdict", cell: ({ c }) => <StatusBadge status={c.status} size="sm" />, sortValue: ({ c }) => normalizeVerdict(c.status) },
    { key: "page", header: "Page", cell: ({ c }) => (hasEvidence(c.evidence) ? c.evidence.page_number : "None"), numeric: true, sortValue: ({ c }) => (hasEvidence(c.evidence) ? c.evidence.page_number : 0), hideBelow: "sm" },
    { key: "method", header: "Search", cell: ({ c }) => (c.evidence?.retrieval_method ? <span className="whitespace-nowrap">{retrievalLabel(c.evidence.retrieval_method)}</span> : "Not recorded"), hideBelow: "xl" },
    { key: "score", header: "Match score", cell: ({ c }) => (hasEvidence(c.evidence) ? percent(c.evidence.similarity_score, 0) : "None"), numeric: true, align: "right", sortValue: ({ c }) => (hasEvidence(c.evidence) ? c.evidence.similarity_score : -1), hideBelow: "md" },
    { key: "rule", header: "Decided by", cell: ({ c }) => ruleInfo(c.decided_by)?.label ?? "Not recorded", hideBelow: "md" },
  ]

  return (
    <div className="space-y-8">
      <PageHeading
        back={{ to: demo ? "/verify" : "/history", label: demo ? "New verification" : "Verification history" }}
        title={view.title}
        subtitle={view.demo ? "A sample verification shipped with the app, shown so the features can be explored without uploading a document. It is not a stored run." : "Every claim in the response, tested against the source document and explained."}
        actions={
          <>
            <Link to={view.demo ? "/evidence" : `/evidence?session=${view.id}`}><Button size="sm"><Search /> Evidence</Button></Link>
            <Button size="sm" onClick={print}><Printer /> Print</Button>
            {!view.demo && (
              <>
                <Button size="sm" loading={exporting === "pdf"} disabled={exporting !== null} onClick={() => void exportReport("pdf")}><Download /> PDF report</Button>
                <Button size="sm" loading={exporting === "csv"} disabled={exporting !== null} onClick={() => void exportReport("csv")}><Download /> CSV</Button>
              </>
            )}
          </>
        }
        meta={
          <>
            <span className="inline-flex items-center gap-1.5"><FileText className="size-3.5" aria-hidden="true" />{view.documentName}</span>
            <span>{plural(total, "claim")}</span>
            {view.ranAt && <span>{formatDateTime(view.ranAt)}</span>}
            {view.demo && <Badge tone="warning">Sample data</Badge>}
            {!view.demo && (
              <button type="button" onClick={copyId} className="no-print inline-flex items-center gap-1.5 rounded-md hover:text-ink" aria-label="Copy session ID">
                <span className="num">ID {view.id.slice(0, 8)}…</span>
                {copied ? <Check className="size-3.5 text-supported" /> : <Copy className="size-3.5" />}
              </button>
            )}
          </>
        }
      />
      {exportError && <Notice tone="error" title="Download failed">{exportError}</Notice>}

      {/* Overview */}
      <section aria-labelledby="overview" className="space-y-4">
        <h2 id="overview" className="text-lg font-semibold tracking-tight text-ink">Overview</h2>
        <div className={cn("flex flex-wrap items-center gap-4 rounded-lg border p-4", H.tint, H.border)}>
          <span className={cn("grid size-10 shrink-0 place-items-center rounded-lg bg-surface", H.text)}><H.Icon className="size-5" aria-hidden="true" /></span>
          <div className="min-w-0 flex-1">
            <div className={cn("text-[15px] font-semibold", H.text)}>{headline.text}</div>
            <p className="mt-0.5 text-[13px] text-ink/80">
              Summarised from the verdicts below. {counts.SUPPORTED > 0 && <>{plural(counts.SUPPORTED, "claim")} supported. </>}
              Each verdict names the rule that decided it, so nothing here is an unexplained score.
            </p>
          </div>
          <VerdictBar supported={counts.SUPPORTED} contradicted={counts.CONTRADICTED} unverifiable={counts.UNVERIFIABLE} className="w-full sm:w-64" />
        </div>

        <div className="stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard label="Support score" icon={ShieldCheck} value={`${Math.round(view.overallScore)}%`} hint="Claims supported with no hallucination flag" />
          <Card className="p-4">
            <div className="text-[13px] font-medium text-muted">Overall risk</div>
            <div className="mt-2.5"><RiskIndicator level={view.risk} size="lg" /></div>
            <div className="mt-2 text-xs text-muted">The highest risk among the claims</div>
          </Card>
          <MetricCard label="Average confidence" icon={Gauge} value={stats.avgConfidence != null ? percent(stats.avgConfidence, 0) : "Unavailable"} hint="Mean of per-claim confidence (derived)" />
          <MetricCard label="Claims checked" icon={ListChecks} value={total} hint={view.status ? `Run status: ${humanize(view.status)}` : "All evaluated"} />
        </div>

        {view.llmOutput && (
          <Card>
            <CardHeader title="Response under review" description="The AI-written text this sample verification checked." />
            <CardBody><p className="text-[15px] leading-relaxed text-ink">“{view.llmOutput}”</p></CardBody>
          </Card>
        )}
      </section>

      {/* Claim classification */}
      <section aria-labelledby="classification" className="space-y-4">
        <h2 id="classification" className="text-lg font-semibold tracking-tight text-ink">Claim classification</h2>
        <div className="stagger grid gap-4 lg:grid-cols-5">
          <Card className="p-5 lg:col-span-3">
            <h3 className="mb-4 text-[15px] font-semibold text-ink">Claims by verdict</h3>
            <VerdictDonut counts={counts} />
          </Card>
          <Card className="p-5 lg:col-span-2">
            <h3 className="text-[15px] font-semibold text-ink">What the verdicts mean</h3>
            <dl className="mt-3 space-y-3">
              {VERDICT_ORDER.map((k) => {
                const v = VERDICTS[k]
                return (
                  <div key={k} className="flex gap-3">
                    <span className={cn("mt-0.5 grid size-6 shrink-0 place-items-center rounded-md border", v.tint, v.border, v.text)}><v.Icon className="size-3.5" aria-hidden="true" /></span>
                    <div>
                      <dt className="text-[13px] font-medium text-ink">{v.label} <span className="num font-normal text-muted">· {counts[k]}</span></dt>
                      <dd className="text-xs leading-relaxed text-muted">{v.meaning}</dd>
                    </div>
                  </div>
                )
              })}
            </dl>
          </Card>
        </div>
      </section>

      {/* Claim-by-claim */}
      <section aria-labelledby="claims" className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="claims" className="text-lg font-semibold tracking-tight text-ink">Claim-by-claim analysis</h2>
            <p className="text-[13px] text-muted">Open a claim to see why it got its verdict and the evidence it was checked against.</p>
          </div>
          <Button size="sm" className="no-print" onClick={() => setAll(!allOpen)} disabled={visible.length === 0}>
            {allOpen ? <ChevronsDownUp /> : <ChevronsUpDown />} {allOpen ? "Collapse all" : "Expand all"}
          </Button>
        </div>

        <div className="no-print flex flex-wrap items-center gap-3">
          <Segmented<Filter>
            label="Filter by verdict"
            value={filter}
            onChange={setFilter}
            options={[
              { value: "ALL", label: "All", count: total },
              ...VERDICT_ORDER.map((k) => ({ value: k as Filter, label: VERDICTS[k].label, count: counts[k] })),
            ]}
          />
          <div className="relative min-w-52 flex-1 sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
            <Input aria-label="Search claims" placeholder="Search claim text" value={query} onChange={(e) => setQuery(e.target.value)} className="h-9 pl-9" />
          </div>
        </div>

        {visible.length === 0 ? (
          <EmptyState title="No claims match" message="Try a different verdict filter or clear the search." actionLabel="Clear filters" onAction={() => { setFilter("ALL"); setQuery("") }} />
        ) : (
          <div className="stagger space-y-3">
            {visible.map((c) => (
              <ClaimCard
                key={c.id}
                claim={c}
                index={view.claims.indexOf(c)}
                sessionId={view.id}
                documentName={view.documentName}
                open={openIds.has(c.id)}
                onToggle={() => toggle(c.id)}
              />
            ))}
          </div>
        )}
      </section>

      {/* Evidence analysis */}
      <section aria-labelledby="evidence" className="space-y-4">
        <div>
          <h2 id="evidence" className="text-lg font-semibold tracking-tight text-ink">Evidence analysis</h2>
          <p className="text-[13px] text-muted">Where each claim was checked in the document, and how closely the passage matched. Select a row to jump to the claim.</p>
        </div>
        <DataTable
          caption="Evidence found for each claim"
          columns={evidenceColumns}
          rows={evidenceRows}
          rowKey={({ c }) => c.id}
          onRowClick={({ c }) => jumpTo(c.id)}
          empty="No claims to show."
        />
        <p className="text-xs text-muted">
          Match score is the retrieval similarity of the passage, not a probability that the claim is true.
          {stats.methods.length > 0 && <> Search used: {stats.methods.map(retrievalLabel).join(", ")}.</>}
        </p>
      </section>

      {/* Technical details */}
      <section aria-labelledby="technical">
        <button
          type="button"
          onClick={() => setShowTech((s) => !s)}
          aria-expanded={showTech}
          aria-controls="technical-body"
          className="no-print flex w-full items-center justify-between gap-3 rounded-lg border border-line bg-surface px-5 py-4 text-left shadow-xs transition-colors duration-[var(--motion-fast)] hover:bg-canvas"
        >
          <span>
            <span id="technical" className="block text-lg font-semibold tracking-tight text-ink">Technical details</span>
            <span className="block text-[13px] text-muted">Which rules decided the verdicts, and the engine settings. For auditors and engineers.</span>
          </span>
          <ChevronDown className={cn("size-5 shrink-0 text-muted transition-transform duration-[var(--motion-base)] ease-[var(--ease-out-soft)]", showTech && "rotate-180")} aria-hidden="true" />
        </button>

        <Collapse open={showTech} id="technical-body">
          <div className="grid gap-4 pt-4 lg:grid-cols-2">
            <Card>
              <CardHeader title="Decided by" description="Rules run in a fixed priority order; the first that applies decides the verdict." />
              <CardBody className="space-y-3">
                {stats.rules.size === 0 ? (
                  <p className="text-[13px] text-muted">The deciding rule was not recorded for these claims.</p>
                ) : (
                  Object.entries(RULES).sort(([, a], [, b]) => a.priority - b.priority).filter(([k]) => stats.rules.has(k)).map(([k, r]) => (
                    <div key={k} className="flex gap-3">
                      <span className="num grid size-6 shrink-0 place-items-center rounded-full bg-brand-tint text-xs font-semibold text-brand">{r.priority}</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2 text-[13px] font-medium text-ink">{r.label}<span className="num text-muted">{plural(stats.rules.get(k)!, "claim")}</span></div>
                        <p className="text-xs leading-relaxed text-muted">{r.summary}</p>
                      </div>
                    </div>
                  ))
                )}
              </CardBody>
            </Card>
            <Card>
              <CardHeader title="Run and engine" description="The engine settings are the server's current configuration." />
              <CardBody>
                <DetailRow label="Verification ID">{view.demo ? "Sample (not stored)" : <span className="break-all font-mono text-xs">{view.id}</span>}</DetailRow>
                {live?.document_id && <DetailRow label="Document ID"><span className="break-all font-mono text-xs">{live.document_id}</span></DetailRow>}
                <DetailRow label="Evidence search">{stats.methods.length ? stats.methods.map(retrievalLabel).join(", ") : "Not recorded"}</DetailRow>
                {engine ? (
                  <>
                    <DetailRow label="Pipeline version">{engine.pipeline_version}</DetailRow>
                    <DetailRow label="Inference model">{engine.models.nli}</DetailRow>
                    <DetailRow label="Embedding model">{engine.models.embedding}</DetailRow>
                    <DetailRow label="Passages retrieved per claim">{engine.retrieval.top_k}</DetailRow>
                    <DetailRow label="Contradiction threshold">{engine.policy.nli_contradiction_threshold}</DetailRow>
                    <DetailRow label="Support threshold">{engine.policy.nli_support_threshold}</DetailRow>
                  </>
                ) : (
                  <p className="pt-2 text-xs text-muted">Engine settings are unavailable.</p>
                )}
              </CardBody>
            </Card>
          </div>
        </Collapse>
      </section>
    </div>
  )
}
