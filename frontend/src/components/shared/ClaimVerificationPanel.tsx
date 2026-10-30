import { Card, CardContent } from "../ui/card"
import { Badge } from "../ui/badge"
import {
  CheckCircle2, AlertTriangle, HelpCircle, FileText, Layers, Hash,
} from "lucide-react"
import type { ClaimResponse } from "../../lib/api"
import { nliLabelDisplay, nliColor, riskColor } from "../../lib/api"

interface ClaimVerificationPanelProps {
  claim: ClaimResponse
}

export default function ClaimVerificationPanel({ claim }: ClaimVerificationPanelProps) {
  const label = claim.nli?.label ?? claim.status
  const colors = nliColor(label)
  const displayLabel = nliLabelDisplay(label)

  const StatusIcon = label.toUpperCase().includes("SUPPORT") || label.toUpperCase().includes("ENTAIL")
    ? CheckCircle2
    : label.toUpperCase().includes("CONTRADICT")
      ? AlertTriangle
      : HelpCircle

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* LEFT — Claim Analysis */}
      <div className={`glass-card rounded-2xl overflow-hidden border ${colors.border}`}>
        {/* Status header */}
        <div className={`flex items-center justify-between px-5 py-3 border-b ${colors.bg} ${colors.border}`}>
          <div className="flex items-center space-x-2">
            <StatusIcon className={`h-4 w-4 ${colors.text}`} />
            <span className={`text-xs font-bold uppercase tracking-wider ${colors.text}`}>
              {displayLabel}
            </span>
          </div>
          <div className="flex items-center space-x-3">
            {claim.confidence != null && (
              <div className="text-right">
                <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Confidence</div>
                <div className="text-sm font-mono font-bold text-white">
                  {(claim.confidence * 100).toFixed(1)}%
                </div>
              </div>
            )}
            {claim.risk_level && (
              <div className="text-right">
                <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Risk Level</div>
                <Badge className={`bg-black/40 border border-white/10 text-[9px] rounded uppercase px-2 py-0.5 font-bold ${
                  claim.risk_level === "HIGH" ? "text-rose-300 border-rose-400/30" : claim.risk_level === "MEDIUM" ? "text-amber-300 border-amber-400/30" : "text-emerald-300 border-emerald-400/30"
                }`}>
                  {claim.risk_level}
                </Badge>
              </div>
            )}
          </div>
        </div>

        <div className="p-5 space-y-5">
          {/* Claim text */}
          <div>
            <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-2">
              Verified Claim Statement
            </div>
            <div className="text-sm font-semibold text-white bg-black/30 p-3.5 rounded-xl border border-white/8 leading-relaxed">
              "{claim.claim_text}"
            </div>
          </div>

          {/* Claim metadata */}
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="text-slate-300 border-white/10 bg-white/5 text-[10px] font-mono px-2 py-0.5">
              Type: {claim.claim_type}
            </Badge>
            <Badge variant="outline" className="text-slate-300 border-white/10 bg-white/5 text-[10px] font-mono px-2 py-0.5">
              Status: {claim.status}
            </Badge>
          </div>

          {/* Source sentence */}
          {claim.source_sentence && (
            <div>
              <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-2">
                Contextual Source Sentence
              </div>
              <p className="text-xs text-slate-300 bg-white/[0.02] border border-white/5 rounded-lg p-3 leading-relaxed italic">
                "{claim.source_sentence}"
              </p>
            </div>
          )}

          {/* NLI Analysis */}
          {claim.nli ? (
            <div className="space-y-2">
              <div className="flex justify-between items-end">
                <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                  Natural Language Inference (DeBERTa-v3)
                </div>
                <div className={`text-[10px] font-bold uppercase tracking-wider ${colors.text}`}>
                  {claim.nli.label}
                </div>
              </div>
              <div className="h-2.5 w-full bg-black/40 rounded-full overflow-hidden flex border border-white/5">
                <div
                  className="h-full bg-emerald-400 transition-all shadow-[0_0_8px_rgba(52,211,153,0.6)]"
                  style={{ width: `${claim.nli.entailment * 100}%` }}
                />
                <div
                  className="h-full bg-rose-500 transition-all shadow-[0_0_8px_rgba(244,63,94,0.6)]"
                  style={{ width: `${claim.nli.contradiction * 100}%` }}
                />
                <div
                  className="h-full bg-amber-400 transition-all shadow-[0_0_8px_rgba(245,158,11,0.6)]"
                  style={{ width: `${claim.nli.neutral * 100}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] font-mono mt-1">
                <span className="text-emerald-300 font-semibold">
                  Entailment: {(claim.nli.entailment * 100).toFixed(1)}%
                </span>
                <span className="text-rose-300 font-semibold">
                  Contradiction: {(claim.nli.contradiction * 100).toFixed(1)}%
                </span>
                <span className="text-amber-300 font-semibold">
                  Neutral: {(claim.nli.neutral * 100).toFixed(1)}%
                </span>
              </div>
            </div>
          ) : (
            <div className="bg-black/30 border border-white/8 rounded-xl p-4 text-center">
              <HelpCircle className="h-5 w-5 text-slate-400 mx-auto mb-2" />
              <div className="text-xs font-bold text-slate-300">NLI Analysis Not Available</div>
              <p className="text-[10px] text-slate-400 mt-1">
                The NLI model did not produce scores for this claim.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* RIGHT — Evidence Panel */}
      <div className="glass-card rounded-2xl overflow-hidden border border-white/8">
        <div className="px-5 py-3 border-b border-white/8 bg-black/20 flex items-center justify-between">
          <div className="text-xs font-bold text-slate-300 uppercase tracking-widest flex items-center gap-2">
            <FileText className="h-3.5 w-3.5 text-amber-400" />
            Retrieved Evidence & Grounding
          </div>
          {claim.evidence?.retrieval_method && (
            <Badge variant="outline" className="text-indigo-300 border-indigo-400/30 bg-indigo-500/10 text-[9px] font-mono uppercase">
              {claim.evidence.retrieval_method === "hybrid" ? "BM25 Hybrid RAG" : claim.evidence.retrieval_method}
            </Badge>
          )}
        </div>

        <div className="p-5">
          {claim.evidence && claim.evidence.text !== "No evidence." ? (
            <div className="space-y-4">
              {/* Evidence text */}
              <div className="bg-black/30 border border-white/8 rounded-xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center text-[10px] font-bold text-amber-300 uppercase tracking-widest">
                    <CheckCircle2 className="h-3.5 w-3.5 mr-1.5 text-amber-400" />
                    Source Passage (Page {claim.evidence.page_number})
                  </div>
                  <span className="text-[10px] font-mono text-indigo-300 font-bold">
                    Similarity: {(claim.evidence.similarity_score * 100).toFixed(1)}%
                  </span>
                </div>
                <p className="text-sm font-serif italic text-slate-200 leading-relaxed">
                  "{claim.evidence.text}"
                </p>
              </div>

              {/* Hybrid scores grid if present */}
              {(claim.evidence.dense_score != null || claim.evidence.bm25_score != null) && (
                <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                  {claim.evidence.dense_score != null && (
                    <div className="p-2.5 rounded-lg bg-white/[0.02] border border-white/5">
                      <span className="text-slate-400 block text-[9px] uppercase">Dense Semantic</span>
                      <span className="text-white font-semibold">{(claim.evidence.dense_score * 100).toFixed(1)}%</span>
                    </div>
                  )}
                  {claim.evidence.bm25_score != null && (
                    <div className="p-2.5 rounded-lg bg-white/[0.02] border border-white/5">
                      <span className="text-slate-400 block text-[9px] uppercase">BM25 Lexical</span>
                      <span className="text-amber-300 font-semibold">{claim.evidence.bm25_score.toFixed(2)}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Similarity score bar */}
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                    Overall Grounding Confidence
                  </div>
                  <div className="text-xs font-mono font-bold text-indigo-300">
                    {(claim.evidence.similarity_score * 100).toFixed(1)}%
                  </div>
                </div>
                <div className="h-2 w-full bg-black/40 rounded-full overflow-hidden border border-white/5">
                  <div
                    className="h-full bg-gradient-to-r from-amber-400 to-indigo-500 rounded-full transition-all"
                    style={{ width: `${claim.evidence.similarity_score * 100}%` }}
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-400/20 flex items-center justify-center mb-3">
                <HelpCircle className="h-6 w-6 text-amber-400" />
              </div>
              <div className="text-sm font-bold text-slate-200 mb-1">No Evidence Retrieved</div>
              <p className="text-xs text-slate-400 max-w-xs leading-relaxed">
                The retrieval system did not find matching evidence for this claim in the source document.
                This may indicate an ungrounded or speculative claim.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

