import { motion } from "framer-motion"
import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Button } from "../components/ui/button"
import { Badge } from "../components/ui/badge"
import EmptyState from "../components/shared/EmptyState"
import {
  CheckCircle2, AlertTriangle, HelpCircle, FileText,
  Printer, FileSpreadsheet, FileDown, ShieldAlert, Loader2,
} from "lucide-react"
import { downloadReport, errorMessage, getVerificationResults, type VerificationResultResponse } from "../lib/api"
import { totalClaims, useHistory } from "../lib/useHistory"

const verdictBadge = (status: string) => {
  const norm = status.toUpperCase()
  if (norm === "SUPPORTED")
    return <Badge className="bg-emerald-500/10 text-emerald-300 border border-emerald-400/30 rounded gap-1 font-mono text-[10px]"><CheckCircle2 className="h-3 w-3" /> Supported</Badge>
  if (norm === "CONTRADICTED")
    return <Badge className="bg-rose-500/10 text-rose-300 border border-rose-400/30 rounded gap-1 font-mono text-[10px]"><AlertTriangle className="h-3 w-3" /> Contradicted</Badge>
  return <Badge className="bg-amber-500/10 text-amber-300 border border-amber-400/30 rounded gap-1 font-mono text-[10px]"><HelpCircle className="h-3 w-3" /> Unverified</Badge>
}

export default function Reports() {
  const navigate = useNavigate()
  const { sessions, loading: listLoading, error: listError } = useHistory(100)
  const finished = sessions.filter((s) => s.status === "completed")

  const [sessionId, setSessionId] = useState<string | null>(null)
  const [result, setResult] = useState<VerificationResultResponse | null>(null)
  const [resultLoading, setResultLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [downloading, setDownloading] = useState<"pdf" | "csv" | null>(null)

  const selectedId = sessionId ?? finished[0]?.id ?? null
  const summary = finished.find((s) => s.id === selectedId)

  useEffect(() => {
    if (!selectedId) return
    let cancelled = false
    setResultLoading(true)
    setError(null)
    getVerificationResults(selectedId)
      .then((r) => { if (!cancelled) setResult(r) })
      .catch((err) => { if (!cancelled) { setResult(null); setError(errorMessage(err, "Could not load this report.")) } })
      .finally(() => { if (!cancelled) setResultLoading(false) })
    return () => { cancelled = true }
  }, [selectedId])

  const download = async (format: "pdf" | "csv") => {
    if (!selectedId) return
    setDownloading(format)
    setError(null)
    try {
      await downloadReport(selectedId, format)
    } catch (err) {
      setError(errorMessage(err, "The download failed."))
    } finally {
      setDownloading(null)
    }
  }

  if (!listLoading && !listError && finished.length === 0) {
    return (
      <EmptyState
        title="No reports yet"
        message="Reports are generated from finished verifications. Run one and its PDF and CSV report will be available here."
        actionLabel="Start a verification"
        onAction={() => navigate("/verify")}
      />
    )
  }

  const claims = result?.claims ?? []
  const count = (v: string) => claims.filter((c) => c.status.toUpperCase() === v).length
  const supported = count("SUPPORTED")
  const contradicted = count("CONTRADICTED")
  const unverified = count("UNVERIFIED")
  const supportRate = claims.length > 0 ? Math.round((supported / claims.length) * 100) : 0

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: "easeOut" }} className="max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-white">Verification Reports</h1>
          <p className="text-xs text-slate-400 mt-1">Claim-by-claim reports with provenance, as PDF or CSV.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={!selectedId || downloading !== null} onClick={() => void download("pdf")} className="h-9 text-xs border-white/10 hover:bg-white/10 gap-1.5 font-mono">
            {downloading === "pdf" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileDown className="h-3.5 w-3.5 text-rose-400" />} Download PDF
          </Button>
          <Button variant="outline" size="sm" disabled={!selectedId || downloading !== null} onClick={() => void download("csv")} className="h-9 text-xs border-white/10 hover:bg-white/10 gap-1.5 font-mono">
            {downloading === "csv" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-400" />} Download CSV
          </Button>
          <Button size="sm" onClick={() => window.print()} className="h-9 text-xs font-bold gap-1.5 bg-white/10 hover:bg-white/15 text-white border border-white/10">
            <Printer className="h-3.5 w-3.5" /> Print
          </Button>
        </div>
      </div>

      {(error || listError) && (
        <div role="alert" className="glass-card p-4 text-sm text-rose-300 border border-rose-500/30">{error ?? listError}</div>
      )}

      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {finished.slice(0, 12).map((s) => (
          <button
            key={s.id}
            onClick={() => setSessionId(s.id)}
            aria-pressed={s.id === selectedId}
            title={s.statement_preview}
            className={`text-xs font-semibold px-3.5 py-2 rounded-xl border transition-all shrink-0 max-w-[16rem] truncate ${
              s.id === selectedId
                ? "bg-amber-400 text-neutral-950 border-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.3)] font-bold"
                : "border-white/10 text-slate-400 hover:bg-white/5 hover:text-white"
            }`}
          >
            {s.document_name ?? "(deleted)"} · {new Date(s.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
          </button>
        ))}
      </div>

      {summary && (
        <div className="glass-card rounded-2xl p-6 border border-white/10 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Source Filing</div>
            <div className="text-sm font-bold text-white flex items-center gap-2">
              <FileText className="h-4 w-4 text-amber-400 shrink-0" />
              <span className="truncate">{summary.document_name ?? "(deleted document)"}</span>
            </div>
            <div className="text-[11px] font-mono text-slate-400 mt-1">Verification: {summary.id}</div>
          </div>
          <div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Supported claims</div>
            <div className="text-2xl font-bold font-mono text-emerald-400">{supportRate}%</div>
            <div className="text-[11px] text-slate-400 mt-0.5">{supported} of {claims.length || totalClaims(summary)} claims</div>
          </div>
          <div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Risk level</div>
            <div className="text-2xl font-bold font-mono text-white">{summary.risk_level}</div>
            <div className="text-[11px] text-slate-400 mt-0.5">Score {summary.overall_score.toFixed(0)} / 100</div>
          </div>
          <div className="md:col-span-3 pt-3 border-t border-white/8 space-y-1.5">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">LLM output that was checked</div>
            <p className="text-xs text-slate-200 leading-relaxed font-serif italic bg-black/30 p-3 rounded-xl border border-white/5">"{summary.statement_preview}"</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-4">
        <div className="glass-card rounded-2xl p-4 text-center border border-emerald-400/30">
          <div className="text-3xl font-bold font-mono text-emerald-400">{supported}</div>
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Supported</div>
        </div>
        <div className="glass-card rounded-2xl p-4 text-center border border-rose-400/30">
          <div className="text-3xl font-bold font-mono text-rose-400">{contradicted}</div>
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Contradicted</div>
        </div>
        <div className="glass-card rounded-2xl p-4 text-center border border-amber-400/30">
          <div className="text-3xl font-bold font-mono text-amber-400">{unverified}</div>
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Unverified</div>
        </div>
      </div>

      <div className="glass-card rounded-2xl border border-white/10 overflow-hidden">
        <div className="px-5 py-3 border-b border-white/8 bg-black/20 flex items-center justify-between">
          <span className="text-xs font-bold text-white uppercase tracking-wider">Claim ledger</span>
          <span className="text-xs font-mono text-slate-400">{claims.length} claims</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-white/[0.03] text-slate-400 uppercase font-mono text-[10px] border-b border-white/8">
              <tr>
                <th className="py-3 px-4 w-12">#</th>
                <th className="py-3 px-4">Claim</th>
                <th className="py-3 px-4">Evidence</th>
                <th className="py-3 px-4 text-center">Confidence</th>
                <th className="py-3 px-4 text-right">Verdict</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {resultLoading ? (
                <tr><td colSpan={5} className="py-10 text-center text-slate-500"><Loader2 className="h-5 w-5 animate-spin inline" /></td></tr>
              ) : claims.length === 0 ? (
                <tr><td colSpan={5} className="py-10 text-center text-slate-500">This verification has no claims.</td></tr>
              ) : (
                claims.map((c, i) => (
                  <tr key={c.id} className="hover:bg-white/[0.04] transition-colors">
                    <td className="py-3.5 px-4 font-mono text-slate-400">{String(i + 1).padStart(2, "0")}</td>
                    <td className="py-3.5 px-4 font-semibold text-white max-w-md">
                      <p>{c.claim_text}</p>
                      {c.hallucination_type && c.hallucination_type !== "NONE" && (
                        <span className="inline-flex items-center gap-1 mt-1 text-[9px] font-mono px-1.5 py-0.5 rounded border border-rose-400/30 text-rose-300 bg-rose-500/10">
                          <ShieldAlert className="h-2.5 w-2.5" />
                          {c.hallucination_type.replace(/_/g, " ")}
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-[11px] text-slate-300">
                      {c.evidence && c.evidence.page_number > 0 ? (
                        <span className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-indigo-300">Page {c.evidence.page_number}</span>
                      ) : (
                        <span className="text-slate-500 italic">No passage</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-center font-bold text-white">{Math.round((c.confidence ?? 0) * 100)}%</td>
                    <td className="py-3.5 px-4 text-right">{verdictBadge(c.status)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </motion.div>
  )
}
