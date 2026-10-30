import { motion, AnimatePresence } from "framer-motion"
import { useState, useEffect, useMemo } from "react"
import { useSearchParams, Link } from "react-router-dom"
import { Badge } from "../components/ui/badge"
import { Button } from "../components/ui/button"
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
  Filter,
  Sparkles,
  Layers,
  Hash,
  Database,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  ShieldAlert
} from "lucide-react"
import { allDemoClaims, demoSessions, type DemoClaim, type NLILabel } from "../lib/demoData"
import { getVerificationResults, type ClaimResponse, type VerificationResultResponse } from "../lib/api"

const verdictMeta = (label: string | undefined) => {
  const norm = (label || "").toUpperCase()
  if (norm === "SUPPORTED" || norm === "ENTAILMENT") {
    return { 
      icon: CheckCircle2, 
      color: "text-emerald-300", 
      dot: "bg-emerald-400", 
      badge: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
      label: "Supported" 
    }
  }
  if (norm === "CONTRADICTED" || norm === "CONTRADICTION") {
    return { 
      icon: AlertTriangle, 
      color: "text-rose-300", 
      dot: "bg-rose-400", 
      badge: "bg-rose-500/10 text-rose-300 border-rose-500/30",
      label: "Contradicted" 
    }
  }
  return { 
    icon: HelpCircle, 
    color: "text-amber-300", 
    dot: "bg-amber-400", 
    badge: "bg-amber-500/10 text-amber-300 border-amber-500/30",
    label: "Unverifiable" 
  }
}

type StatusFilter = "ALL" | "SUPPORTED" | "CONTRADICTED" | "UNVERIFIABLE"

export default function EvidenceExplorer() {
  const [searchParams, setSearchParams] = useSearchParams()
  const liveSessionId = searchParams.get("session")

  const [liveClaims, setLiveClaims] = useState<ClaimResponse[]>([])
  const [loadingLive, setLoadingLive] = useState(false)
  const [query, setQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL")
  const [selectedDemoSession, setSelectedDemoSession] = useState<string>("all")

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

  // Determine available pool
  const rawPool = useMemo(() => {
    if (liveSessionId && liveClaims.length > 0) {
      return liveClaims.map((c) => ({
        id: c.id,
        sessionId: liveSessionId,
        sessionTitle: `Live Session (${liveSessionId.slice(0, 8)}...)`,
        claim_text: c.claim_text,
        status: c.status,
        nli: c.nli,
        evidence: c.evidence,
        numerical_finding: c.numerical_finding,
        temporal_anchor: c.temporal_anchor,
        multi_hop_finding: c.multi_hop_finding,
        hallucination_type: c.hallucination_type,
        reasoning_summary: c.reasoning_summary,
      }))
    }

    if (selectedDemoSession === "all") {
      return demoSessions.flatMap((s) =>
        s.claims.map((c) => ({
          id: c.id,
          sessionId: s.id,
          sessionTitle: s.title,
          claim_text: c.claim_text,
          status: c.nli?.label || "UNVERIFIABLE",
          nli: c.nli,
          evidence: c.evidence,
          numerical_finding: c.numerical_finding,
          temporal_anchor: c.temporal_anchor,
          multi_hop_finding: c.multi_hop_finding,
          hallucination_type: c.hallucination_type,
          reasoning_summary: c.reasoning_summary,
        }))
      )
    }

    const session = demoSessions.find((s) => s.id === selectedDemoSession)
    if (!session) return []
    return session.claims.map((c) => ({
      id: c.id,
      sessionId: session.id,
      sessionTitle: session.title,
      claim_text: c.claim_text,
      status: c.nli?.label || "UNVERIFIABLE",
      nli: c.nli,
      evidence: c.evidence,
      numerical_finding: c.numerical_finding,
      temporal_anchor: c.temporal_anchor,
      multi_hop_finding: c.multi_hop_finding,
      hallucination_type: c.hallucination_type,
      reasoning_summary: c.reasoning_summary,
    }))
  }, [liveSessionId, liveClaims, selectedDemoSession])

  // Filter by query and status
  const filteredClaims = useMemo(() => {
    return rawPool.filter((c) => {
      const textMatch = 
        c.claim_text.toLowerCase().includes(query.toLowerCase()) ||
        (c.evidence?.text && c.evidence.text.toLowerCase().includes(query.toLowerCase()))

      if (!textMatch) return false

      if (statusFilter === "ALL") return true
      const norm = (c.nli?.label || c.status || "").toUpperCase()
      if (statusFilter === "SUPPORTED") return norm === "SUPPORTED" || norm === "ENTAILMENT"
      if (statusFilter === "CONTRADICTED") return norm === "CONTRADICTED" || norm === "CONTRADICTION"
      if (statusFilter === "UNVERIFIABLE") return norm === "UNVERIFIABLE" || norm === "NEUTRAL"
      return true
    })
  }, [rawPool, query, statusFilter])

  const [selectedId, setSelectedId] = useState<string>("")

  useEffect(() => {
    if (filteredClaims.length > 0) {
      if (!selectedId || !filteredClaims.some((c) => c.id === selectedId)) {
        setSelectedId(filteredClaims[0].id)
      }
    }
  }, [filteredClaims, selectedId])

  const selected = filteredClaims.find((c) => c.id === selectedId) || filteredClaims[0]
  const selectedMeta = verdictMeta(selected?.nli?.label || selected?.status)

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }} 
      animate={{ opacity: 1, y: 0 }} 
      transition={{ duration: 0.35, ease: "easeOut" }} 
      className="flex flex-col h-[calc(100vh-5.5rem)] -m-6 overflow-hidden"
    >
      {/* Top Header Bar */}
      <div className="px-6 py-3.5 glass-strong border-b border-white/10 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-400 font-mono">
            <span>VERIFIN</span>
            <ChevronRight className="h-3 w-3 text-slate-600" />
            <span className="text-amber-400">Provenance & Grounding</span>
          </div>
          <h1 className="text-lg font-bold tracking-tight text-white flex items-center gap-2 mt-0.5">
            <Database className="h-4 w-4 text-amber-400" />
            Evidence Explorer
          </h1>
        </div>

        {/* Live vs Demo Context Selector */}
        <div className="flex items-center gap-2">
          {liveSessionId && liveClaims.length > 0 ? (
            <Badge variant="outline" className="text-emerald-300 border-emerald-400/30 bg-emerald-500/10 font-mono text-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1.5 animate-pulse" />
              Live Session: {liveSessionId.slice(0, 8)}
            </Badge>
          ) : (
            <div className="flex items-center gap-1.5 bg-black/40 border border-white/10 rounded-lg p-1 text-xs">
              <span className="text-slate-400 text-[11px] px-2 font-mono">Session:</span>
              <select
                value={selectedDemoSession}
                onChange={(e) => setSelectedDemoSession(e.target.value)}
                className="bg-transparent text-white text-xs font-semibold focus:outline-none cursor-pointer pr-2"
              >
                <option value="all" className="bg-slate-900 text-white">All Sessions (14 claims)</option>
                <option value="demo-sec-aapl-2025" className="bg-slate-900 text-white">Apple FY25 10-K</option>
                <option value="demo-sec-msft-2024" className="bg-slate-900 text-white">Microsoft Cloud 10-K</option>
                <option value="demo-sec-tsla-2024" className="bg-slate-900 text-white">Tesla Deliveries 10-K</option>
              </select>
            </div>
          )}
        </div>
      </div>

      {loadingLive ? (
        <div className="flex-1 flex items-center justify-center space-y-3">
          <div className="text-center">
            <Loader2 className="h-8 w-8 text-amber-400 animate-spin mx-auto mb-2" />
            <p className="text-xs text-slate-400 font-mono">Loading hybrid retrieved evidence passages...</p>
          </div>
        </div>
      ) : (
        <div className="flex flex-1 min-h-0">
          {/* Claim list (Left Column) */}
          <div className="w-[42%] lg:w-[38%] border-r border-white/10 glass-subtle flex flex-col min-h-0">
            {/* Search & Status Filters */}
            <div className="p-3 border-b border-white/10 bg-black/30 backdrop-blur-md space-y-2 shrink-0">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search claims or retrieved text..."
                  className="h-8 w-full rounded-lg border border-white/10 bg-white/[0.04] pl-8 pr-3 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-400"
                />
              </div>

              {/* Status Chips */}
              <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
                {(["ALL", "SUPPORTED", "CONTRADICTED", "UNVERIFIABLE"] as StatusFilter[]).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setStatusFilter(tab)}
                    className={`px-2 py-0.5 text-[10px] font-mono font-bold rounded uppercase transition-colors shrink-0 ${
                      statusFilter === tab
                        ? "bg-amber-500/20 text-amber-300 border border-amber-400/30"
                        : "text-slate-400 hover:text-white hover:bg-white/5 border border-transparent"
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            </div>

            {/* Scrollable list */}
            <div className="flex-1 overflow-y-auto divide-y divide-white/5">
              {filteredClaims.length === 0 ? (
                <div className="text-center py-12 px-4 text-slate-500 text-xs">
                  No claims found matching this criteria
                </div>
              ) : (
                filteredClaims.map((c) => {
                  const meta = verdictMeta(c.nli?.label || c.status)
                  const active = c.id === selected?.id
                  return (
                    <button
                      key={c.id}
                      onClick={() => setSelectedId(c.id)}
                      className={`w-full text-left p-3.5 transition-all text-xs relative ${
                        active 
                          ? "bg-amber-500/15 border-l-2 border-amber-400 shadow-inner" 
                          : "hover:bg-white/[0.04] border-l-2 border-transparent"
                      }`}
                    >
                      <div className="flex items-start gap-2.5">
                        <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${meta.dot} ${active ? "animate-pulse" : ""}`} />
                        <div className="min-w-0 flex-1">
                          <p className={`font-medium leading-snug line-clamp-2 ${active ? "text-white font-semibold" : "text-slate-300"}`}>
                            "{c.claim_text}"
                          </p>
                          <div className="flex flex-wrap items-center gap-2 mt-2">
                            <span className={`text-[10px] uppercase font-bold tracking-wider font-mono ${meta.color}`}>
                              {meta.label}
                            </span>
                            {c.evidence?.page_number && c.evidence.page_number > 0 && (
                              <span className="text-[10px] font-mono text-slate-400 bg-white/5 px-1 rounded">
                                p. {c.evidence.page_number}
                              </span>
                            )}
                            {c.evidence?.retrieval_method && (
                              <span className="text-[9px] font-mono text-indigo-300 bg-indigo-500/10 px-1 rounded">
                                {c.evidence.retrieval_method}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </button>
                  )
                })
              )}
            </div>
          </div>

          {/* Evidence Passage Detail (Right Column) */}
          <div className="flex-1 overflow-y-auto p-6 lg:p-8 glass-strong min-h-0 space-y-6">
            {selected ? (
              <motion.div 
                key={selected.id}
                initial={{ opacity: 0, x: 10 }} 
                animate={{ opacity: 1, x: 0 }} 
                transition={{ duration: 0.2 }}
                className="max-w-2xl space-y-6"
              >
                {/* Claim Box */}
                <div className="glass-card p-5 space-y-3 relative overflow-hidden">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <selectedMeta.icon className={`h-4 w-4 ${selectedMeta.color}`} />
                      <Badge className={selectedMeta.badge}>
                        {selectedMeta.label}
                      </Badge>
                    </div>
                    <span className="text-[10px] font-mono text-slate-400">
                      Session: {selected.sessionTitle}
                    </span>
                  </div>

                  <p className="text-base font-serif italic text-white leading-relaxed">
                    "{selected.claim_text}"
                  </p>
                </div>

                {/* DeBERTa NLI Breakdown */}
                {selected.nli && (
                  <div className="glass-card p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">
                        Natural Language Inference (DeBERTa-v3)
                      </div>
                      <Badge variant="outline" className="text-[10px] font-mono border-white/10 text-slate-300">
                        Cross-Encoder Signal
                      </Badge>
                    </div>
                    
                    <div className="h-2.5 w-full bg-black/40 rounded-full overflow-hidden flex border border-white/5">
                      <motion.div 
                        initial={{ width: 0 }} 
                        animate={{ width: `${selected.nli.entailment * 100}%` }} 
                        transition={{ duration: 0.6, ease: "easeOut" }} 
                        className="h-full bg-emerald-500" 
                        title={`Entailment ${(selected.nli.entailment * 100).toFixed(1)}%`}
                      />
                      <motion.div 
                        initial={{ width: 0 }} 
                        animate={{ width: `${selected.nli.neutral * 100}%` }} 
                        transition={{ duration: 0.6, ease: "easeOut", delay: 0.1 }} 
                        className="h-full bg-slate-500" 
                        title={`Neutral ${(selected.nli.neutral * 100).toFixed(1)}%`}
                      />
                      <motion.div 
                        initial={{ width: 0 }} 
                        animate={{ width: `${selected.nli.contradiction * 100}%` }} 
                        transition={{ duration: 0.6, ease: "easeOut", delay: 0.2 }} 
                        className="h-full bg-rose-500" 
                        title={`Contradiction ${(selected.nli.contradiction * 100).toFixed(1)}%`}
                      />
                    </div>
                    
                    <div className="flex justify-between text-[11px] font-mono text-slate-400 pt-1">
                      <span className="text-emerald-300">Entailment {(selected.nli.entailment * 100).toFixed(1)}%</span>
                      <span className="text-slate-400">Neutral {(selected.nli.neutral * 100).toFixed(1)}%</span>
                      <span className="text-rose-300">Contradiction {(selected.nli.contradiction * 100).toFixed(1)}%</span>
                    </div>
                  </div>
                )}

                {/* Numerical Finding if present */}
                {selected.numerical_finding && selected.numerical_finding.comparison_outcome !== "NO_CALCULATION" && (
                  <div className="glass-card p-4 space-y-2 border-amber-500/20 bg-amber-500/5">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5 text-amber-300 font-semibold font-mono">
                        <Calculator className="h-3.5 w-3.5 text-amber-400" />
                        <span>Deterministic Numerical Audit</span>
                      </div>
                      <Badge variant="outline" className="text-[10px] font-mono text-amber-300 border-amber-400/30">
                        {selected.numerical_finding.comparison_outcome}
                      </Badge>
                    </div>
                    {selected.numerical_finding.formula && (
                      <div className="p-2 rounded bg-black/40 font-mono text-[11px] text-amber-200 border border-white/5">
                        {selected.numerical_finding.formula}
                      </div>
                    )}
                    <p className="text-slate-300 text-xs leading-relaxed">
                      {selected.numerical_finding.explanation}
                    </p>
                  </div>
                )}

                {/* Temporal Anchor if present */}
                {selected.temporal_anchor && selected.temporal_anchor.period_match !== "UNSPECIFIED" && (
                  <div className="glass-card p-4 space-y-2 border-cyan-500/20 bg-cyan-500/5">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5 text-cyan-300 font-semibold font-mono">
                        <Calendar className="h-3.5 w-3.5 text-cyan-400" />
                        <span>Temporal Grounding Alignment</span>
                      </div>
                      <Badge variant="outline" className="text-[10px] font-mono text-cyan-300 border-cyan-400/30">
                        {selected.temporal_anchor.period_match}
                      </Badge>
                    </div>
                    <p className="text-slate-300 text-xs leading-relaxed">
                      {selected.temporal_anchor.explanation}
                    </p>
                  </div>
                )}

                {/* Hallucination Summary if present */}
                {selected.reasoning_summary && (
                  <div className="glass-card p-4 space-y-2 border-rose-500/20 bg-rose-500/5">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5 text-rose-300 font-semibold font-mono">
                        <ShieldAlert className="h-3.5 w-3.5 text-rose-400" />
                        <span>Hallucination Diagnostic</span>
                      </div>
                      {selected.hallucination_type && (
                        <Badge variant="outline" className="text-[10px] font-mono text-rose-300 border-rose-400/30">
                          {selected.hallucination_type.replace(/_/g, " ")}
                        </Badge>
                      )}
                    </div>
                    <p className="text-slate-300 text-xs leading-relaxed">
                      {selected.reasoning_summary}
                    </p>
                  </div>
                )}

                {/* Retrieved Document Excerpt Card */}
                <div className="glass-card p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-amber-400" />
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">
                        Retrieved Document Excerpt
                      </span>
                    </div>
                    {selected.evidence && selected.evidence.page_number > 0 && (
                      <Badge variant="outline" className="text-[11px] font-mono text-slate-300 border-white/10">
                        Page {selected.evidence.page_number}
                      </Badge>
                    )}
                  </div>

                  <div className="p-4 rounded-xl bg-black/40 border border-white/5">
                    <p className="text-sm font-serif italic text-slate-200 leading-relaxed">
                      {selected.evidence && selected.evidence.page_number > 0
                        ? `"${selected.evidence.text}"`
                        : "No matching passage was retrieved from the source document."}
                    </p>
                  </div>

                  {/* Retrieval Provenance Breakdown */}
                  {selected.evidence && selected.evidence.similarity_score > 0 && (
                    <div className="space-y-2 pt-2 border-t border-white/5">
                      <div className="grid grid-cols-3 gap-2 text-[11px] font-mono">
                        <div className="p-2 rounded bg-white/[0.02] border border-white/5">
                          <span className="text-[9px] uppercase text-slate-500 block">Hybrid Score</span>
                          <span className="text-indigo-300 font-bold">{(selected.evidence.similarity_score * 100).toFixed(1)}%</span>
                        </div>
                        {selected.evidence.dense_score != null && (
                          <div className="p-2 rounded bg-white/[0.02] border border-white/5">
                            <span className="text-[9px] uppercase text-slate-500 block">Dense Sim</span>
                            <span className="text-white font-bold">{(selected.evidence.dense_score * 100).toFixed(1)}%</span>
                          </div>
                        )}
                        {selected.evidence.bm25_score != null && (
                          <div className="p-2 rounded bg-white/[0.02] border border-white/5">
                            <span className="text-[9px] uppercase text-slate-500 block">BM25 Lexical</span>
                            <span className="text-amber-300 font-bold">{selected.evidence.bm25_score.toFixed(2)}</span>
                          </div>
                        )}
                      </div>

                      {selected.evidence.matched_keywords && selected.evidence.matched_keywords.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5 pt-1">
                          <span className="text-[10px] font-mono text-slate-500 uppercase mr-1">Matched Terms:</span>
                          {selected.evidence.matched_keywords.map((kw: string, ki: number) => (
                            <Badge key={ki} variant="outline" className="text-slate-300 border-white/10 bg-white/5 font-mono text-[9px] px-1.5 py-0">
                              <Hash className="h-2.5 w-2.5 mr-0.5 text-amber-400" /> {kw}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Audit Deep Dive Link */}
                <div className="pt-2 flex justify-end">
                  <Link
                    to={`/verify/results/${selected.sessionId}/claim/${selected.id}`}
                    className="inline-flex items-center gap-1.5 text-xs text-amber-400 hover:text-amber-300 font-semibold transition-colors"
                  >
                    Open Complete Deep-Dive Audit <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </motion.div>
            ) : (
              <div className="text-center py-20 text-slate-500 text-xs font-mono">
                Select a claim from the list to inspect its retrieved evidence and grounding details.
              </div>
            )}
          </div>
        </div>
      )}
    </motion.div>
  )
}
