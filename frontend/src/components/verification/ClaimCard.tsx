import { useState } from "react"
import { Link } from "react-router-dom"
import { ArrowRight, Calculator, Calendar, ChevronDown, FileText, Layers, Lightbulb, Scale } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { ClaimResponse } from "@/lib/api"
import { figureCheckLabel } from "@/lib/figureCheck"
import { humanize, percent } from "@/lib/format"
import { ruleInfo } from "@/lib/rules"
import { normalizeVerdict, verdictMeta, VERDICTS } from "@/lib/verdict"
import { EvidencePanel, hasEvidence } from "./EvidencePanel"
import { ConfidenceIndicator, RiskIndicator, StatusBadge } from "./indicators"
import { Collapse } from "@/components/ui/collapse"
import { TechnicalDetails } from "./TechnicalDetails"

/** What the language model said the evidence does to the claim, in words, with its strongest score. */
function relation(nli: NonNullable<ClaimResponse["nli"]>) {
  const entries = [
    { v: "SUPPORTED" as const, score: nli.entailment, text: "The evidence entails the claim", short: "the evidence entails the claim" },
    { v: "CONTRADICTED" as const, score: nli.contradiction, text: "The evidence contradicts the claim", short: "the evidence contradicts the claim" },
    { v: "UNVERIFIABLE" as const, score: nli.neutral, text: "The evidence neither confirms nor contradicts the claim", short: "neither confirms nor contradicts" },
  ]
  return entries.reduce((a, b) => (b.score > a.score ? b : a))
}

interface ClaimCardProps {
  claim: ClaimResponse
  index: number
  sessionId: string
  documentName?: string
  open: boolean
  onToggle: () => void
}

/**
 * One claim, scannable when closed (text, verdict, confidence, risk, evidence page, deciding rule) and fully explained when open:
 * why the verdict was reached, the claim and its evidence side by side in reading order, and the technical record on demand.
 */
export function ClaimCard({ claim, index, sessionId, documentName, open, onToggle }: ClaimCardProps) {
  const [technical, setTechnical] = useState(false)
  const verdict = normalizeVerdict(claim.status)
  const v = VERDICTS[verdict]
  const rule = ruleInfo(claim.decided_by)
  const ev = hasEvidence(claim.evidence) ? claim.evidence : null
  const numeric = claim.numerical_finding && claim.numerical_finding.comparison_outcome !== "NO_CALCULATION" ? claim.numerical_finding : null
  const temporal = claim.temporal_anchor && claim.temporal_anchor.period_match !== "UNSPECIFIED" ? claim.temporal_anchor : null
  const rel = claim.nli ? relation(claim.nli) : null
  // the language model reads the passage on its own; a consistency rule (figures, periods, names) can overrule it
  const overridden = !!rel && rel.v !== verdict
  const panelId = `claim-panel-${claim.id}`
  const flagged = claim.hallucination_type && claim.hallucination_type.toUpperCase() !== "NONE"

  return (
    <article id={`claim-${claim.id}`} className={cn("scroll-mt-24 overflow-hidden rounded-lg border border-line border-l-[3px] bg-surface shadow-xs transition-shadow duration-200 hover:shadow-sm")}
      style={{ borderLeftColor: v.color }}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors hover:bg-canvas/70 sm:gap-4 sm:px-5"
      >
        <span className="num mt-0.5 w-6 shrink-0 text-xs font-medium text-muted">{String(index + 1).padStart(2, "0")}</span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
            <span className={cn("min-w-0 flex-1 basis-64 text-[15px] font-medium leading-snug text-ink", !open && "line-clamp-2")}>{claim.claim_text}</span>
            <StatusBadge status={claim.status} />
          </span>
          <span className="mt-2.5 flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px]">
            <ConfidenceIndicator value={claim.confidence} label="Confidence" />
            <RiskIndicator level={claim.risk_level} size="sm" />
            {ev ? (
              <span className="inline-flex items-center gap-1 text-muted"><FileText className="size-3.5" aria-hidden="true" />Page {ev.page_number}</span>
            ) : (
              <span className="text-muted">No evidence found</span>
            )}
            {rule && (
              <span className="inline-flex items-center gap-1 text-muted" title={rule.summary}>
                <Scale className="size-3.5" aria-hidden="true" />Decided by <span className="font-medium text-ink">{rule.label}</span>
              </span>
            )}
          </span>
        </span>
        <ChevronDown className={cn("mt-1 size-4 shrink-0 text-muted transition-transform duration-[var(--motion-base)] ease-[var(--ease-out-soft)]", open && "rotate-180")} aria-hidden="true" />
      </button>

      <div id={panelId} className={cn("collapse-rows grid", open ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
        <div className="min-h-0 overflow-hidden" inert={!open}>
          <div className="space-y-4 border-t border-line bg-canvas/60 px-4 py-4 sm:px-5">
            {/* why */}
            <div className={cn("flex items-start gap-3 rounded-lg border p-3.5", v.tint, v.border)}>
              <Lightbulb className={cn("mt-0.5 size-4 shrink-0", v.text)} aria-hidden="true" />
              <div className="min-w-0 text-[13px] leading-relaxed">
                <div className={cn("font-semibold", v.text)}>Why {verdictMeta(claim.status).label.toLowerCase()}</div>
                <p className="mt-0.5 text-ink">{claim.reasoning_summary || rule?.summary || v.meaning}</p>
                {flagged && <Badge tone="outline" className="mt-2">{humanize(claim.hallucination_type!)}</Badge>}
              </div>
            </div>

            {/* claim -> evidence, in reading order */}
            <div>
              <div className="rounded-lg border border-line bg-surface px-4 py-3">
                <div className="text-xs font-medium text-muted">Claim from the response</div>
                <p className="mt-1 text-[15px] leading-relaxed text-ink">{claim.claim_text}</p>
              </div>
              <div className="flex items-center gap-3 py-1.5 pl-6" aria-hidden={!rel}>
                <div className="h-6 w-px bg-line-strong" />
                {rel ? (
                  overridden ? (
                    <span className="inline-flex flex-wrap items-center gap-x-1.5 gap-y-0.5 rounded-lg border border-neutral-line bg-neutral-tint px-2.5 py-1 text-xs font-medium text-neutral-fg">
                      <Scale className="size-3.5" aria-hidden="true" />
                      Language model alone: {rel.short} <span className="num font-normal">({percent(rel.score, 0)})</span>
                      <span className="font-normal">· overruled by {rule?.label ?? "a consistency rule"}</span>
                    </span>
                  ) : (
                    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium", VERDICTS[rel.v].chip)}>
                      {(() => { const I = VERDICTS[rel.v].Icon; return <I className="size-3.5" aria-hidden="true" /> })()}
                      {rel.text} <span className="num font-normal">({percent(rel.score, 0)})</span>
                    </span>
                  )
                ) : (
                  <span className="text-xs text-muted">Compared with the document</span>
                )}
              </div>
              <EvidencePanel evidence={claim.evidence} documentName={documentName} />
            </div>

            {(numeric || temporal || claim.multi_hop_finding) && (
              <div className="flex flex-wrap gap-2">
                {numeric && <Badge tone={numeric.comparison_outcome === "VALIDATED" ? "success" : "danger"}><Calculator />Figure check {figureCheckLabel(numeric.comparison_outcome)}</Badge>}
                {temporal && <Badge tone={temporal.period_match === "ALIGNED" ? "success" : temporal.period_match === "MISALIGNED" ? "danger" : "warning"}><Calendar />Period {humanize(temporal.period_match).toLowerCase()}</Badge>}
                {claim.multi_hop_finding && <Badge tone={claim.multi_hop_finding.has_conflict ? "danger" : "neutral"}><Layers />Multi-step {claim.multi_hop_finding.has_conflict ? "conflict" : "consistent"}</Badge>}
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3">
              <button type="button" onClick={() => setTechnical((t) => !t)} aria-expanded={technical} className="inline-flex items-center gap-1.5 rounded-md text-[13px] font-medium text-brand-2 hover:underline">
                <ChevronDown className={cn("size-3.5 transition-transform duration-[var(--motion-base)] ease-[var(--ease-out-soft)]", technical && "rotate-180")} aria-hidden="true" />
                {technical ? "Hide technical details" : "Show technical details"}
              </button>
              <Link to={`/verify/results/${sessionId}/claim/${claim.id}`} className="inline-flex items-center gap-1.5 rounded-md text-[13px] font-medium text-brand-2 hover:underline">
                Open full claim audit <ArrowRight className="size-3.5" aria-hidden="true" />
              </Link>
            </div>
            <Collapse open={technical}><div className="pt-1"><TechnicalDetails claim={claim} /></div></Collapse>
          </div>
        </div>
      </div>
    </article>
  )
}
