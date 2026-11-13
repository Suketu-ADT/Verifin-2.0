import { useEffect, useMemo, useState } from "react"
import { Link, useParams } from "react-router-dom"
import { ArrowLeft, ArrowRight, Eye, EyeOff, Lightbulb, Scale } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardBody, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { PageHeading } from "@/components/shared/PageHeading"
import { ErrorState } from "@/components/shared/states"
import { ConfidenceIndicator, RiskIndicator, StatusBadge } from "@/components/verification/indicators"
import { EvidencePanel, hasEvidence } from "@/components/verification/EvidencePanel"
import { TechnicalDetails } from "@/components/verification/TechnicalDetails"
import { cn } from "@/lib/utils"
import { humanize } from "@/lib/format"
import { ruleInfo } from "@/lib/rules"
import { normalizeVerdict, VERDICTS } from "@/lib/verdict"
import { demoSessions } from "../lib/demoData"
import {
  getDocument,
  getDocumentFileUrl,
  getVerificationResults,
  type ClaimResponse,
  type DocumentResponse,
  type VerificationResultResponse,
} from "../lib/api"
import { PdfEvidenceViewer } from "../components/PdfEvidenceViewer"

export default function ClaimDetail() {
  const { id = "", claimId = "" } = useParams()

  // The shipped sample sessions are checked first; anything else is a stored verification.
  const demoSession = demoSessions.find((s) => s.id === id)
  const demoClaims = useMemo(
    () => demoSession?.claims.map((c) => ({ ...c, status: c.nli?.label ?? "UNVERIFIABLE" })) as unknown as ClaimResponse[] | undefined,
    [demoSession],
  )

  const [live, setLive] = useState<VerificationResultResponse | null>(null)
  const [docMeta, setDocMeta] = useState<DocumentResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [showPdf, setShowPdf] = useState(false)
  const [reload, setReload] = useState(0)

  useEffect(() => {
    if (demoSession || !id) return
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
        const detail = err?.response?.data?.detail || err?.message || "Failed to load claim details."
        setLoadError(typeof detail === "string" ? detail : JSON.stringify(detail))
      })
      .finally(() => !cancelled && setLoading(false))
    return () => { cancelled = true }
  }, [id, demoSession, reload])

  // a different claim starts with the source viewer closed
  useEffect(() => setShowPdf(false), [claimId])

  const claims = demoClaims ?? live?.claims ?? []
  const index = claims.findIndex((c) => c.id === claimId)
  const claim = index >= 0 ? claims[index] : null
  const docTitle = demoSession?.document || docMeta?.filename || "Source document"

  if (loading || (!claim && !loadError && !demoSession && !live)) {
    return (
      <div className="space-y-6" role="status" aria-label="Loading claim">
        <Skeleton className="h-9 w-80" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-56 w-full" />
      </div>
    )
  }
  if (!claim) {
    return (
      <ErrorState
        title="Claim not found"
        message={loadError ?? `The claim "${claimId}" does not exist in this verification.`}
        onRetry={loadError ? () => setReload((n) => n + 1) : undefined}
      />
    )
  }

  const verdict = normalizeVerdict(claim.status)
  const v = VERDICTS[verdict]
  const rule = ruleInfo(claim.decided_by)
  const flagged = claim.hallucination_type && claim.hallucination_type.toUpperCase() !== "NONE"
  const pageNumber = claim.evidence?.page_number || 1
  const documentId = live?.document_id
  const pdfUrl = documentId ? getDocumentFileUrl(documentId) : null
  const prev = index > 0 ? claims[index - 1] : null
  const next = index < claims.length - 1 ? claims[index + 1] : null

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeading
        back={{ to: `/verify/results/${id}`, label: "Back to results" }}
        title={<span className="text-xl leading-snug sm:text-2xl">“{claim.claim_text}”</span>}
        meta={
          <>
            <StatusBadge status={claim.status} size="lg" />
            <span>Claim {index + 1} of {claims.length}</span>
            <span>Type: {humanize(claim.claim_type)}</span>
            {demoSession && <Badge tone="warning">Sample data</Badge>}
          </>
        }
        actions={
          <>
            <Link to={prev ? `/verify/results/${id}/claim/${prev.id}` : "#"} aria-disabled={!prev} tabIndex={prev ? 0 : -1} onClick={(e) => !prev && e.preventDefault()}>
              <Button size="sm" disabled={!prev}><ArrowLeft /> Previous</Button>
            </Link>
            <Link to={next ? `/verify/results/${id}/claim/${next.id}` : "#"} aria-disabled={!next} tabIndex={next ? 0 : -1} onClick={(e) => !next && e.preventDefault()}>
              <Button size="sm" disabled={!next}>Next <ArrowRight /></Button>
            </Link>
          </>
        }
      />

      <Card className="overflow-hidden" style={{ borderLeft: `3px solid ${v.color}` }}>
        <div className="grid gap-px bg-line sm:grid-cols-3">
          <div className="bg-surface p-4">
            <div className="text-xs text-muted">Confidence</div>
            <div className="mt-1.5"><ConfidenceIndicator value={claim.confidence} width="w-24" /></div>
            <div className="mt-1 text-[11px] text-muted">How strongly the evidence aligns with this verdict</div>
          </div>
          <div className="bg-surface p-4">
            <div className="text-xs text-muted">Risk</div>
            <div className="mt-1.5"><RiskIndicator level={claim.risk_level} score={claim.hallucination_risk_score} /></div>
            <div className="mt-1 text-[11px] text-muted">Risk that the claim is a hallucination</div>
          </div>
          <div className="bg-surface p-4">
            <div className="text-xs text-muted">Decided by</div>
            <div className="mt-1.5 flex items-center gap-1.5 text-[13px] font-medium text-ink"><Scale className="size-3.5 text-muted" aria-hidden="true" />{rule?.label ?? "Not recorded"}</div>
            <div className="mt-1 text-[11px] text-muted">{rule ? `Rule ${rule.priority} of 7 in the policy order` : "No deciding rule is stored for this claim"}</div>
          </div>
        </div>
      </Card>

      <div className={cn("flex items-start gap-3 rounded-lg border p-4", v.tint, v.border)}>
        <Lightbulb className={cn("mt-0.5 size-4 shrink-0", v.text)} aria-hidden="true" />
        <div className="min-w-0 text-[14px] leading-relaxed">
          <div className={cn("font-semibold", v.text)}>Why this verdict</div>
          <p className="mt-0.5 text-ink">{claim.reasoning_summary || rule?.summary || v.meaning}</p>
          {rule && claim.reasoning_summary && <p className="mt-1.5 text-[13px] text-muted">{rule.summary}</p>}
          {flagged && <Badge tone="outline" className="mt-2">{humanize(claim.hallucination_type!)}</Badge>}
        </div>
      </div>

      <section aria-labelledby="ev-heading" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="ev-heading" className="text-lg font-semibold tracking-tight text-ink">Evidence</h2>
          {pdfUrl && hasEvidence(claim.evidence) && (
            <Button size="sm" onClick={() => setShowPdf((s) => !s)} aria-expanded={showPdf}>
              {showPdf ? <EyeOff /> : <Eye />} {showPdf ? "Hide source PDF" : `View page ${pageNumber} in the PDF`}
            </Button>
          )}
        </div>
        <EvidencePanel evidence={claim.evidence} documentName={docTitle} />
        {showPdf && (
          <div className="animate-fade-in">
            <PdfEvidenceViewer
              documentId={documentId || id}
              initialPage={pageNumber}
              boundingBox={claim.evidence?.bounding_box}
              evidenceText={claim.evidence?.text}
              documentTitle={docTitle}
              ocrWords={claim.evidence?.words}
              isOcr={claim.evidence?.is_ocr}
              ocrConfidence={claim.evidence?.ocr_confidence}
            />
          </div>
        )}
      </section>

      <section aria-labelledby="tech-heading" className="space-y-3">
        <h2 id="tech-heading" className="text-lg font-semibold tracking-tight text-ink">Technical details</h2>
        <TechnicalDetails claim={claim} />
      </section>

      {claim.source_sentence && claim.source_sentence !== claim.claim_text && (
        <Card>
          <CardHeader title="Original sentence" description="The sentence in the response this claim was taken from." />
          <CardBody><p className="text-[14px] leading-relaxed text-ink">“{claim.source_sentence}”</p></CardBody>
        </Card>
      )}
    </div>
  )
}
