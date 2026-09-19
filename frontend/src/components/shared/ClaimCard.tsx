import { Link } from "react-router-dom"
import { Badge } from "../ui/badge"
import { Card, CardContent } from "../ui/card"
import {
  CheckCircle2, AlertTriangle, HelpCircle, ChevronRight,
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
      <Card className={`border shadow-sm hover:shadow-md transition-shadow overflow-hidden ${colors.border}`}>
        {/* Header strip */}
        <div className={`flex items-center justify-between px-4 py-2 border-b ${colors.bg} ${colors.border}`}>
          <div className="flex items-center space-x-2">
            <StatusIcon className={`h-3.5 w-3.5 ${colors.text}`} />
            <span className={`text-[10px] font-bold uppercase tracking-widest ${colors.text}`}>
              {displayLabel}
            </span>
          </div>
          <div className="flex items-center space-x-3">
            {claim.confidence != null && (
              <span className="text-[10px] font-mono font-bold text-slate-600">
                {(claim.confidence * 100).toFixed(1)}% conf
              </span>
            )}
            {claim.risk_level && (
              <Badge className={`${riskColor(claim.risk_level)} bg-white/80 border border-slate-200 text-[8px] rounded uppercase px-1.5 py-0 font-bold`}>
                {claim.risk_level}
              </Badge>
            )}
          </div>
        </div>

        <CardContent className="p-4 space-y-3">
          {/* Claim index + type */}
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono font-bold text-slate-400">
              CLAIM #{String(index + 1).padStart(2, "0")}
            </span>
            <Badge className="bg-slate-100 text-slate-600 hover:bg-slate-100 border-none rounded text-[9px] font-mono px-1.5 py-0">
              {claim.claim_type}
            </Badge>
          </div>

          {/* Claim text */}
          <p className="text-sm font-medium text-slate-800 leading-relaxed line-clamp-2">
            "{claim.claim_text}"
          </p>

          {/* NLI bar (if available) */}
          {claim.nli && (
            <div className="space-y-1">
              <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden flex">
                <div
                  className="h-full bg-emerald-500 transition-all"
                  style={{ width: `${(claim.nli.entailment * 100)}%` }}
                />
                <div
                  className="h-full bg-rose-500 transition-all"
                  style={{ width: `${(claim.nli.contradiction * 100)}%` }}
                />
                <div
                  className="h-full bg-amber-400 transition-all"
                  style={{ width: `${(claim.nli.neutral * 100)}%` }}
                />
              </div>
              <div className="flex justify-between text-[9px] font-mono text-slate-400">
                <span>E: {(claim.nli.entailment * 100).toFixed(0)}%</span>
                <span>C: {(claim.nli.contradiction * 100).toFixed(0)}%</span>
                <span>N: {(claim.nli.neutral * 100).toFixed(0)}%</span>
              </div>
            </div>
          )}

          {/* Evidence snippet */}
          {claim.evidence && claim.evidence.text !== "No evidence." ? (
            <div className="bg-slate-50 border border-slate-100 rounded p-2.5">
              <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                Evidence (p. {claim.evidence.page_number})
              </div>
              <p className="text-[11px] text-slate-600 font-serif italic line-clamp-2 leading-relaxed">
                "{claim.evidence.text}"
              </p>
            </div>
          ) : (
            <div className="bg-amber-50/50 border border-amber-100 rounded p-2.5 text-[10px] text-amber-700 flex items-center">
              <HelpCircle className="h-3 w-3 mr-1.5 shrink-0" />
              No matching evidence found in source document
            </div>
          )}

          {/* View details link */}
          <div className="flex items-center text-[10px] font-bold text-amber-600 group-hover:text-amber-800 transition-colors">
            View full analysis <ChevronRight className="h-3 w-3 ml-0.5" />
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
