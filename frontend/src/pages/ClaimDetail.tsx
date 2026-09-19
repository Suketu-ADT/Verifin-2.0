import { motion } from "framer-motion"
import { useParams, Link } from "react-router-dom"
import { Button } from "../components/ui/button"
import { Badge } from "../components/ui/badge"
import { ArrowLeft, CheckCircle2, AlertTriangle, HelpCircle, FileText } from "lucide-react"
import { demoSessions } from "../lib/demoData"

export default function ClaimDetail() {
  const { id, claimId } = useParams()
  const session = demoSessions.find((s) => s.id === id)
  const claim = session?.claims.find((c) => c.id === claimId)

  if (!session || !claim) {
    return (
      <div className="max-w-2xl mx-auto text-center py-20">
        <h1 className="text-xl font-bold text-white mb-2">Claim not found</h1>
        <Link to={id ? `/verify/results/${id}` : "/verify"}>
          <Button variant="outline" size="sm">Back</Button>
        </Link>
      </div>
    )
  }

  const label = claim.nli?.label
  const meta =
    label === "SUPPORTED"
      ? { icon: CheckCircle2, color: "text-emerald-300", border: "border-emerald-400/30", bg: "bg-emerald-500/10", text: "Supported" }
      : label === "CONTRADICTED"
      ? { icon: AlertTriangle, color: "text-rose-300", border: "border-rose-400/30", bg: "bg-rose-500/10", text: "Contradicted" }
      : { icon: HelpCircle, color: "text-amber-300", border: "border-amber-400/30", bg: "bg-amber-500/10", text: "Unverifiable" }

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: "easeOut" }} className="max-w-3xl mx-auto space-y-6">
      <Link to={`/verify/results/${session.id}`} className="inline-flex items-center text-xs font-semibold text-slate-400 hover:text-white">
        <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Back to {session.title}
      </Link>

      <div>
        <div className="flex items-center gap-2 mb-3">
          <meta.icon className={`h-5 w-5 ${meta.color}`} />
          <span className={`text-sm font-bold uppercase tracking-wide ${meta.color}`}>{meta.text}</span>
        </div>
        <h1 className="text-xl font-semibold text-white leading-snug">"{claim.claim_text}"</h1>
        <div className="text-xs text-slate-400 mt-2 font-mono">{claim.claim_type}</div>
      </div>

      {claim.nli && (
        <div className={`glass-subtle border rounded-lg p-5 ${meta.border} ${meta.bg}`}>
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">Natural Language Inference</div>
          <div className="h-2.5 w-full bg-white/10 rounded-full overflow-hidden flex mb-2">
            <motion.div initial={{ width: 0 }} animate={{ width: `${claim.nli.entailment * 100}%` }} transition={{ duration: 0.6, ease: "easeOut", delay: 0.1 }} className="h-full bg-emerald-500" />
            <motion.div initial={{ width: 0 }} animate={{ width: `${claim.nli.neutral * 100}%` }} transition={{ duration: 0.6, ease: "easeOut", delay: 0.15 }} className="h-full bg-slate-300" />
            <motion.div initial={{ width: 0 }} animate={{ width: `${claim.nli.contradiction * 100}%` }} transition={{ duration: 0.6, ease: "easeOut", delay: 0.2 }} className="h-full bg-rose-500" />
          </div>
          <div className="flex justify-between text-[11px] font-mono text-slate-600">
            <span>Entailment {(claim.nli.entailment * 100).toFixed(1)}%</span>
            <span>Neutral {(claim.nli.neutral * 100).toFixed(1)}%</span>
            <span>Contradiction {(claim.nli.contradiction * 100).toFixed(1)}%</span>
          </div>
        </div>
      )}

      <div className="glass-subtle border border-white/10 rounded-lg p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Retrieved Evidence</div>
          {claim.evidence && claim.evidence.page_number > 0 && (
            <div className="flex items-center gap-1.5 text-xs font-mono text-slate-500">
              <FileText className="h-3.5 w-3.5" /> {session.document}, p. {claim.evidence.page_number}
            </div>
          )}
        </div>
        {claim.evidence && claim.evidence.page_number > 0 ? (
          <>
            <p className="text-sm font-serif italic text-slate-300 leading-relaxed bg-white/[0.03] border border-white/10 rounded p-4">
              "{claim.evidence.text}"
            </p>
            <div className="mt-3 text-xs font-mono text-slate-400">
              Similarity score: {(claim.evidence.similarity_score * 100).toFixed(1)}%
            </div>
          </>
        ) : (
          <p className="text-sm text-slate-500 italic">
            No supporting or contradicting passage was found in the source document for this claim —
            that's why it's classified as unverifiable rather than false.
          </p>
        )}
      </div>

      <div className="flex items-center gap-3">
        <Badge variant="outline" className="text-slate-600">Risk: {claim.risk_level}</Badge>
        <Badge variant="outline" className="text-slate-600">Confidence: {Math.round(claim.confidence * 100)}%</Badge>
      </div>
    </motion.div>
  )
}
