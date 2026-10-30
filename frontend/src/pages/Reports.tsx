import { motion } from "framer-motion"
import { useState } from "react"
import { Button } from "../components/ui/button"
import { Badge } from "../components/ui/badge"
import {
  Download, CheckCircle2, AlertTriangle, HelpCircle, FileText,
  Printer, FileSpreadsheet, ShieldAlert, Sparkles, Check
} from "lucide-react"
import { demoSessions, claimCounts, type NLILabel } from "../lib/demoData"

const verdictBadge = (label: NLILabel | undefined) => {
  if (label === "SUPPORTED")
    return <Badge className="bg-emerald-500/10 text-emerald-300 border border-emerald-400/30 rounded gap-1 font-mono text-[10px]"><CheckCircle2 className="h-3 w-3" /> Supported</Badge>
  if (label === "CONTRADICTED")
    return <Badge className="bg-rose-500/10 text-rose-300 border border-rose-400/30 rounded gap-1 font-mono text-[10px]"><AlertTriangle className="h-3 w-3" /> Contradicted</Badge>
  return <Badge className="bg-amber-500/10 text-amber-300 border border-amber-400/30 rounded gap-1 font-mono text-[10px]"><HelpCircle className="h-3 w-3" /> Unverifiable</Badge>
}

export default function Reports() {
  const [sessionId, setSessionId] = useState(demoSessions[0].id)
  const [copiedNotification, setCopiedNotification] = useState(false)
  const session = demoSessions.find((s) => s.id === sessionId)!
  const counts = claimCounts(session.claims)
  const supportRate = Math.round((counts.supported / counts.total) * 100)

  // Export JSON function
  const handleExportJson = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(session, null, 2))
    const downloadAnchor = document.createElement("a")
    downloadAnchor.setAttribute("href", dataStr)
    downloadAnchor.setAttribute("download", `verifin_report_${session.id}.json`)
    document.body.appendChild(downloadAnchor)
    downloadAnchor.click()
    downloadAnchor.remove()
  }

  // Export CSV function
  const handleExportCsv = () => {
    const headers = ["Index", "Claim Text", "Claim Type", "Verdict", "Confidence", "Evidence Page", "Hallucination Type"]
    const rows = session.claims.map((c, idx) => [
      idx + 1,
      `"${c.claim_text.replace(/"/g, '""')}"`,
      c.claim_type,
      c.nli?.label || "UNVERIFIABLE",
      `${Math.round(c.confidence * 100)}%`,
      c.evidence?.page_number || 0,
      c.hallucination_type || "NONE",
    ])
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(r => r.join(","))].join("\n")
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement("a")
    link.setAttribute("href", encodedUri)
    link.setAttribute("download", `verifin_audit_${session.id}.csv`)
    document.body.appendChild(link)
    link.click()
    link.remove()
  }

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: "easeOut" }} className="max-w-5xl mx-auto space-y-6">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">VERIFIN 2.0</span>
            <span className="text-slate-500">/</span>
            <span className="text-[10px] font-bold text-amber-300 uppercase tracking-widest">Executive Audit</span>
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-white">Verification Reports & Compliance</h1>
          <p className="text-xs text-slate-400 mt-1">Exportable, claim-by-claim audit trails with mathematical verification.</p>
        </div>

        {/* Action Export Buttons */}
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExportCsv} className="h-9 text-xs border-white/10 hover:bg-white/10 gap-1.5 font-mono">
            <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-400" /> Export CSV
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportJson} className="h-9 text-xs border-white/10 hover:bg-white/10 gap-1.5 font-mono">
            <Download className="h-3.5 w-3.5 text-indigo-400" /> Export JSON
          </Button>
          <Button size="sm" onClick={() => window.print()} className="h-9 text-xs font-bold gap-1.5 bg-white/10 hover:bg-white/15 text-white border border-white/10">
            <Printer className="h-3.5 w-3.5" /> Print Audit Sheet
          </Button>
        </div>
      </div>

      {/* Session selector pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {demoSessions.map((s) => (
          <button
            key={s.id}
            onClick={() => setSessionId(s.id)}
            className={`text-xs font-semibold px-3.5 py-2 rounded-xl border transition-all shrink-0 ${
              s.id === sessionId
                ? "bg-amber-400 text-neutral-950 border-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.3)] font-bold"
                : "border-white/10 text-slate-400 hover:bg-white/5 hover:text-white"
            }`}
          >
            {s.title}
          </button>
        ))}
      </div>

      {/* Executive overview card */}
      <div className="glass-card rounded-2xl p-6 border border-white/10 grid grid-cols-1 md:grid-cols-3 gap-6">
        <div>
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Source Filing</div>
          <div className="text-sm font-bold text-white flex items-center gap-2">
            <FileText className="h-4 w-4 text-amber-400" />
            {session.document}
          </div>
          <div className="text-[11px] font-mono text-slate-400 mt-1">Audit Session: {session.id}</div>
        </div>

        <div>
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Factual Support Rate</div>
          <div className="text-2xl font-bold font-mono text-emerald-400">{supportRate}%</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Based on DeBERTa-v3 cross-encoder NLI</div>
        </div>

        <div>
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Retrieval Engine</div>
          <div className="text-xs font-mono text-indigo-300 font-bold bg-indigo-500/10 border border-indigo-400/30 px-2 py-1 rounded inline-block">
            BM25 Hybrid RAG (RRF Fused)
          </div>
          <div className="text-[11px] text-slate-400 mt-1">k1=1.5, b=0.75, α=0.50</div>
        </div>

        <div className="md:col-span-3 pt-3 border-t border-white/8 space-y-1.5">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            LLM-Generated Synthesis Evaluated
          </div>
          <p className="text-xs text-slate-200 leading-relaxed font-serif italic bg-black/30 p-3 rounded-xl border border-white/5">
            "{session.llm_output}"
          </p>
        </div>
      </div>

      {/* 3 Metric counters */}
      <div className="grid grid-cols-3 gap-4">
        <div className="glass-card rounded-2xl p-4 text-center border border-emerald-400/30">
          <div className="text-3xl font-bold font-mono text-emerald-400">{counts.supported}</div>
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Supported Facts</div>
        </div>
        <div className="glass-card rounded-2xl p-4 text-center border border-rose-400/30">
          <div className="text-3xl font-bold font-mono text-rose-400">{counts.contradicted}</div>
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Hallucinations</div>
        </div>
        <div className="glass-card rounded-2xl p-4 text-center border border-amber-400/30">
          <div className="text-3xl font-bold font-mono text-amber-400">{counts.unverifiable}</div>
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Unverifiable</div>
        </div>
      </div>

      {/* Granular audit table */}
      <div className="glass-card rounded-2xl border border-white/10 overflow-hidden">
        <div className="px-5 py-3 border-b border-white/8 bg-black/20 flex items-center justify-between">
          <span className="text-xs font-bold text-white uppercase tracking-wider">Granular Claim Verification Ledger</span>
          <span className="text-xs font-mono text-slate-400">{session.claims.length} claims</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-white/[0.03] text-slate-400 uppercase font-mono text-[10px] border-b border-white/8">
              <tr>
                <th className="py-3 px-4 w-12">#</th>
                <th className="py-3 px-4">Claim Statement</th>
                <th className="py-3 px-4">Grounding Source</th>
                <th className="py-3 px-4 text-center">Confidence</th>
                <th className="py-3 px-4 text-right">Verdict</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {session.claims.map((c, i) => (
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
                      <span className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-indigo-300">
                        Page {c.evidence.page_number}
                      </span>
                    ) : (
                      <span className="text-slate-500 italic">No passage</span>
                    )}
                  </td>
                  <td className="py-3.5 px-4 font-mono text-center font-bold text-white">
                    {Math.round(c.confidence * 100)}%
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    {verdictBadge(c.nli?.label)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-[11px] text-slate-400 text-center font-mono">
        Audit log generated by VERIFIN 2.0 Engine • Cryptographically verified session {session.id}
      </p>
    </motion.div>
  )
}

