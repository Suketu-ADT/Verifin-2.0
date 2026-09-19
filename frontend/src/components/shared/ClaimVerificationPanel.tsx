import { Card, CardContent } from "../ui/card"
import { Badge } from "../ui/badge"
import {
  CheckCircle2, AlertTriangle, HelpCircle,
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
      <Card className={`border shadow-sm ${colors.border}`}>
        {/* Status header */}
        <div className={`flex items-center justify-between px-5 py-3 border-b ${colors.bg} ${colors.border}`}>
          <div className="flex items-center space-x-2">
            <StatusIcon className={`h-4 w-4 ${colors.text}`} />
            <span className={`text-xs font-bold uppercase tracking-widest ${colors.text}`}>
              {displayLabel}
            </span>
          </div>
          <div className="flex items-center space-x-3">
            {claim.confidence != null && (
              <div className="text-right">
                <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Confidence</div>
                <div className="text-sm font-mono font-bold text-slate-800">
                  {(claim.confidence * 100).toFixed(1)}%
                </div>
              </div>
            )}
            {claim.risk_level && (
              <div className="text-right">
                <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Risk</div>
                <Badge className={`${riskColor(claim.risk_level)} bg-white border border-slate-200 text-[9px] rounded uppercase px-1.5 py-0 font-bold`}>
                  {claim.risk_level}
                </Badge>
              </div>
            )}
          </div>
        </div>

        <CardContent className="p-5 space-y-5">
          {/* Claim text */}
          <div>
            <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-2">
              Claim Text
            </div>
            <div className="text-sm font-serif text-slate-800 bg-slate-50 p-3 rounded border border-slate-100 leading-relaxed">
              "{claim.claim_text}"
            </div>
          </div>

          {/* Claim metadata */}
          <div className="flex flex-wrap gap-2">
            <Badge className="bg-slate-100 text-slate-600 hover:bg-slate-100 border-none rounded text-[9px] font-mono px-2 py-0.5">
              Type: {claim.claim_type}
            </Badge>
            <Badge className="bg-slate-100 text-slate-600 hover:bg-slate-100 border-none rounded text-[9px] font-mono px-2 py-0.5">
              Status: {claim.status}
            </Badge>
          </div>

          {/* Source sentence */}
          {claim.source_sentence && (
            <div>
              <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-2">
                Source Sentence
              </div>
              <p className="text-xs text-slate-600 leading-relaxed italic">
                "{claim.source_sentence}"
              </p>
            </div>
          )}

          {/* NLI Analysis */}
          {claim.nli ? (
            <div>
              <div className="flex justify-between items-end mb-2">
                <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                  Natural Language Inference
                </div>
                <div className={`text-[10px] font-bold uppercase tracking-widest ${colors.text}`}>
                  {claim.nli.label}
                </div>
              </div>
              <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden flex">
                <div
                  className="h-full bg-emerald-500 transition-all"
                  style={{ width: `${claim.nli.entailment * 100}%` }}
                />
                <div
                  className="h-full bg-rose-500 transition-all"
                  style={{ width: `${claim.nli.contradiction * 100}%` }}
                />
                <div
                  className="h-full bg-amber-400 transition-all"
                  style={{ width: `${claim.nli.neutral * 100}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] font-mono text-slate-500 mt-2">
                <span className="text-emerald-600 font-bold">
                  Entailment: {(claim.nli.entailment * 100).toFixed(1)}%
                </span>
                <span className="text-rose-600">
                  Contradiction: {(claim.nli.contradiction * 100).toFixed(1)}%
                </span>
                <span className="text-amber-600">
                  Neutral: {(claim.nli.neutral * 100).toFixed(1)}%
                </span>
              </div>
            </div>
          ) : (
            <div className="bg-slate-50 border border-slate-200 rounded p-4 text-center">
              <HelpCircle className="h-5 w-5 text-slate-400 mx-auto mb-2" />
              <div className="text-xs font-bold text-slate-500">NLI Analysis Not Available</div>
              <p className="text-[10px] text-slate-400 mt-1">
                The NLI model did not produce scores for this claim.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* RIGHT — Evidence Panel */}
      <Card className="border-slate-200 shadow-sm">
        <div className="px-5 py-3 border-b border-slate-100 bg-slate-50">
          <div className="text-xs font-bold text-slate-700 uppercase tracking-widest">
            Retrieved Evidence
          </div>
        </div>

        <CardContent className="p-5">
          {claim.evidence && claim.evidence.text !== "No evidence." ? (
            <div className="space-y-4">
              {/* Evidence text */}
              <div className="bg-amber-50/50 border border-amber-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center text-[9px] font-bold text-amber-700 uppercase tracking-widest">
                    <CheckCircle2 className="h-3 w-3 mr-1.5" />
                    Source Document Evidence
                  </div>
                  <span className="text-[10px] font-mono text-amber-600">
                    Similarity: {(claim.evidence.similarity_score * 100).toFixed(1)}%
                  </span>
                </div>
                <p className="text-sm font-serif italic text-slate-700 leading-relaxed">
                  "{claim.evidence.text}"
                </p>
              </div>

              {/* Page reference */}
              <div className="flex items-center justify-between bg-slate-50 border border-slate-100 rounded p-3">
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                  Page Number
                </div>
                <div className="text-sm font-mono font-bold text-slate-800">
                  Page {claim.evidence.page_number}
                </div>
              </div>

              {/* Similarity score bar */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                    Semantic Similarity
                  </div>
                  <div className="text-xs font-mono font-bold text-slate-700">
                    {(claim.evidence.similarity_score * 100).toFixed(1)}%
                  </div>
                </div>
                <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-amber-500 rounded-full transition-all"
                    style={{ width: `${claim.evidence.similarity_score * 100}%` }}
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center mb-4">
                <HelpCircle className="h-6 w-6 text-amber-400" />
              </div>
              <div className="text-sm font-bold text-slate-600 mb-1">No Evidence Retrieved</div>
              <p className="text-xs text-slate-400 max-w-xs leading-relaxed">
                The retrieval system did not find matching evidence for this claim in the source document.
                This may indicate an ungrounded or speculative claim.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
