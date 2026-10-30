import { motion } from "framer-motion"
import { useState, useMemo } from "react"
import { Link, useNavigate } from "react-router-dom"
import { Button } from "../components/ui/button"
import EmptyState from "../components/shared/EmptyState"
import {
  FileText,
  ChevronRight,
  Search,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  History as HistoryIcon,
  Calendar,
  Loader2,
} from "lucide-react"
import { countOf, isClean, totalClaims, useHistory } from "../lib/useHistory"

type Filter = "all" | "clean" | "flagged"

const fade = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }

export default function History() {
  const navigate = useNavigate()
  const { sessions, loading, error, reload } = useHistory(100)
  const [filter, setFilter] = useState<Filter>("all")
  const [search, setSearch] = useState("")

  const finished = sessions.filter((s) => s.status === "completed")
  const cleanCount = finished.filter(isClean).length
  const flaggedCount = finished.length - cleanCount
  const claims = finished.reduce((acc, s) => acc + totalClaims(s), 0)
  const cleanRate = finished.length > 0 ? Math.round((cleanCount / finished.length) * 100) : null

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return sessions.filter((s) => {
      if (q && !(s.document_name ?? "").toLowerCase().includes(q) && !s.statement_preview.toLowerCase().includes(q)) return false
      if (filter === "flagged") return s.status === "completed" && !isClean(s)
      if (filter === "clean") return isClean(s)
      return true
    })
  }, [sessions, filter, search])

  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.08 } } }}
      className="max-w-6xl mx-auto space-y-6"
    >
      <motion.div variants={fade} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5 font-mono">
            <span>VERIFIN</span>
            <ChevronRight className="h-3 w-3 text-slate-600" />
            <span className="text-amber-400">Audits & Logs</span>
            <ChevronRight className="h-3 w-3 text-slate-600" />
            <span className="text-slate-300">Verification History</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center glow-amber">
              <HistoryIcon className="h-4.5 w-4.5 text-amber-400" />
            </div>
            Verification History
          </h1>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            Your organisation's most recent verifications (up to 100), newest first.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void reload()} disabled={loading} className="self-start sm:self-auto">
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Refresh"}
        </Button>
      </motion.div>

      {error && (
        <div role="alert" className="glass-card p-4 text-sm text-rose-300 border border-rose-500/30">
          {error}
        </div>
      )}

      {!error && !loading && sessions.length === 0 ? (
        <EmptyState
          title="No verifications yet"
          message="Upload a financial report and check an LLM answer against it. Every run will be listed here."
          actionLabel="Start a verification"
          onAction={() => navigate("/verify")}
        />
      ) : (
        <>
          <motion.div variants={fade} className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div className="glass-card p-4 space-y-1 relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-indigo-500" />
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">Verification runs</div>
              <div className="text-2xl font-bold font-mono text-white">{sessions.length}</div>
              <div className="text-[11px] text-slate-400 flex items-center gap-1">
                <FileText className="h-3 w-3 text-indigo-400" /> {claims} claims evaluated in finished runs
              </div>
            </div>
            <div className="glass-card p-4 space-y-1 relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-emerald-500" />
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">Clean runs</div>
              <div className="text-2xl font-bold font-mono text-emerald-300">{cleanRate === null ? "–" : `${cleanRate}%`}</div>
              <div className="text-[11px] text-slate-400 flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3 text-emerald-400" /> {cleanCount} with no contradiction and not high risk
              </div>
            </div>
            <div className="glass-card p-4 space-y-1 relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-rose-500" />
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">Flagged runs</div>
              <div className="text-2xl font-bold font-mono text-rose-300">{flaggedCount}</div>
              <div className="text-[11px] text-slate-400 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3 text-rose-400" /> contradicted or high-risk claims found
              </div>
            </div>
          </motion.div>

          <motion.div variants={fade} className="flex flex-col sm:flex-row items-center justify-between gap-3 glass-card p-2.5">
            <div className="flex items-center gap-1 w-full sm:w-auto">
              {(["all", "flagged", "clean"] as Filter[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  aria-pressed={filter === f}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg capitalize transition-all ${
                    filter === f
                      ? "bg-amber-500/15 text-amber-300 border border-amber-400/30 shadow-sm"
                      : "text-slate-400 hover:text-white hover:bg-white/5 border border-transparent"
                  }`}
                >
                  {f === "all" ? `All (${sessions.length})` : f === "flagged" ? `Flagged (${flaggedCount})` : `Clean (${cleanCount})`}
                </button>
              ))}
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search documents or statements..."
                aria-label="Search verifications"
                className="h-8 w-full rounded-lg border border-white/10 bg-black/30 pl-8 pr-3 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-400"
              />
            </div>
          </motion.div>

          <motion.div variants={fade} className="glass-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-white/10 bg-white/[0.02] text-[10px] font-mono uppercase tracking-wider text-slate-400">
                    <th className="py-3 px-4 font-semibold">Statement checked</th>
                    <th className="py-3 px-4 font-semibold">Document</th>
                    <th className="py-3 px-4 font-semibold text-center">Claims (S / C / U)</th>
                    <th className="py-3 px-4 font-semibold">Run at</th>
                    <th className="py-3 px-4 font-semibold text-right">Report</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {loading && sessions.length === 0 ? (
                    <tr><td colSpan={5} className="py-12 text-center text-slate-500"><Loader2 className="h-5 w-5 animate-spin inline" /></td></tr>
                  ) : rows.length === 0 ? (
                    <tr><td colSpan={5} className="py-12 text-center text-slate-500">No verification matches this filter.</td></tr>
                  ) : (
                    rows.map((s) => {
                      const sup = countOf(s, "SUPPORTED")
                      const con = countOf(s, "CONTRADICTED")
                      const unv = countOf(s, "UNVERIFIED")
                      const total = sup + con + unv
                      const pct = (n: number) => (total > 0 ? (n / total) * 100 : 0)
                      const done = s.status === "completed"
                      return (
                        <tr key={s.id} className="hover:bg-white/[0.03] transition-colors">
                          <td className="py-4 px-4 max-w-sm">
                            <div className="text-sm text-white line-clamp-2">{s.statement_preview}</div>
                            <div className="text-[10px] font-mono text-slate-500 mt-0.5">ID: {s.id.slice(0, 8)}</div>
                          </td>
                          <td className="py-4 px-4">
                            <div className="flex items-center gap-1.5 text-slate-300 font-mono">
                              <FileText className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                              <span className="truncate max-w-[200px]">{s.document_name ?? "(deleted)"}</span>
                            </div>
                          </td>
                          <td className="py-4 px-4 text-center">
                            {done && total > 0 ? (
                              <>
                                <div className="flex items-center justify-center gap-1 font-mono text-xs mb-1.5">
                                  <span className="text-emerald-300 font-bold bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20" title="Supported">{sup} S</span>
                                  <span className="text-rose-300 font-bold bg-rose-500/10 px-1.5 py-0.5 rounded border border-rose-500/20" title="Contradicted">{con} C</span>
                                  <span className="text-amber-300 font-bold bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20" title="Unverified">{unv} U</span>
                                </div>
                                <div className="h-1.5 w-32 mx-auto bg-black/40 rounded-full overflow-hidden flex">
                                  <div style={{ width: `${pct(sup)}%` }} className="h-full bg-emerald-500" />
                                  <div style={{ width: `${pct(con)}%` }} className="h-full bg-rose-500" />
                                  <div style={{ width: `${pct(unv)}%` }} className="h-full bg-amber-400" />
                                </div>
                              </>
                            ) : (
                              <span className={`font-mono capitalize ${s.status === "failed" ? "text-rose-300" : "text-slate-400"}`}>{done ? "–" : s.status}</span>
                            )}
                          </td>
                          <td className="py-4 px-4 font-mono text-slate-400">
                            <div className="flex items-center gap-1.5">
                              <Calendar className="h-3 w-3 text-slate-500" />
                              {new Date(s.created_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                            </div>
                          </td>
                          <td className="py-4 px-4 text-right">
                            {done ? (
                              <Link to={`/verify/results/${s.id}`}>
                                <Button size="sm" variant="outline" className="text-xs border-white/10 hover:border-amber-400/40 hover:bg-amber-500/10 text-white hover:text-amber-300 font-semibold">
                                  Open <ArrowRight className="h-3 w-3 ml-1" />
                                </Button>
                              </Link>
                            ) : (
                              <span className="text-slate-500">not available</span>
                            )}
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </motion.div>
        </>
      )}
    </motion.div>
  )
}
