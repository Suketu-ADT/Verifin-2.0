import { useEffect, useMemo, useRef, useState } from "react"
import { Link, useSearchParams } from "react-router-dom"
import { ArrowRight, Lightbulb, Scale, Search } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Input, Select } from "@/components/ui/input"
import { Segmented } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { PageHeading } from "@/components/shared/PageHeading"
import { EmptyState, ErrorState } from "@/components/shared/states"
import { ConfidenceIndicator, NliBar, StatusBadge } from "@/components/verification/indicators"
import { EvidencePanel, hasEvidence } from "@/components/verification/EvidencePanel"
import { TechnicalDetails } from "@/components/verification/TechnicalDetails"
import { cn } from "@/lib/utils"
import { formatDateTime, humanize } from "@/lib/format"
import { ruleInfo } from "@/lib/rules"
import { normalizeVerdict, VERDICT_ORDER, VERDICTS, type Verdict } from "@/lib/verdict"
import { getVerificationResults, type ClaimResponse } from "../lib/api"
import { useHistory } from "../lib/useHistory"

type StatusFilter = "ALL" | Verdict

export default function EvidenceExplorer() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { sessions, loading: loadingSessions, error: sessionsError, reload } = useHistory()

  const [claims, setClaims] = useState<ClaimResponse[]>([])
  const [loadingClaims, setLoadingClaims] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [query, setQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL")
  const [selectedId, setSelectedId] = useState("")
  const detail = useRef<HTMLDivElement>(null)

  const finished = useMemo(() => sessions.filter((x) => x.status === "completed"), [sessions])
  const requested = searchParams.get("session")
  // the session in the URL if it is one of ours, else the most recent finished run
  const sessionId = (requested && finished.some((x) => x.id === requested) ? requested : finished[0]?.id) ?? null
  const session = finished.find((x) => x.id === sessionId) ?? null

  useEffect(() => {
    if (!sessionId) return
    let cancelled = false
    setLoadingClaims(true)
    setLoadError(null)
    getVerificationResults(sessionId)
      .then((res) => { if (!cancelled) setClaims(res.claims || []) })
      .catch(() => { if (!cancelled) { setClaims([]); setLoadError("Could not load this verification's claims.") } })
      .finally(() => { if (!cancelled) setLoadingClaims(false) })
    return () => { cancelled = true }
  }, [sessionId])

  const filtered = useMemo(() => {
    const q = query.toLowerCase()
    return claims.filter((c) => (!q || c.claim_text.toLowerCase().includes(q) || (c.evidence?.text ?? "").toLowerCase().includes(q)) && (statusFilter === "ALL" || normalizeVerdict(c.status) === statusFilter))
  }, [claims, query, statusFilter])

  const counts = useMemo(() => {
    const c: Record<Verdict, number> = { SUPPORTED: 0, CONTRADICTED: 0, UNVERIFIABLE: 0 }
    claims.forEach((x) => { c[normalizeVerdict(x.status)]++ })
    return c
  }, [claims])

  useEffect(() => {
    if (filtered.length > 0 && (!selectedId || !filtered.some((c) => c.id === selectedId))) setSelectedId(filtered[0].id)
  }, [filtered, selectedId])

  const selected = filtered.find((c) => c.id === selectedId) ?? filtered[0]
  const rule = selected ? ruleInfo(selected.decided_by) : null
  const v = selected ? VERDICTS[normalizeVerdict(selected.status)] : null

  const choose = (id: string) => {
    setSelectedId(id)
    // on narrow screens the detail sits below the list
    if (window.matchMedia("(max-width: 1023px)").matches) window.setTimeout(() => detail.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50)
  }

  const heading = (
    <PageHeading
      title="Evidence explorer"
      subtitle="Browse the passages found in the source document for each claim, with how they matched and why the claim got its verdict."
      actions={finished.length > 0 && (
        <div className="w-full min-w-64 sm:w-80">
          <Select aria-label="Verification run" value={sessionId ?? ""} onChange={(e) => { setSearchParams({ session: e.target.value }); setSelectedId("") }}>
            {finished.map((x) => <option key={x.id} value={x.id}>{(x.document_name ?? "Document") + " · " + formatDateTime(x.created_at)}</option>)}
          </Select>
        </div>
      )}
    />
  )

  if (sessionsError) return <div>{heading}<ErrorState title="Runs could not be loaded" message={sessionsError} onRetry={() => void reload()} /></div>
  if (loadingSessions) return <div role="status" aria-label="Loading">{heading}<div className="grid gap-4 lg:grid-cols-5"><Skeleton className="h-96 lg:col-span-2" /><Skeleton className="h-96 lg:col-span-3" /></div></div>
  if (!sessionId) {
    return <div>{heading}<EmptyState title="No finished verifications yet" message="Run a verification and its retrieved evidence appears here, claim by claim." actionLabel="Start a verification" onAction={() => (window.location.href = `${(import.meta as any).env?.BASE_URL ?? "/"}verify`)} /></div>
  }
  if (loadError) return <div>{heading}<ErrorState title="Claims could not be loaded" message={loadError} /></div>

  return (
    <div>
      {heading}
      <div className="grid gap-4 lg:grid-cols-5">
        {/* claim list */}
        <Card className="flex max-h-[44rem] flex-col overflow-hidden lg:col-span-2">
          <div className="space-y-3 border-b border-line p-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
              <Input aria-label="Search claims or retrieved text" placeholder="Search claims or retrieved text" value={query} onChange={(e) => setQuery(e.target.value)} className="h-9 pl-9" />
            </div>
            <Segmented<StatusFilter>
              label="Filter by verdict"
              size="sm"
              value={statusFilter}
              onChange={setStatusFilter}
              options={[{ value: "ALL", label: "All", count: claims.length }, ...VERDICT_ORDER.map((k) => { const V = VERDICTS[k]; return { value: k as StatusFilter, label: <span className="inline-flex items-center gap-1" title={V.label}><V.Icon className="size-3.5" aria-hidden="true" /><span className="max-xl:sr-only">{V.label}</span></span>, count: counts[k] } })]}
            />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto" role="listbox" aria-label="Claims">
            {loadingClaims ? (
              <div className="space-y-3 p-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-12" />)}</div>
            ) : filtered.length === 0 ? (
              <p className="px-4 py-12 text-center text-[13px] text-muted">No claims match this view.</p>
            ) : (
              <ul className="divide-y divide-line">
                {filtered.map((c) => {
                  const cv = VERDICTS[normalizeVerdict(c.status)]
                  const active = c.id === selected?.id
                  return (
                    <li key={c.id}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={active}
                        onClick={() => choose(c.id)}
                        className={cn("flex w-full flex-col gap-2 border-l-[3px] px-4 py-3 text-left transition-colors", active ? "bg-brand-tint" : "hover:bg-canvas")}
                        style={{ borderLeftColor: active ? cv.color : "transparent" }}
                      >
                        <span className="line-clamp-2 text-[13px] font-medium leading-snug text-ink">{c.claim_text}</span>
                        <span className="flex flex-wrap items-center gap-2 text-xs text-muted">
                          <StatusBadge status={c.status} size="sm" />
                          {hasEvidence(c.evidence) ? <span className="num">Page {c.evidence.page_number}</span> : <span>No passage</span>}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </Card>

        {/* detail */}
        <div ref={detail} className="scroll-mt-20 space-y-4 lg:col-span-3">
          {selected && v ? (
            <>
              <Card className="space-y-3 p-5" style={{ borderLeft: `3px solid ${v.color}` }}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <StatusBadge status={selected.status} size="lg" />
                  <ConfidenceIndicator value={selected.confidence} label="Confidence" />
                </div>
                <p className="text-[16px] leading-relaxed text-ink">“{selected.claim_text}”</p>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
                  {rule && <span className="inline-flex items-center gap-1"><Scale className="size-3.5" aria-hidden="true" />Decided by <span className="font-medium text-ink">{rule.label}</span></span>}
                  {session && <span>{session.document_name ?? "Document"} · {formatDateTime(session.created_at)}</span>}
                  {selected.hallucination_type && selected.hallucination_type.toUpperCase() !== "NONE" && <span>Flagged: {humanize(selected.hallucination_type)}</span>}
                </div>
              </Card>

              {(selected.reasoning_summary || rule) && (
                <div className={cn("flex items-start gap-3 rounded-lg border p-4", v.tint, v.border)}>
                  <Lightbulb className={cn("mt-0.5 size-4 shrink-0", v.text)} aria-hidden="true" />
                  <div className="text-[13px] leading-relaxed">
                    <div className={cn("font-semibold", v.text)}>Why this verdict</div>
                    <p className="mt-0.5 text-ink">{selected.reasoning_summary || rule?.summary}</p>
                  </div>
                </div>
              )}

              <section aria-labelledby="passage">
                <h2 id="passage" className="mb-2 text-[15px] font-semibold text-ink">Retrieved passage</h2>
                <EvidencePanel evidence={selected.evidence} documentName={session?.document_name ?? undefined} />
              </section>

              {selected.nli && (
                <Card className="p-5">
                  <h2 className="mb-3 text-[15px] font-semibold text-ink">Language-inference scores</h2>
                  <NliBar nli={selected.nli} />
                </Card>
              )}

              <TechnicalDetails claim={selected} />

              {sessionId && (
                <div className="flex justify-end">
                  <Link to={`/verify/results/${sessionId}/claim/${selected.id}`} className="inline-flex items-center gap-1.5 text-[13px] font-medium text-brand-2 hover:underline">
                    Open the full claim audit <ArrowRight className="size-3.5" />
                  </Link>
                </div>
              )}
            </>
          ) : (
            !loadingClaims && <EmptyState title="Select a claim" message="Choose a claim from the list to inspect its retrieved evidence and grounding details." />
          )}
        </div>
      </div>
    </div>
  )
}
