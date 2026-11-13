import { Fragment } from "react"
import { FileText, Hash, ScanText, SearchX } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { Evidence } from "@/lib/api"
import { percent } from "@/lib/format"

export const hasEvidence = (e?: Evidence | null): e is Evidence => !!e && e.page_number > 0 && !!e.text && e.text !== "No evidence."

export const retrievalLabel = (method?: string) =>
  method === "hybrid" ? "Hybrid (dense + BM25)" : method === "dense" ? "Dense semantic" : method === "bm25" ? "BM25 keyword" : method ?? "Not recorded"

/** The passage with the terms that matched the claim marked, so the reader sees what linked the two. */
function Highlighted({ text, terms }: { text: string; terms?: string[] }) {
  const clean = (terms ?? []).map((t) => t.trim()).filter((t) => t.length > 1)
  if (clean.length === 0) return <>{text}</>
  const escaped = [...new Set(clean)].sort((a, b) => b.length - a.length).map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
  const parts = text.split(new RegExp(`(${escaped.join("|")})`, "gi"))
  const lower = new Set(clean.map((t) => t.toLowerCase()))
  return (
    <>
      {parts.map((p, i) =>
        lower.has(p.toLowerCase()) ? <mark key={i} className="rounded-xs bg-unverifiable-line/70 px-0.5 text-ink">{p}</mark> : <Fragment key={i}>{p}</Fragment>,
      )}
    </>
  )
}

interface EvidencePanelProps {
  evidence?: Evidence | null
  documentName?: string
  /** Show the retrieval scores and matched terms. */
  showScores?: boolean
  className?: string
}

/** The source passage a claim was checked against: where it came from, how well it matched, and the words that tied it to the claim. */
export function EvidencePanel({ evidence, documentName, showScores = true, className }: EvidencePanelProps) {
  if (!hasEvidence(evidence)) {
    return (
      <div className={cn("flex items-start gap-3 rounded-lg border border-dashed border-line-strong bg-canvas p-4", className)}>
        <SearchX className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden="true" />
        <div className="text-[13px] leading-relaxed">
          <div className="font-medium text-ink">No matching passage was found</div>
          <p className="text-muted">Nothing in the source document settles this claim, which is why it is unverifiable rather than false.</p>
        </div>
      </div>
    )
  }
  const scores = [
    { label: "Match score", hint: "Combined retrieval score", value: percent(evidence.similarity_score, 1) },
    evidence.dense_score != null ? { label: "Semantic", hint: "Dense embedding similarity", value: percent(evidence.dense_score, 1) } : null,
    evidence.bm25_score != null ? { label: "Keyword (BM25)", hint: "Lexical relevance, not a percentage", value: evidence.bm25_score.toFixed(2) } : null,
  ].filter((s): s is { label: string; hint: string; value: string } => s !== null)

  return (
    <div className={cn("overflow-hidden rounded-lg border border-line bg-surface", className)}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-line bg-canvas px-4 py-2.5 text-[13px]">
        <span className="inline-flex min-w-0 items-center gap-1.5 font-medium text-ink">
          <FileText className="size-3.5 shrink-0 text-muted" aria-hidden="true" />
          <span className="truncate">{documentName ?? "Source document"}</span>
        </span>
        <Badge tone="outline">Page {evidence.page_number}</Badge>
        <Badge tone="neutral">{retrievalLabel(evidence.retrieval_method)}</Badge>
        {evidence.is_ocr && (
          <Badge tone="warning"><ScanText /> OCR{evidence.ocr_confidence != null ? ` ${Math.round(evidence.ocr_confidence)}%` : ""}</Badge>
        )}
      </div>
      <blockquote className="excerpt border-l-[3px] border-brand-2/40 bg-surface px-4 py-3.5 text-[15px] leading-relaxed text-ink">
        “<Highlighted text={evidence.text} terms={evidence.matched_keywords} />”
      </blockquote>
      {showScores && (
        <div className="border-t border-line px-4 py-3">
          <dl className="flex flex-wrap gap-x-8 gap-y-2">
            {scores.map((s) => (
              <div key={s.label} title={s.hint}>
                <dt className="text-xs text-muted">{s.label}</dt>
                <dd className="num text-sm font-semibold text-ink">{s.value}</dd>
              </div>
            ))}
          </dl>
          {evidence.matched_keywords && evidence.matched_keywords.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-muted">Matched terms</span>
              {evidence.matched_keywords.map((k, i) => (
                <Badge key={`${k}-${i}`} tone="outline" className="font-normal"><Hash className="text-muted" />{k}</Badge>
              ))}
            </div>
          )}
          {evidence.needs_review && <p className="mt-3 text-xs text-unverifiable-fg">This passage was read from a scan with low confidence and is queued for review.</p>}
        </div>
      )}
    </div>
  )
}
