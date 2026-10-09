import { motion } from "framer-motion"
import { useState, useEffect } from "react"
import { useSearchParams, Link } from "react-router-dom"
import { Badge } from "../components/ui/badge"
import {
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  FileText,
  Search,
  Calculator,
  Calendar,
  Loader2,
  ArrowRight,
} from "lucide-react"
import { allDemoClaims, type DemoClaim, type NLILabel } from "../lib/demoData"
import { getVerificationResults, type ClaimResponse, type VerificationResultResponse } from "../lib/api"

const verdictMeta = (label: string | undefined) => {
  const norm = (label || "").toUpperCase()
  if (norm === "SUPPORTED" || norm === "ENTAILMENT") {
    return { icon: CheckCircle2, color: "text-emerald-400", dot: "bg-emerald-400", label: "Supported" }
  }
  if (norm === "CONTRADICTED" || norm === "CONTRADICTION") {
    return { icon: AlertTriangle, color: "text-rose-400", dot: "bg-rose-400", label: "Contradicted" }
  }
  return { icon: HelpCircle, color: "text-amber-400", dot: "bg-amber-400", label: "Unverifiable" }
}

export default function EvidenceExplorer() {
  const [searchParams] = useSearchParams()
  const liveSessionId = searchParams.get("session")

  const [liveClaims, setLiveClaims] = useState<ClaimResponse[]>([])
  const [loadingLive, setLoadingLive] = useState(false)
  const [query, setQuery] = useState("")

  useEffect(() => {
    if (!liveSessionId) return
    setLoadingLive(true)
    getVerificationResults(liveSessionId)
      .then((res: VerificationResultResponse) => {
        setLiveClaims(res.claims || [])
        setLoadingLive(false)
      })
      .catch(() => {
        setLoadingLive(false)
      })
  }, [liveSessionId])

  // Determine claims pool: live claims if session param provided and found, else demo claims
  const claimsPool: Array<{
    id: string
    claim_text: string
    status: string
    nli?: { label: string; entailment: number; neutral: number; contradiction: number } | null
    evidence?: { text: string; page_number: number; similarity_score: number } | null
    numerical_finding?: any
    temporal_anchor?: any
  }> = liveSessionId && liveClaims.length > 0
    ? liveClaims.map((c) => ({
        id: c.id,
        claim_text: c.claim_text,
        status: c.status,
        nli: c.nli,
        evidence: c.evidence,
        numerical_finding: c.numerical_finding,
        temporal_anchor: c.temporal_anchor,
      }))
    : allDemoClaims.map((c: DemoClaim) => ({
        id: c.id,
        claim_text: c.claim_text,
        status: c.nli?.label || "UNVERIFIABLE",
        nli: c.nli,
        evidence: c.evidence,
      }))

  const [selectedId, setSelectedId] = useState<string>(claimsPool[0]?.id || "")

  useEffect(() => {
    if (claimsPool.length > 0 && (!selectedId || !claimsPool.some((c) => c.id === selectedId))) {
      setSelectedId(claimsPool[0].id)
    }
  }, [claimsPool, selectedId])

  const filtered = claimsPool.filter((c) =>
    c.claim_text.toLowerCase().includes(query.toLowerCase())
  )
  const selected = claimsPool.find((c) => c.id === selectedId) || claimsPool[0]
  const selectedMeta = verdictMeta(selected?.nli?.label || selected?.status)

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: "easeOut" }} className="flex flex-col h-full -m-6">
      <div className="px-6 py-4 glass-strong border-b border-white/10 flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-lg font-bold tracking-tight text-white">Evidence Explorer</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {liveSessionId && liveClaims.length > 0
              ? `Displaying verified evidence for session ${liveSessionId.slice(0, 8)}...`
              : "Browse every claim from the verification sessions alongside its retrieved evidence."}
          </p>
        </div>
        {liveSessionId && liveClaims.length > 0 ? (
          <Badge variant="outline" className="text-emerald-300 border-emerald-400/30 bg-emerald-500/10">
            Live Session
          </Badge>
        ) : (
          <Badge variant="outline" className="text-amber-300 border-amber-400/30 bg-amber-500/10">
            Demo Data
          </Badge>
        )}
      </div>

      {loadingLive ? (
        <div className="flex-1 flex items-center justify-center space-y-3">
          <div className="text-center">
            <Loader2 className="h-6 w-6 text-amber-400 animate-spin mx-auto mb-2" />
            <p className="text-xs text-slate-400">Loading evidence passages...</p>
          </div>
        </div>
      ) : (
        <div className="flex flex-1 min-h-0">
          {/* Claim list */}
          <div className="w-[38%] border-r border-white/10 glass-subtle overflow-y-auto">
            <div className="p-3 border-b border-white/10 bg-black/20 sticky top-0 backdrop-blur-md">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search claims..."
                  className="h-8 w-full rounded-md border border-white/10 bg-white/[0.04] pl-8 pr-3 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500/50"
                />
              </div>
            </div>
            <motion.div variants={{ hidden: {}, show: { transition: { staggerChildren: 0.05 } } }} initial="hidden" animate="show" className="divide-y divide-white/5">
              {filtered.map((c) => {
                const meta = verdictMeta(c.nli?.label || c.status)
                const active = c.id === selectedId
                return (
                  <motion.button
                    variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } }}
                    whileHover={{ y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    transition={{ duration: 0.15 }}
                    key={c.id}
                    onClick={() => setSelectedId(c.id)}
                    className={`w-full text-left p-3.5 transition-colors ${active ? "bg-amber-500/20" : "hover:bg-white/[0.05]"}`}
                  >
                    <div className="flex items-start gap-2">
                      <span className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${meta.dot}`} />
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-slate-200 leading-snug truncate">{c.claim_text}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`text-[10px] uppercase font-bold tracking-wider ${meta.color}`}>
                            {meta.label}
                          </span>
                          {c.evidence?.page_number && c.evidence.page_number > 0 && (
                            <span className="text-[10px] font-mono text-slate-500">
                              p. {c.evidence.page_number}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.button>
                )
              })}
            </motion.div>
          </div>

          {/* Detail */}
          <div className="flex-1 overflow-y-auto p-6 glass-strong">
            {selected ? (
              <div className="max-w-xl space-y-6">
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <selectedMeta.icon className={`h-4 w-4 ${selectedMeta.color}`} />
                    <span className={`text-xs font-bold uppercase tracking-widest ${selectedMeta.color}`}>
                      {selectedMeta.label}
                    </span>
                  </div>

                  <p className="text-base font-serif text-white leading-relaxed">"{selected.claim_text}"</p>
                </div>

                {selected.nli && (
                  <div>
                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">
                      NLI Confidence Distribution
                    </div>
                    <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden flex mb-2">
                      <motion.div initial={{ width: 0 }} animate={{ width: `${selected.nli.entailment * 100}%` }} transition={{ duration: 0.6, ease: "easeOut", delay: 0.1 }} className="h-full bg-emerald-500" />
                      <motion.div initial={{ width: 0 }} animate={{ width: `${selected.nli.neutral * 100}%` }} transition={{ duration: 0.6, ease: "easeOut", delay: 0.15 }} className="h-full bg-slate-300" />
                      <motion.div initial={{ width: 0 }} animate={{ width: `${selected.nli.contradiction * 100}%` }} transition={{ duration: 0.6, ease: "easeOut", delay: 0.2 }} className="h-full bg-rose-500" />
                    </div>
                    <div className="flex justify-between text-[10px] font-mono text-slate-500">
                      <span>Entail {(selected.nli.entailment * 100).toFixed(0)}%</span>
                      <span>Neutral {(selected.nli.neutral * 100).toFixed(0)}%</span>
                      <span>Contradict {(selected.nli.contradiction * 100).toFixed(0)}%</span>
                    </div>
                  </div>
                )}

                {/* Numerical audit callout if available */}
                {selected.numerical_finding && selected.numerical_finding.comparison_outcome !== "NO_CALCULATION" && (
                  <div className="glass-subtle border border-white/10 rounded-lg p-3 text-xs space-y-1">
                    <div className="flex items-center gap-1.5 text-amber-300 font-semibold">
                      <Calculator className="h-3.5 w-3.5" />
                      <span>Numerical Finding: {selected.numerical_finding.comparison_outcome}</span>
                    </div>
                    <p className="text-slate-400 text-[11px] leading-relaxed">
                      {selected.numerical_finding.explanation}
                    </p>
                  </div>
                )}

                {/* Temporal callout if available */}
                {selected.temporal_anchor && selected.temporal_anchor.period_match !== "UNSPECIFIED" && (
                  <div className="glass-subtle border border-white/10 rounded-lg p-3 text-xs space-y-1">
                    <div className="flex items-center gap-1.5 text-cyan-300 font-semibold">
                      <Calendar className="h-3.5 w-3.5" />
                      <span>Temporal Grounding: {selected.temporal_anchor.period_match}</span>
                    </div>
                    <p className="text-slate-400 text-[11px] leading-relaxed">
                      {selected.temporal_anchor.explanation}
                    </p>
                  </div>
                )}

                <div className="glass-subtle border border-white/10 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Document Excerpt</div>
                    {selected.evidence && selected.evidence.page_number > 0 && (
                      <div className="flex items-center gap-1 text-[11px] font-mono text-slate-500">
                        <FileText className="h-3 w-3" /> p. {selected.evidence.page_number}
                      </div>
                    )}
                  </div>
                  <p className="text-sm font-serif italic text-slate-300 leading-relaxed">
                    {selected.evidence && selected.evidence.page_number > 0
                      ? `"${selected.evidence.text}"`
                      : "No matching passage was retrieved from the source document."}
                  </p>
                  {selected.evidence && selected.evidence.similarity_score > 0 && (
                    <div className="mt-2 text-[10px] font-mono text-slate-500">
                      Similarity score: {(selected.evidence.similarity_score * 100).toFixed(1)}%
                    </div>
                  )}
                </div>

                {liveSessionId && (
                  <Link
                    to={`/verify/results/${liveSessionId}/claim/${selected.id}`}
                    className="inline-flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300 font-medium"
                  >
                    View Complete Claim Audit <ArrowRight className="h-3 w-3" />
                  </Link>
                )}
              </div>
            ) : (
              <div className="text-center py-12 text-slate-500 text-xs">No claim selected</div>
            )}
          </div>
        </div>
      )}
    </motion.div>
  )
}
