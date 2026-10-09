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
} from "lucide-react"
import { demoSessions, claimCounts, type NLILabel } from "../lib/demoData"
import {
  getVerificationResults,
  getDocument,
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
            .catch(() => {
              // Silently fallback to document_id if metadata not reachable
            })
        }
      })
      .catch((err) => {
        const detail = err?.response?.data?.detail || err?.message || `Session "${id}" was not found.`
        setLoadError(typeof detail === "string" ? detail : JSON.stringify(detail))
        setLoading(false)
      })
  }, [id, demoSession])

  // 1. Loading state for live query
  if (loading) {
    return (
      <div className="max-w-2xl mx-auto text-center py-24 space-y-4">
        <Loader2 className="h-8 w-8 text-amber-400 animate-spin mx-auto" />
        <h1 className="text-lg font-semibold text-white">Retrieving Verification Session...</h1>
        <p className="text-xs text-slate-400 font-mono">Querying MongoDB Atlas for session {id}</p>
      </div>
    )
  }

  // 2. Demo Session mode (canned dataset preserved)
  if (demoSession) {
    const counts = claimCounts(demoSession.claims)
    const overallScore = Math.round((counts.supported / counts.total) * 100)

    return (
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: "easeOut" }} className="space-y-6">
        <div>
          <Link to="/verify" className="inline-flex items-center text-xs font-semibold text-slate-400 hover:text-white mb-3">
            <ArrowLeft className="h-3.5 w-3.5 mr-1" /> New verification
          </Link>
          <div className="flex items-center gap-2 mb-1.5">
            <h1 className="text-2xl font-bold tracking-tight text-white">{demoSession.title}</h1>
            <Badge variant="outline" className="text-amber-300 border-amber-400/30 bg-amber-500/10">Demo Data</Badge>
          </div>
          <div className="flex items-center gap-1.5 text-sm text-slate-400">
            <FileText className="h-3.5 w-3.5" /> {demoSession.document}
          </div>
        </div>

        <div className="glass-subtle border border-white/10 rounded-lg p-5 space-y-3">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">LLM-generated answer under review</div>
          <p className="text-sm font-serif text-slate-200 leading-relaxed">{demoSession.llm_output}</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card><CardContent className="p-4">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Claims Checked</div>
            <div className="text-2xl font-bold text-white">{counts.total}</div>
          </CardContent></Card>
          <Card className="border-emerald-400/30"><CardContent className="p-4">
            <div className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest mb-1">Supported</div>
            <div className="text-2xl font-bold text-emerald-400">{counts.supported}</div>
          </CardContent></Card>
          <Card className="border-rose-400/30"><CardContent className="p-4">
            <div className="text-[10px] font-bold text-rose-400 uppercase tracking-widest mb-1">Contradicted</div>
            <div className="text-2xl font-bold text-rose-400">{counts.contradicted}</div>
          </CardContent></Card>
          <Card className="border-amber-400/30"><CardContent className="p-4">
            <div className="text-[10px] font-bold text-amber-400 uppercase tracking-widest mb-1">Unverifiable</div>
            <div className="text-2xl font-bold text-amber-400">{counts.unverifiable}</div>
          </CardContent></Card>
        </div>

        <div className="glass-subtle border border-white/10 rounded-lg p-4 flex items-center justify-between">
          <span className="text-sm font-semibold text-slate-300">Overall support rate</span>
          <span className="text-sm font-bold text-white">{overallScore}% of claims supported by the source document</span>
        </div>

        <motion.div variants={{ hidden: {}, show: { transition: { staggerChildren: 0.05 } } }} initial="hidden" animate="show" className="space-y-3">
          <h2 className="text-sm font-bold text-slate-500 uppercase tracking-widest">Claim-by-claim verification</h2>
          {demoSession.claims.map((c, i) => {
            const meta = verdictMeta(c.nli?.label)
            return (
              <Link key={c.id} to={`/verify/results/${demoSession.id}/claim/${c.id}`} className="block">
                <motion.div variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } }} whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }} transition={{ duration: 0.15 }}>
                  <Card className={`hover:bg-white/[0.04] transition-colors border ${meta.bg}`}>
                  <CardContent className="p-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-xs font-mono text-slate-400 shrink-0">{String(i + 1).padStart(2, "0")}</span>
                      <meta.icon className={`h-4 w-4 shrink-0 ${meta.text}`} />
                      <p className="text-sm font-medium text-white truncate">{c.claim_text}</p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className={`text-xs font-bold uppercase tracking-wide ${meta.text}`}>{meta.label}</span>
                      <ChevronRight className="h-4 w-4 text-slate-400" />
                    </div>
                  </CardContent>
                </Card>
                </motion.div>
              </Link>
            )
          })}
        </motion.div>
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

    return (
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: "easeOut" }} className="space-y-6">
        <div>
          <Link to="/verify" className="inline-flex items-center text-xs font-semibold text-slate-400 hover:text-white mb-3">
            <ArrowLeft className="h-3.5 w-3.5 mr-1" /> New verification
          </Link>
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <h1 className="text-2xl font-bold tracking-tight text-white">Live Verification Results</h1>
            <Badge variant="outline" className="text-emerald-400 border-emerald-400/30 bg-emerald-500/10">Live Verification</Badge>
            <Badge variant="outline" className="text-amber-300 border-amber-400/30 bg-amber-500/10 uppercase font-mono text-[10px]">
              {liveSession.status}
            </Badge>
            <Badge variant="outline" className="text-slate-300 border-white/20 bg-white/5 uppercase font-mono text-[10px]">
              Risk: {liveSession.risk_level}
            </Badge>
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-400 font-mono">
            <span className="flex items-center gap-1">
              <FileText className="h-3.5 w-3.5 text-slate-400" />
              {docDisplayName}
            </span>
            <span>·</span>
            <span>Session: {liveSession.id.slice(0, 8)}...</span>
          </div>
        </div>

        {/* Metric Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card><CardContent className="p-4">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Claims Checked</div>
            <div className="text-2xl font-bold text-white">{totalClaims}</div>
          </CardContent></Card>
          <Card className="border-emerald-400/30"><CardContent className="p-4">
            <div className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest mb-1">Supported</div>
            <div className="text-2xl font-bold text-emerald-400">{supportedCount}</div>
          </CardContent></Card>
          <Card className="border-rose-400/30"><CardContent className="p-4">
            <div className="text-[10px] font-bold text-rose-400 uppercase tracking-widest mb-1">Contradicted</div>
            <div className="text-2xl font-bold text-rose-400">{contradictedCount}</div>
          </CardContent></Card>
          <Card className="border-amber-400/30"><CardContent className="p-4">
            <div className="text-[10px] font-bold text-amber-400 uppercase tracking-widest mb-1">Unverifiable</div>
            <div className="text-2xl font-bold text-amber-400">{unverifiableCount}</div>
          </CardContent></Card>
        </div>

        {/* Overall Score Banner */}
        <div className="glass-subtle border border-white/10 rounded-lg p-4 flex items-center justify-between">
          <span className="text-sm font-semibold text-slate-300">Overall support rate</span>
          <span className="text-sm font-bold text-white">
            {liveSession.overall_score}% of claims supported by the source document
          </span>
        </div>

        {/* Claim-by-Claim Verification */}
        {totalClaims > 0 ? (
          <motion.div variants={{ hidden: {}, show: { transition: { staggerChildren: 0.05 } } }} initial="hidden" animate="show" className="space-y-3">
            <h2 className="text-sm font-bold text-slate-500 uppercase tracking-widest">Claim-by-claim verification</h2>
            {liveSession.claims.map((c, i) => {
              const meta = verdictMeta(c.status)
              return (
                <Link key={c.id} to={`/verify/results/${liveSession.id}/claim/${c.id}`} className="block">
                  <motion.div variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } }} whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }} transition={{ duration: 0.15 }}>
                    <Card className={`hover:bg-white/[0.04] transition-colors border ${meta.bg}`}>
                      <CardContent className="p-4 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="text-xs font-mono text-slate-400 shrink-0">{String(i + 1).padStart(2, "0")}</span>
                          <meta.icon className={`h-4 w-4 shrink-0 ${meta.text}`} />
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-white truncate">{c.claim_text}</p>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              {c.evidence && c.evidence.page_number > 0 && (
                                <span className="text-[11px] font-mono text-slate-400">
                                  Page {c.evidence.page_number}
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
                                  Math: {c.numerical_finding.comparison_outcome}
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
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className={`text-xs font-bold uppercase tracking-wide ${meta.text}`}>{meta.label}</span>
                          <ChevronRight className="h-4 w-4 text-slate-400" />
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                </Link>
              )
            })}
          </motion.div>
        ) : (
          <Card className="border-white/10 bg-white/[0.02]">
            <CardContent className="p-8 text-center space-y-2">
              <p className="text-sm text-slate-300 font-medium">No discrete financial claims found</p>
              <p className="text-xs text-slate-500">The provided text did not yield extractable factual claims.</p>
            </CardContent>
          </Card>
        )}

        <div className="flex justify-end gap-3 pt-4">
          <Link to="/verify">
            <Button variant="outline">Upload Another Document</Button>
          </Link>
        </div>
      </motion.div>
    )
  }

  // 4. Session not found
  return (
    <div className="max-w-2xl mx-auto text-center py-20">
      <h1 className="text-xl font-bold text-white mb-2">Verification not found</h1>
      <p className="text-sm text-slate-400 mb-6">
        {loadError || `Session "${id}" does not exist in MongoDB Atlas or demo datasets.`}
      </p>
      <Link to="/verify"><Button>Start a new verification</Button></Link>
    </div>
  )
}
