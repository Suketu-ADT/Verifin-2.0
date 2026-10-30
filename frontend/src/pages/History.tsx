import { motion } from "framer-motion"
import { useState, useMemo } from "react"
import { Link } from "react-router-dom"
import { Badge } from "../components/ui/badge"
import { Button } from "../components/ui/button"
import { 
  FileText, 
  ChevronRight, 
  Search, 
  ShieldCheck, 
  AlertTriangle, 
  CheckCircle2, 
  ArrowRight,
  History as HistoryIcon,
  Calendar,
  Filter
} from "lucide-react"
import { demoSessions, claimCounts } from "../lib/demoData"

type Filter = "all" | "clean" | "flagged"

export default function History() {
  const [filter, setFilter] = useState<Filter>("all")
  const [search, setSearch] = useState("")

  const totalSessions = demoSessions.length
  const flaggedCount = demoSessions.filter((s) => claimCounts(s.claims).contradicted > 0).length
  const cleanCount = totalSessions - flaggedCount
  const totalClaims = demoSessions.reduce((acc, s) => acc + s.claims.length, 0)
  const cleanRate = totalSessions > 0 ? Math.round((cleanCount / totalSessions) * 100) : 100

  const rows = useMemo(() => {
    return demoSessions.filter((s) => {
      const matchesSearch = 
        s.title.toLowerCase().includes(search.toLowerCase()) ||
        s.document.toLowerCase().includes(search.toLowerCase())
      
      if (!matchesSearch) return false

      const c = claimCounts(s.claims)
      if (filter === "flagged") return c.contradicted > 0
      if (filter === "clean") return c.contradicted === 0
      return true
    })
  }, [filter, search])

  return (
    <motion.div 
      initial="hidden" 
      animate="show" 
      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.08 } } }} 
      className="max-w-6xl mx-auto space-y-6"
    >
      {/* Header & Breadcrumbs */}
      <motion.div variants={{ hidden: { opacity: 0, y: 15 }, show: { opacity: 1, y: 0 } }} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
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
            Historical Audit Vault
          </h1>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            Chronological ledger of past SEC document verification sessions, claims decomposed, and cross-encoder NLI verdicts.
          </p>
        </div>

        <Badge variant="outline" className="text-amber-300 border-amber-400/30 bg-amber-500/10 text-xs px-3 py-1 font-mono self-start sm:self-auto">
          Demo Audit Vault Active
        </Badge>
      </motion.div>

      {/* Historical Telemetry KPI Cards */}
      <motion.div variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }} className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <div className="glass-card p-4 space-y-1 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-indigo-500" />
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">Total Verification Runs</div>
          <div className="text-2xl font-bold font-mono text-white">{totalSessions} <span className="text-xs font-normal text-slate-500">filings</span></div>
          <div className="text-[11px] text-slate-400 flex items-center gap-1">
            <FileText className="h-3 w-3 text-indigo-400" /> {totalClaims} individual claims evaluated
          </div>
        </div>

        <div className="glass-card p-4 space-y-1 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-emerald-500" />
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">Clean Filing Pass Rate</div>
          <div className="text-2xl font-bold font-mono text-emerald-300">{cleanRate}%</div>
          <div className="text-[11px] text-slate-400 flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3 text-emerald-400" /> {cleanCount} filings with 0 contradictions
          </div>
        </div>

        <div className="glass-card p-4 space-y-1 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-rose-500" />
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">Contradictions Intercepted</div>
          <div className="text-2xl font-bold font-mono text-rose-300">{flaggedCount} <span className="text-xs font-normal text-slate-500">sessions flagged</span></div>
          <div className="text-[11px] text-slate-400 flex items-center gap-1">
            <AlertTriangle className="h-3 w-3 text-rose-400" /> High-risk discrepancies caught
          </div>
        </div>
      </motion.div>

      {/* Search and Filters */}
      <motion.div variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }} className="flex flex-col sm:flex-row items-center justify-between gap-3 glass-card p-2.5">
        <div className="flex items-center gap-1 w-full sm:w-auto">
          {(["all", "flagged", "clean"] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg capitalize transition-all ${
                filter === f
                  ? "bg-amber-500/15 text-amber-300 border border-amber-400/30 shadow-sm"
                  : "text-slate-400 hover:text-white hover:bg-white/5 border border-transparent"
              }`}
            >
              {f === "all" ? `All Sessions (${totalSessions})` : f === "flagged" ? `Flagged (${flaggedCount})` : `Clean (${cleanCount})`}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search filings or documents..."
            className="h-8 w-full rounded-lg border border-white/10 bg-black/30 pl-8 pr-3 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-400"
          />
        </div>
      </motion.div>

      {/* Session Ledger Table */}
      <motion.div variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }} className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-white/10 bg-white/[0.02] text-[10px] font-mono uppercase tracking-wider text-slate-400">
                <th className="py-3 px-4 font-semibold">Verification Audit Session</th>
                <th className="py-3 px-4 font-semibold">Source Document</th>
                <th className="py-3 px-4 font-semibold text-center">Decomposed Claims (S / C / U)</th>
                <th className="py-3 px-4 font-semibold">Execution Date</th>
                <th className="py-3 px-4 font-semibold text-right">Audit Dossier</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-500">
                    No verification sessions match this filter criteria.
                  </td>
                </tr>
              ) : (
                rows.map((s) => {
                  const c = claimCounts(s.claims)
                  const total = s.claims.length
                  const supportedPct = total > 0 ? (c.supported / total) * 100 : 0
                  const contradictedPct = total > 0 ? (c.contradicted / total) * 100 : 0
                  const unverifiablePct = total > 0 ? (c.unverifiable / total) * 100 : 0

                  return (
                    <tr key={s.id} className="hover:bg-white/[0.03] transition-colors group">
                      <td className="py-4 px-4">
                        <div className="font-bold text-white text-sm group-hover:text-amber-300 transition-colors">
                          {s.title}
                        </div>
                        <div className="text-[10px] font-mono text-slate-500 mt-0.5">
                          ID: {s.id}
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-1.5 text-slate-300 font-mono">
                          <FileText className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                          <span className="truncate max-w-[200px]">{s.document}</span>
                        </div>
                      </td>
                      <td className="py-4 px-4 text-center">
                        <div className="flex items-center justify-center gap-1 font-mono text-xs mb-1.5">
                          <span className="text-emerald-300 font-bold bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20" title="Supported">
                            {c.supported} S
                          </span>
                          <span className="text-rose-300 font-bold bg-rose-500/10 px-1.5 py-0.5 rounded border border-rose-500/20" title="Contradicted">
                            {c.contradicted} C
                          </span>
                          <span className="text-amber-300 font-bold bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20" title="Unverifiable">
                            {c.unverifiable} U
                          </span>
                        </div>

                        {/* Proportional Mini Bar */}
                        <div className="h-1.5 w-32 mx-auto bg-black/40 rounded-full overflow-hidden flex">
                          <div style={{ width: `${supportedPct}%` }} className="h-full bg-emerald-500" />
                          <div style={{ width: `${contradictedPct}%` }} className="h-full bg-rose-500" />
                          <div style={{ width: `${unverifiablePct}%` }} className="h-full bg-amber-400" />
                        </div>
                      </td>
                      <td className="py-4 px-4 font-mono text-slate-400">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="h-3 w-3 text-slate-500" />
                          {new Date(s.ran_at).toLocaleString(undefined, { 
                            month: "short", 
                            day: "numeric", 
                            hour: "2-digit", 
                            minute: "2-digit" 
                          })}
                        </div>
                      </td>
                      <td className="py-4 px-4 text-right">
                        <Link to={`/verify/results/${s.id}`}>
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="text-xs border-white/10 hover:border-amber-400/40 hover:bg-amber-500/10 text-white hover:text-amber-300 transition-all font-semibold"
                          >
                            Inspect Dossier <ArrowRight className="h-3 w-3 ml-1" />
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </motion.div>
    </motion.div>
  )
}
