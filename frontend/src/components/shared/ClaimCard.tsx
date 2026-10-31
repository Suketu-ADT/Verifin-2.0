import { Link } from "react-router-dom"
import { figureCheckLabel } from "../../lib/figureCheck"
import { Badge } from "../ui/badge"
import { Card, CardContent } from "../ui/card"
import {
  CheckCircle2, AlertTriangle, HelpCircle, ChevronRight,
  Calculator, Calendar, Layers, ShieldAlert, Sparkles, Hash
} from "lucide-react"
import type { ClaimResponse } from "../../lib/api"
import { nliLabelDisplay, nliColor, riskColor } from "../../lib/api"

interface ClaimCardProps {
  claim: ClaimResponse
  verificationId: string
  index: number
}

export default function ClaimCard({ claim, verificationId, index }: ClaimCardProps) {
  const label = claim.nli?.label ?? claim.status
  const colors = nliColor(label)
  const displayLabel = nliLabelDisplay(label)

  const StatusIcon = label.toUpperCase().includes("SUPPORT") || label.toUpperCase().includes("ENTAIL")
    ? CheckCircle2
    : label.toUpperCase().includes("CONTRADICT")
      ? AlertTriangle
      : HelpCircle

  return (
    <Link to={`/verify/results/${verificationId}/claim/${claim.id}`} className="block group">
      <div className={`glass-card rounded-2xl overflow-hidden border transition-all duration-200 hover:translate-y-[-2px] ${colors.border}`}>
        {/* Header strip */}
        <div className={`flex items-center justify-between px-4 py-2.5 border-b ${colors.bg} ${colors.border}`}>
          <div className="flex items-center space-x-2">
            <StatusIcon className={`h-4 w-4 ${colors.text}`} />
            <span className={`text-[11px] font-bold uppercase tracking-wider ${colors.text}`}>
              {displayLabel}
            </span>
          </div>
          <div className="flex items-center space-x-2.5">
            {claim.confidence != null && (
              <span className="text-[10px] font-mono font-bold text-slate-300">
                {(claim.confidence * 100).toFixed(1)}% conf
              </span>
            )}
            {claim.risk_level && (
              <Badge className={`bg-black/40 border border-white/10 text-[9px] rounded uppercase px-2 py-0.5 font-bold ${
                claim.risk_level === "HIGH" ? "text-rose-300 border-rose-400/30" : claim.risk_level === "MEDIUM" ? "text-amber-300 border-amber-400/30" : "text-emerald-300 border-emerald-400/30"
              }`}>
                {claim.risk_level}
              </Badge>
            )}
          </div>
        </div>

        <div className="p-4 space-y-3">
          {/* Claim index + type + badges */}
          <div className="flex items-center justify-between flex-wrap gap-1.5">
            <span className="text-[10px] font-mono font-bold text-slate-400">
              CLAIM #{String(index + 1).padStart(2, "0")}
            </span>
            <div className="flex items-center gap-1.5 flex-wrap">
              <Badge variant="outline" className="text-[9px] font-mono px-2 py-0.5 text-slate-300 border-white/10 bg-white/5">
                {claim.claim_type}
              </Badge>
              {claim.hallucination_type && claim.hallucination_type !== "NONE" && (
                <span className="inline-flex items-center gap-1 text-[9px] font-mono px-1.5 py-0.5 rounded border border-rose-400/30 text-rose-300 bg-rose-500/10">
                  <ShieldAlert className="h-2.5 w-2.5" />
                  {claim.hallucination_type.replace(/_/g, " ")}
                </span>
              )}
            </div>
          </div>

          {/* Claim text */}
          <p className="text-sm font-semibold text-white leading-relaxed line-clamp-2 group-hover:text-amber-200 transition-colors">
            "{claim.claim_text}"
          </p>

          {/* Diagnostic Pills */}
          <div className="flex items-center gap-1.5 flex-wrap text-[10px] font-mono">
            {claim.numerical_finding && claim.numerical_finding.comparison_outcome !== "NO_CALCULATION" && (
              <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border ${
                claim.numerical_finding.comparison_outcome === "VALIDATED" ? "text-emerald-300 border-emerald-400/30 bg-emerald-500/10" : "text-rose-300 border-rose-400/30 bg-rose-500/10"
              }`}>
                <Calculator className="h-2.5 w-2.5" />
                Figure check: {figureCheckLabel(claim.numerical_finding.comparison_outcome)}
              </span>
            )}
            {claim.temporal_anchor && claim.temporal_anchor.period_match !== "UNSPECIFIED" && (
              <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border ${
                claim.temporal_anchor.period_match === "ALIGNED" ? "text-emerald-300 border-emerald-400/30 bg-emerald-500/10" : "text-rose-300 border-rose-400/30 bg-rose-500/10"
              }`}>
                <Calendar className="h-2.5 w-2.5" />
                {claim.temporal_anchor.period_match}
              </span>
            )}
            {claim.evidence?.retrieval_method && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-indigo-400/30 text-indigo-300 bg-indigo-500/10">
                {claim.evidence.retrieval_method === "hybrid" ? "Hybrid RAG" : claim.evidence.retrieval_method}
              </span>
            )}
          </div>

          {/* NLI bar (if available) */}
          {claim.nli && (
            <div className="space-y-1 pt-1">
              <div className="h-2 w-full bg-black/40 rounded-full overflow-hidden flex border border-white/5">
                <div
                  className="h-full bg-emerald-400 transition-all shadow-[0_0_8px_rgba(52,211,153,0.6)]"
                  style={{ width: `${(claim.nli.entailment * 100)}%` }}
                  title={`Entailment ${(claim.nli.entailment * 100).toFixed(1)}%`}
                />
                <div
                  className="h-full bg-rose-500 transition-all shadow-[0_0_8px_rgba(244,63,94,0.6)]"
                  style={{ width: `${(claim.nli.contradiction * 100)}%` }}
                  title={`Contradiction ${(claim.nli.contradiction * 100).toFixed(1)}%`}
                />
                <div
                  className="h-full bg-amber-400 transition-all shadow-[0_0_8px_rgba(245,158,11,0.6)]"
                  style={{ width: `${(claim.nli.neutral * 100)}%` }}
                  title={`Neutral ${(claim.nli.neutral * 100).toFixed(1)}%`}
                />
              </div>
              <div className="flex justify-between text-[10px] font-mono text-slate-400">
                <span className="text-emerald-300">E: {(claim.nli.entailment * 100).toFixed(0)}%</span>
                <span className="text-rose-300">C: {(claim.nli.contradiction * 100).toFixed(0)}%</span>
                <span className="text-amber-300">N: {(claim.nli.neutral * 100).toFixed(0)}%</span>
              </div>
            </div>
          )}

          {/* Evidence snippet */}
          {claim.evidence && claim.evidence.text !== "No evidence." ? (
            <div className="bg-black/30 border border-white/8 rounded-xl p-3 space-y-1">
              <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                <span>Evidence (Page {claim.evidence.page_number})</span>
                {claim.evidence.similarity_score != null && (
                  <span className="font-mono text-indigo-300">{(claim.evidence.similarity_score * 100).toFixed(0)}% match</span>
                )}
              </div>
              <p className="text-xs text-slate-300 font-serif italic line-clamp-2 leading-relaxed">
                "{claim.evidence.text}"
              </p>
            </div>
          ) : (
            <div className="bg-amber-500/5 border border-amber-400/20 rounded-xl p-3 text-xs text-amber-300 flex items-center">
              <HelpCircle className="h-3.5 w-3.5 mr-2 shrink-0" />
              No matching evidence found in source document
            </div>
          )}

          {/* View details link */}
          <div className="flex items-center justify-end text-xs font-semibold text-amber-400 group-hover:text-amber-300 transition-colors pt-1">
            <span>Inspect Full Provenance Graph</span>
            <ChevronRight className="h-3.5 w-3.5 ml-1 group-hover:translate-x-1 transition-transform" />
          </div>
        </div>
      </div>
    </Link>
  )
}

