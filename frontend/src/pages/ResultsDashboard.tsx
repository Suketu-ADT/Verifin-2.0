import { motion } from "framer-motion"
import { useParams, Link } from "react-router-dom"
import { useState, useEffect } from "react"
import { Card, CardContent } from "../components/ui/card"
import { Badge } from "../components/ui/badge"
import { Button } from "../components/ui/button"
import {
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  ArrowLeft,
  ChevronRight,
  FileText,
  Loader2,
  Calculator,
  Calendar,
  Layers,
  ShieldAlert,
  Search,
  Download,
  Copy,
  Check,
  Sparkles,
} from "lucide-react"
import { demoSessions, claimCounts, type NLILabel } from "../lib/demoData"
import { figureCheckLabel } from "../lib/figureCheck"
import {
  getVerificationResults,
  getDocument,
  downloadReport,
  errorMessage,
  type VerificationResultResponse,
  type DocumentResponse,
} from "../lib/api"

const verdictMeta = (label: string | undefined) => {
  const norm = (label || "").toUpperCase()
  if (norm === "SUPPORTED" || norm === "ENTAILMENT") {
    return { icon: CheckCircle2, text: "text-emerald-300", bg: "bg-emerald-500/10 border-emerald-400/30", label: "Supported" }
  }
  if (norm === "CONTRADICTED" || norm === "CONTRADICTION") {
    return { icon: AlertTriangle, text: "text-rose-300", bg: "bg-rose-500/10 border-rose-400/30", label: "Contradicted" }
  }
  return { icon: HelpCircle, text: "text-amber-300", bg: "bg-amber-500/10 border-amber-400/30", label: "Unverifiable" }
}

export default function ResultsDashboard() {
  const { id } = useParams()
  const demoSession = demoSessions.find((s) => s.id === id)

  const [liveSession, setLiveSession] = useState<VerificationResultResponse | null>(null)
  const [docMeta, setDocMeta] = useState<DocumentResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [activeFilter, setActiveFilter] = useState<"ALL" | "CONTRADICTED" | "SUPPORTED" | "UNVERIFIABLE">("ALL")
  const [copiedId, setCopiedId] = useState(false)
  const [exporting, setExporting] = useState<"pdf" | "csv" | null>(null)
  const [exportError, setExportError] = useState<string | null>(null)

  const exportReport = async (format: "pdf" | "csv") => {
    if (!liveSession) return
    setExporting(format)
    setExportError(null)
    try {
      await downloadReport(liveSession.id, format)
    } catch (err) {
      setExportError(errorMessage(err, "The report could not be downloaded."))
    } finally {
      setExporting(null)
    }
  }

  useEffect(() => {
    if (demoSession || !id) return
    setLoading(true)
    setLoadError(null)
    getVerificationResults(id)
      .then((res) => {
        setLiveSession(res)
        setLoading(false)
        if (res.document_id) {
          getDocument(res.document_id)
            .then(setDocMeta)
            .catch(() => {})
        }
      })
      .catch((err) => {
        const detail = err?.response?.data?.detail || err?.message || `Session "${id}" was not found.`
        setLoadError(typeof detail === "string" ? detail : JSON.stringify(detail))
        setLoading(false)
      })
  }, [id, demoSession])

  const copySessionId = () => {
    if (!id) return
    navigator.clipboard.writeText(id)
    setCopiedId(true)
    setTimeout(() => setCopiedId(false), 2000)
  }

  // 1. Loading state for live query
  if (loading) {
    return (
      <div className="max-w-2xl mx-auto text-center py-24 space-y-4">
        <div className="h-12 w-12 rounded-2xl bg-amber-500/10 border border-amber-400/20 flex items-center justify-center mx-auto">
          <Loader2 className="h-6 w-6 text-amber-400 animate-spin" />
        </div>
        <h1 className="text-lg font-bold text-white">Retrieving Verification Audit...</h1>
        <p className="text-xs text-slate-400 font-mono">Querying MongoDB Atlas for session {id}</p>
      </div>
    )
  }

  // 2. Demo Session mode (canned dataset preserved)
  if (demoSession) {
    const counts = claimCounts(demoSession.claims)
    const overallScore = Math.round((counts.supported / counts.total) * 100)
    const filteredClaims = demoSession.claims.filter((c) => {
      if (activeFilter === "ALL") return true
      if (activeFilter === "CONTRADICTED") return c.nli?.label === "CONTRADICTED"
      if (activeFilter === "SUPPORTED") return c.nli?.label === "SUPPORTED"
      return c.nli?.label === "UNVERIFIABLE"
    })

    return (
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: "easeOut" }} className="space-y-6">
        {/* Header Breadcrumbs & Quick Actions */}
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
          <div>
            <Link to="/verify" className="inline-flex items-center text-xs font-semibold text-slate-400 hover:text-white mb-2">
              <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Back to Verification Launchpad
            </Link>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-2xl font-extrabold tracking-tight text-white">{demoSession.title}</h1>
              <Badge variant="outline" className="text-amber-300 border-amber-400/30 bg-amber-500/10 font-mono text-[10px]">
                Demo Dataset
              </Badge>
              <Badge variant="outline" className="text-indigo-300 border-indigo-400/30 bg-indigo-500/10 font-mono text-[10px]">
                BM25 Hybrid RAG
              </Badge>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-400 mt-1 font-mono">
              <FileText className="h-3.5 w-3.5 text-slate-400" />
              <span>{demoSession.document}</span>
              <span>·</span>
              <span>{demoSession.claims.length} claims audited</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link to="/evidence">
              <Button variant="outline" size="sm" className="h-9 text-xs border-white/10 hover:bg-white/10 gap-1.5">
                <Search className="h-3.5 w-3.5 text-indigo-400" /> Inspect Evidence Corpus
              </Button>
            </Link>
            <Button variant="outline" size="sm" onClick={() => window.print()} className="h-9 text-xs border-white/10 hover:bg-white/10 gap-1.5">
              <Download className="h-3.5 w-3.5" /> Print Audit
            </Button>
          </div>
        </div>

        {/* LLM answer panel */}
        <div className="glass-card rounded-2xl p-5 border border-white/10 space-y-2 relative overflow-hidden">
          <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            <span className="flex items-center gap-1.5 text-amber-300">
              <Sparkles className="h-3 w-3" /> LLM-Generated Financial Synthesis Under Review
            </span>
            <span className="font-mono text-slate-400">Prompt Target: FY2025 Performance</span>
          </div>
          <p className="text-sm font-medium text-slate-200 leading-relaxed bg-black/30 p-4 rounded-xl border border-white/5">
            "{demoSession.llm_output}"
          </p>
        </div>

        {/* 4 Metric Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="glass-card rounded-2xl p-4 border border-white/10">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Claims Audited</div>
            <div className="text-2xl font-bold text-white font-mono">{counts.total}</div>
            <div className="text-[11px] text-slate-400 mt-1">100% evaluated</div>
          </div>
          <div className="glass-card rounded-2xl p-4 border border-emerald-400/30">
            <div className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest mb-1">Supported Facts</div>
            <div className="text-2xl font-bold text-emerald-400 font-mono">{counts.supported}</div>
            <div className="text-[11px] text-emerald-400/80 mt-1 font-mono">{overallScore}% support rate</div>
          </div>
          <div className="glass-card rounded-2xl p-4 border border-rose-400/30">
            <div className="text-[10px] font-bold text-rose-400 uppercase tracking-widest mb-1">Hallucinations</div>
            <div className="text-2xl font-bold text-rose-400 font-mono">{counts.contradicted}</div>
            <div className="text-[11px] text-rose-400/80 mt-1 font-mono">{Math.round((counts.contradicted / counts.total) * 100)}% contradiction rate</div>
          </div>
          <div className="glass-card rounded-2xl p-4 border border-amber-400/30">
            <div className="text-[10px] font-bold text-amber-400 uppercase tracking-widest mb-1">Unverifiable</div>
            <div className="text-2xl font-bold text-amber-400 font-mono">{counts.unverifiable}</div>
            <div className="text-[11px] text-amber-400/80 mt-1 font-mono">Missing evidence</div>
          </div>
        </div>

        {/* Support Rate Progress Banner */}
        <div className="glass-card rounded-2xl p-4 border border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-white">Overall Factual Support Rate</span>
              <span className="text-xs font-mono font-bold text-emerald-400">{overallScore}%</span>
            </div>
            <p className="text-xs text-slate-400">
              Proportion of model assertions backed by SEC 10-K document evidence.
            </p>
          </div>
          <div className="w-full sm:w-64 h-2.5 bg-black/40 rounded-full overflow-hidden flex border border-white/5">
            <div className="h-full bg-emerald-400" style={{ width: `${overallScore}%` }} />
            <div className="h-full bg-rose-500" style={{ width: `${Math.round((counts.contradicted / counts.total) * 100)}%` }} />
            <div className="h-full bg-amber-400" style={{ width: `${Math.round((counts.unverifiable / counts.total) * 100)}%` }} />
          </div>
        </div>

        {/* Claim-by-Claim Section with Filter Buttons */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
            <div>
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">Claim-by-Claim Verification Graph</h2>
              <p className="text-xs text-slate-400">Select any claim to inspect NLI probabilities and exact PDF coordinates</p>
            </div>

            <div className="flex items-center gap-1 bg-black/40 p-1 rounded-xl border border-white/10 text-xs">
              {(["ALL", "CONTRADICTED", "SUPPORTED", "UNVERIFIABLE"] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setActiveFilter(filter)}
                  className={`px-2.5 py-1 rounded-lg font-semibold transition-all text-[11px] ${
                    activeFilter === filter
                      ? "bg-amber-400 text-neutral-950 shadow"
                      : "text-slate-400 hover:text-white hover:bg-white/5"
                  }`}
                >
                  {filter === "ALL" ? `All (${demoSession.claims.length})` : filter === "CONTRADICTED" ? `Contradicted (${counts.contradicted})` : filter === "SUPPORTED" ? `Supported (${counts.supported})` : `Unverified (${counts.unverifiable})`}
                </button>
              ))}
            </div>
          </div>

          <motion.div variants={{ hidden: {}, show: { transition: { staggerChildren: 0.05 } } }} initial="hidden" animate="show" className="space-y-3">
            {filteredClaims.map((c, i) => {
              const meta = verdictMeta(c.nli?.label)
              return (
                <Link key={c.id} to={`/verify/results/${demoSession.id}/claim/${c.id}`} className="block group">
                  <motion.div variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } }} whileHover={{ y: -2 }} whileTap={{ scale: 0.99 }} transition={{ duration: 0.15 }}>
                    <div className={`glass-card rounded-2xl p-4 border transition-all ${meta.bg}`}>
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="text-xs font-mono font-bold text-slate-400 shrink-0">{String(i + 1).padStart(2, "0")}</span>
                          <meta.icon className={`h-4 w-4 shrink-0 ${meta.text}`} />
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-white truncate group-hover:text-amber-200 transition-colors">
                              {c.claim_text}
                            </p>
                            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                              {c.evidence && c.evidence.page_number > 0 && (
                                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-white/10 bg-white/5 text-slate-300">
                                  Page {c.evidence.page_number}
                                </span>
                              )}
                              {c.evidence?.retrieval_method && (
                                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-indigo-400/30 text-indigo-300 bg-indigo-500/10">
                                  {c.evidence.retrieval_method === "hybrid" ? "Hybrid RAG" : c.evidence.retrieval_method}
                                </span>
                              )}
                              {c.hallucination_type && c.hallucination_type !== "NONE" && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded border border-rose-400/30 text-rose-300 bg-rose-500/10">
                                  <ShieldAlert className="h-2.5 w-2.5" />
                                  {c.hallucination_type.replace(/_/g, " ")}
                                </span>
                              )}
                              {c.numerical_finding && c.numerical_finding.comparison_outcome !== "NO_CALCULATION" && (
                                <span className={`inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded border ${
                                  c.numerical_finding.comparison_outcome === "VALIDATED" ? "text-emerald-300 border-emerald-400/30 bg-emerald-500/10" : "text-rose-300 border-rose-400/30 bg-rose-500/10"
                                }`}>
                                  <Calculator className="h-2.5 w-2.5" />
                                  Figure check: {figureCheckLabel(c.numerical_finding.comparison_outcome)}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          <span className={`text-xs font-bold uppercase tracking-wider font-mono ${meta.text}`}>{meta.label}</span>
                          <ChevronRight className="h-4 w-4 text-slate-400 group-hover:translate-x-1 transition-transform" />
                        </div>
                      </div>
                    </div>
                  </motion.div>
                </Link>
              )
            })}
          </motion.div>
        </div>
      </motion.div>
    )
  }

  // 3. Live Session mode (from real MongoDB Atlas session)
  if (liveSession) {
    const totalClaims = liveSession.claims.length
    const supportedCount = liveSession.claims.filter(
      (c) => c.status === "SUPPORTED" || c.status === "ENTAILMENT"
    ).length
    const contradictedCount = liveSession.claims.filter(
      (c) => c.status === "CONTRADICTED" || c.status === "CONTRADICTION"
    ).length
    const unverifiableCount = totalClaims - (supportedCount + contradictedCount)
    const docDisplayName = docMeta?.filename || `Document: ${liveSession.document_id}`

    const filteredClaims = liveSession.claims.filter((c) => {
      const norm = (c.status || "").toUpperCase()
      if (activeFilter === "ALL") return true
      if (activeFilter === "CONTRADICTED") return norm === "CONTRADICTED" || norm === "CONTRADICTION"
      if (activeFilter === "SUPPORTED") return norm === "SUPPORTED" || norm === "ENTAILMENT"
      return norm !== "CONTRADICTED" && norm !== "CONTRADICTION" && norm !== "SUPPORTED" && norm !== "ENTAILMENT"
    })

    return (
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: "easeOut" }} className="space-y-6">
        {/* Header Breadcrumbs & Quick Actions */}
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
          <div>
            <Link to="/verify" className="inline-flex items-center text-xs font-semibold text-slate-400 hover:text-white mb-2">
              <ArrowLeft className="h-3.5 w-3.5 mr-1" /> New Verification
            </Link>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-2xl font-extrabold tracking-tight text-white">Live Verification Results</h1>
              <Badge variant="outline" className="text-emerald-400 border-emerald-400/30 bg-emerald-500/10 font-mono text-[10px]">
                Live Session
              </Badge>
              <Badge variant="outline" className="text-indigo-300 border-indigo-400/30 bg-indigo-500/10 font-mono text-[10px]">
                BM25 Hybrid RAG
              </Badge>
              <Badge variant="outline" className="text-amber-300 border-amber-400/30 bg-amber-500/10 font-mono text-[10px]">
                Risk: {liveSession.risk_level}
              </Badge>
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-400 mt-1 font-mono">
              <span className="flex items-center gap-1">
                <FileText className="h-3.5 w-3.5 text-slate-400" />
                {docDisplayName}
              </span>
              <span>·</span>
              <button onClick={copySessionId} className="hover:text-white flex items-center gap-1">
                <span>Session: {liveSession.id.slice(0, 8)}...</span>
                {copiedId ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link to={`/evidence?session=${liveSession.id}`}>
              <Button variant="outline" size="sm" className="h-9 text-xs border-white/10 hover:bg-white/10 gap-1.5">
                <Search className="h-3.5 w-3.5 text-indigo-400" /> Inspect Evidence
              </Button>
            </Link>
            <Button variant="outline" size="sm" onClick={() => window.print()} className="h-9 text-xs border-white/10 hover:bg-white/10 gap-1.5">
              <Download className="h-3.5 w-3.5" /> Print Audit
            </Button>
            <Button variant="outline" size="sm" disabled={exporting !== null} onClick={() => exportReport("pdf")} className="h-9 text-xs border-white/10 hover:bg-white/10 gap-1.5">
              <Download className="h-3.5 w-3.5 text-amber-400" /> {exporting === "pdf" ? "Preparing…" : "PDF report"}
            </Button>
            <Button variant="outline" size="sm" disabled={exporting !== null} onClick={() => exportReport("csv")} className="h-9 text-xs border-white/10 hover:bg-white/10 gap-1.5">
              <Download className="h-3.5 w-3.5 text-amber-400" /> {exporting === "csv" ? "Preparing…" : "CSV"}
            </Button>
            {exportError && <span role="alert" className="text-xs text-rose-400">{exportError}</span>}
          </div>
        </div>

        {/* Metric Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="glass-card rounded-2xl p-4 border border-white/10">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Claims Audited</div>
            <div className="text-2xl font-bold text-white font-mono">{totalClaims}</div>
            <div className="text-[11px] text-slate-400 mt-1">Status: {liveSession.status}</div>
          </div>
          <div className="glass-card rounded-2xl p-4 border border-emerald-400/30">
            <div className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest mb-1">Supported Facts</div>
            <div className="text-2xl font-bold text-emerald-400 font-mono">{supportedCount}</div>
            <div className="text-[11px] text-emerald-400/80 mt-1 font-mono">{liveSession.overall_score}% verified</div>
          </div>
          <div className="glass-card rounded-2xl p-4 border border-rose-400/30">
            <div className="text-[10px] font-bold text-rose-400 uppercase tracking-widest mb-1">Hallucinations</div>
            <div className="text-2xl font-bold text-rose-400 font-mono">{contradictedCount}</div>
            <div className="text-[11px] text-rose-400/80 mt-1 font-mono">{totalClaims > 0 ? Math.round((contradictedCount / totalClaims) * 100) : 0}% contradiction</div>
          </div>
          <div className="glass-card rounded-2xl p-4 border border-amber-400/30">
            <div className="text-[10px] font-bold text-amber-400 uppercase tracking-widest mb-1">Unverifiable</div>
            <div className="text-2xl font-bold text-amber-400 font-mono">{unverifiableCount}</div>
            <div className="text-[11px] text-amber-400/80 mt-1 font-mono">Missing evidence</div>
          </div>
        </div>

        {/* Overall Score Progress Banner */}
        <div className="glass-card rounded-2xl p-4 border border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-white">Overall Factual Support Rate</span>
              <span className="text-xs font-mono font-bold text-emerald-400">{liveSession.overall_score}%</span>
            </div>
            <p className="text-xs text-slate-400">
              Computed ratio of supported statements grounded in the uploaded document.
            </p>
          </div>
          <div className="w-full sm:w-64 h-2.5 bg-black/40 rounded-full overflow-hidden flex border border-white/5">
            <div className="h-full bg-emerald-400" style={{ width: `${liveSession.overall_score}%` }} />
            <div className="h-full bg-rose-500" style={{ width: `${totalClaims > 0 ? Math.round((contradictedCount / totalClaims) * 100) : 0}%` }} />
            <div className="h-full bg-amber-400" style={{ width: `${totalClaims > 0 ? Math.round((unverifiableCount / totalClaims) * 100) : 0}%` }} />
          </div>
        </div>

        {/* Claim-by-Claim Section */}
        {totalClaims > 0 ? (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
              <div>
                <h2 className="text-sm font-bold text-white uppercase tracking-wider">Claim-by-Claim Verification Graph</h2>
                <p className="text-xs text-slate-400">Select any claim to view natural language inference scores and evidence coordinates</p>
              </div>

              <div className="flex items-center gap-1 bg-black/40 p-1 rounded-xl border border-white/10 text-xs">
                {(["ALL", "CONTRADICTED", "SUPPORTED", "UNVERIFIABLE"] as const).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setActiveFilter(filter)}
                    className={`px-2.5 py-1 rounded-lg font-semibold transition-all text-[11px] ${
                      activeFilter === filter
                        ? "bg-amber-400 text-neutral-950 shadow"
                        : "text-slate-400 hover:text-white hover:bg-white/5"
                    }`}
                  >
                    {filter === "ALL" ? `All (${totalClaims})` : filter === "CONTRADICTED" ? `Contradicted (${contradictedCount})` : filter === "SUPPORTED" ? `Supported (${supportedCount})` : `Unverified (${unverifiableCount})`}
                  </button>
                ))}
              </div>
            </div>

            <motion.div variants={{ hidden: {}, show: { transition: { staggerChildren: 0.05 } } }} initial="hidden" animate="show" className="space-y-3">
              {filteredClaims.map((c, i) => {
                const meta = verdictMeta(c.status)
                return (
                  <Link key={c.id} to={`/verify/results/${liveSession.id}/claim/${c.id}`} className="block group">
                    <motion.div variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } }} whileHover={{ y: -2 }} whileTap={{ scale: 0.99 }} transition={{ duration: 0.15 }}>
                      <div className={`glass-card rounded-2xl p-4 border transition-all ${meta.bg}`}>
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="text-xs font-mono font-bold text-slate-400 shrink-0">{String(i + 1).padStart(2, "0")}</span>
                            <meta.icon className={`h-4 w-4 shrink-0 ${meta.text}`} />
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-white truncate group-hover:text-amber-200 transition-colors">
                                {c.claim_text}
                              </p>
                              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                {c.evidence && c.evidence.page_number > 0 && (
                                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-white/10 bg-white/5 text-slate-300">
                                    Page {c.evidence.page_number}
                                  </span>
                                )}
                                {c.evidence?.retrieval_method && (
                                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-indigo-400/30 text-indigo-300 bg-indigo-500/10">
                                    {c.evidence.retrieval_method === "hybrid" ? "Hybrid RAG" : c.evidence.retrieval_method}
                                  </span>
                                )}
                                {c.hallucination_type && c.hallucination_type !== "NONE" && (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded border border-rose-400/30 text-rose-300 bg-rose-500/10">
                                    <ShieldAlert className="h-2.5 w-2.5" />
                                    {c.hallucination_type.replace(/_/g, " ")}
                                  </span>
                                )}
                                {c.numerical_finding && c.numerical_finding.comparison_outcome !== "NO_CALCULATION" && (
                                  <span
                                    className={`inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded border ${
                                      c.numerical_finding.comparison_outcome === "VALIDATED"
                                        ? "text-emerald-300 border-emerald-400/30 bg-emerald-500/10"
                                        : "text-rose-300 border-rose-400/30 bg-rose-500/10"
                                    }`}
                                  >
                                    <Calculator className="h-2.5 w-2.5" />
                                    Figure check: {figureCheckLabel(c.numerical_finding.comparison_outcome)}
                                  </span>
                                )}
                                {c.temporal_anchor && c.temporal_anchor.period_match !== "UNSPECIFIED" && (
                                  <span
                                    className={`inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded border ${
                                      c.temporal_anchor.period_match === "ALIGNED"
                                        ? "text-emerald-300 border-emerald-400/30 bg-emerald-500/10"
                                        : c.temporal_anchor.period_match === "MISALIGNED"
                                        ? "text-rose-300 border-rose-400/30 bg-rose-500/10"
                                        : "text-amber-300 border-amber-400/30 bg-amber-500/10"
                                    }`}
                                  >
                                    <Calendar className="h-2.5 w-2.5" />
                                    {c.temporal_anchor.period_match}
                                  </span>
                                )}
                                {c.multi_hop_finding && (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded border border-cyan-400/30 text-cyan-300 bg-cyan-500/10">
                                    <Layers className="h-2.5 w-2.5" />
                                    Multi-Hop
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 shrink-0">
                            <span className={`text-xs font-bold uppercase tracking-wider font-mono ${meta.text}`}>{meta.label}</span>
                            <ChevronRight className="h-4 w-4 text-slate-400 group-hover:translate-x-1 transition-transform" />
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  </Link>
                )
              })}
            </motion.div>
          </div>
        ) : (
          <div className="glass-card rounded-2xl p-8 text-center space-y-2 border border-white/10">
            <p className="text-sm text-slate-300 font-semibold">No discrete financial claims identified</p>
            <p className="text-xs text-slate-400">The provided text did not yield extractable factual claims.</p>
          </div>
        )}

        <div className="flex justify-end gap-3 pt-4">
          <Link to="/verify">
            <Button variant="outline" className="border-white/15 hover:bg-white/10">Upload Another Document</Button>
          </Link>
        </div>
      </motion.div>
    )
  }

  // 4. Session not found
  return (
    <div className="max-w-2xl mx-auto text-center py-20 space-y-4">
      <div className="h-12 w-12 rounded-2xl bg-rose-500/10 border border-rose-400/20 flex items-center justify-center mx-auto text-rose-400">
        <AlertTriangle className="h-6 w-6" />
      </div>
      <h1 className="text-xl font-bold text-white mb-2">Verification Session Not Found</h1>
      <p className="text-sm text-slate-400 mb-6 max-w-md mx-auto">
        {loadError || `Session "${id}" does not exist in MongoDB Atlas or demo datasets.`}
      </p>
      <Link to="/verify"><Button>Start a New Verification</Button></Link>
    </div>
  )
}

