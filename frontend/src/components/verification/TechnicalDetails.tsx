import type { ReactNode } from "react"
import { Calculator, Calendar, Cpu, Layers, Scale, Search, Split } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { ClaimResponse } from "@/lib/api"
import { figureCheckLabel } from "@/lib/figureCheck"
import { humanize, percent } from "@/lib/format"
import { confidenceNote, ruleInfo } from "@/lib/rules"
import { normalizeRisk, riskMeta } from "@/lib/verdict"
import { hasEvidence, retrievalLabel } from "./EvidencePanel"
import { NliBar } from "./indicators"

function Block({ icon: Icon, title, badge, children }: { icon: typeof Cpu; title: string; badge?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-line bg-surface">
      <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5">
        <h4 className="flex items-center gap-2 text-[13px] font-semibold text-ink"><Icon className="size-4 text-muted" aria-hidden="true" />{title}</h4>
        {badge}
      </header>
      <div className="space-y-3 p-4 text-[13px] leading-relaxed text-ink">{children}</div>
    </section>
  )
}

function Facts({ items }: { items: { label: string; value: ReactNode }[] }) {
  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-2.5 sm:grid-cols-3">
      {items.map((i) => (
        <div key={i.label} className="min-w-0">
          <dt className="text-xs text-muted">{i.label}</dt>
          <dd className="num break-words text-[13px] font-medium text-ink">{i.value}</dd>
        </div>
      ))}
    </dl>
  )
}

const Formula = ({ children }: { children: ReactNode }) => (
  <div className="overflow-x-auto rounded-md border border-line bg-canvas px-3 py-2 font-mono text-xs text-ink">{children}</div>
)

/**
 * Everything the engine recorded for one claim, in the order the pipeline ran: decomposition, retrieval, language inference,
 * deterministic checks, and the rule that produced the final verdict. Only fields the backend returned are shown.
 */
export function TechnicalDetails({ claim, className }: { claim: ClaimResponse; className?: string }) {
  const rule = ruleInfo(claim.decided_by)
  const numeric = claim.numerical_finding && claim.numerical_finding.comparison_outcome !== "NO_CALCULATION" ? claim.numerical_finding : null
  const unit = /%|yoy|growth|margin|rate|delta/i.test(numeric?.formula || "") ? "%" : ""
  const temporal = claim.temporal_anchor && claim.temporal_anchor.period_match !== "UNSPECIFIED" ? claim.temporal_anchor : null
  const hop = claim.multi_hop_finding
  const risk = riskMeta(claim.risk_level)
  const ev = hasEvidence(claim.evidence) ? claim.evidence : null

  return (
    <div className={cn("space-y-3", className)}>
      <Block icon={Split} title="1 · Claim decomposition">
        <Facts items={[{ label: "Claim type", value: humanize(claim.claim_type) }, { label: "Claim id", value: <span className="font-mono text-xs">{claim.id.slice(0, 8)}</span> }]} />
        {claim.source_sentence && (
          <div>
            <div className="text-xs text-muted">Sentence in the response this claim was taken from</div>
            <p className="excerpt mt-1 rounded-md bg-canvas px-3 py-2 text-ink">“{claim.source_sentence}”</p>
          </div>
        )}
      </Block>

      <Block icon={Search} title="2 · Evidence retrieval" badge={<Badge tone="neutral">{retrievalLabel(claim.evidence?.retrieval_method)}</Badge>}>
        {ev ? (
          <Facts
            items={[
              { label: "Page", value: ev.page_number },
              { label: "Combined score", value: percent(ev.similarity_score, 1) },
              ...(ev.dense_score != null ? [{ label: "Dense similarity", value: percent(ev.dense_score, 1) }] : []),
              ...(ev.bm25_score != null ? [{ label: "BM25 score", value: ev.bm25_score.toFixed(2) }] : []),
              ...(ev.extraction_method ? [{ label: "Extraction", value: humanize(ev.extraction_method) }] : []),
              ...(ev.is_ocr ? [{ label: "OCR confidence", value: ev.ocr_confidence != null ? `${Math.round(ev.ocr_confidence)}%` : "Not recorded" }] : []),
            ]}
          />
        ) : (
          <p className="text-muted">No passage was retrieved for this claim.</p>
        )}
      </Block>

      <Block icon={Cpu} title="3 · Language inference (NLI)" badge={claim.nli ? <Badge tone="neutral">Model label: {humanize(claim.nli.label)}</Badge> : undefined}>
        {claim.nli ? (
          <>
            <NliBar nli={claim.nli} />
            <p className="text-xs text-muted">The model scores how likely the retrieved passage entails, is unrelated to, or contradicts the claim. These scores are an input to the verdict; the rules below can override them.</p>
          </>
        ) : (
          <p className="text-muted">The inference model produced no scores for this claim.</p>
        )}
      </Block>

      {(numeric || temporal || hop) && (
        <Block icon={Calculator} title="4 · Deterministic checks">
          {numeric && (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 font-medium"><Calculator className="size-3.5 text-muted" aria-hidden="true" />Figure check</span>
                <Badge tone={numeric.comparison_outcome === "VALIDATED" ? "success" : "danger"}>{figureCheckLabel(numeric.comparison_outcome)}</Badge>
              </div>
              {numeric.formula && <Formula>{numeric.formula}</Formula>}
              <Facts
                items={[
                  ...(numeric.computed_result != null ? [{ label: "Computed from the document", value: `${numeric.computed_result}${unit}` }] : []),
                  ...(numeric.reported_result != null ? [{ label: "Reported in the claim", value: `${numeric.reported_result}${unit}` }] : []),
                  ...(numeric.tolerance != null ? [{ label: "Rounding tolerance", value: `±${numeric.tolerance}${unit}` }] : []),
                ]}
              />
              <p className="text-muted">{numeric.explanation}</p>
            </div>
          )}
          {temporal && (
            <div className={cn("space-y-2", numeric && "border-t border-line pt-3")}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 font-medium"><Calendar className="size-3.5 text-muted" aria-hidden="true" />Reporting period</span>
                <Badge tone={temporal.period_match === "ALIGNED" ? "success" : temporal.period_match === "MISALIGNED" ? "danger" : "warning"}>{humanize(temporal.period_match)}</Badge>
              </div>
              <Facts
                items={[
                  { label: "Period in the claim", value: temporal.claim_period || "None" },
                  { label: "Period of the evidence", value: temporal.evidence_period || "None" },
                  ...(temporal.document_period ? [{ label: "Document period", value: temporal.document_period }] : []),
                ]}
              />
              <p className="text-muted">{temporal.explanation}</p>
            </div>
          )}
          {hop && (
            <div className={cn("space-y-2", (numeric || temporal) && "border-t border-line pt-3")}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 font-medium"><Layers className="size-3.5 text-muted" aria-hidden="true" />Multi-step calculation</span>
                <Badge tone={hop.has_conflict ? "danger" : "neutral"}>{hop.has_conflict ? "Conflict" : "Consistent"}</Badge>
              </div>
              {hop.derived_formula && <Formula>{hop.derived_formula}</Formula>}
              <Facts
                items={[
                  ...(hop.provenance_pages ? [{ label: "Pages used", value: hop.provenance_pages.join(", ") }] : []),
                  ...(hop.computed_value != null ? [{ label: hop.target_metric ?? "Derived value", value: Number(hop.computed_value).toLocaleString() }] : []),
                ]}
              />
              {hop.explanation && <p className="text-muted">{hop.explanation}</p>}
            </div>
          )}
        </Block>
      )}

      <Block icon={Scale} title={`${numeric || temporal || hop ? "5" : "4"} · Deciding rule`} badge={rule ? <Badge tone="brand">Rule {rule.priority < 99 ? `${rule.priority} of 7` : ""}</Badge> : undefined}>
        {rule ? (
          <div>
            <div className="font-semibold">{rule.label} <span className="font-mono text-xs font-normal text-muted">({claim.decided_by})</span></div>
            <p className="mt-0.5 text-muted">{rule.summary}</p>
            <p className="mt-2 text-xs text-muted">Rules run in a fixed priority order and the first that applies decides the verdict, so every verdict traces to exactly one reason.</p>
          </div>
        ) : (
          <p className="text-muted">This verification was recorded before deciding rules were stored, so none is available.</p>
        )}
        <div className="grid gap-3 border-t border-line pt-3 sm:grid-cols-2">
          <div>
            <div className="text-xs text-muted">Confidence</div>
            <div className="num text-sm font-semibold">{claim.confidence != null ? percent(claim.confidence, 1) : "Not recorded"}</div>
            <p className="mt-0.5 text-xs text-muted">{confidenceNote(claim.decided_by)}</p>
          </div>
          <div>
            <div className="text-xs text-muted">Risk</div>
            <div className="text-sm font-semibold">
              {risk.label}
              {claim.hallucination_risk_score != null && <span className="num font-normal text-muted"> · score {claim.hallucination_risk_score.toFixed(2)}</span>}
            </div>
            <p className="mt-0.5 text-xs text-muted">
              {normalizeRisk(claim.risk_level) === "UNKNOWN" ? "No risk level was recorded." : `${risk.meaning} The score runs from 0 (no sign of a hallucination) to 1.`}
            </p>
          </div>
        </div>
      </Block>
    </div>
  )
}
