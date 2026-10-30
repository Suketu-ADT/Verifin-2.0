import { motion } from "framer-motion"
import { Link, useNavigate } from "react-router-dom"
import { useEffect, useMemo, useState } from "react"
import { Button } from "../components/ui/button"
import { Badge } from "../components/ui/badge"
import EmptyState from "../components/shared/EmptyState"
import {
  FileText, CheckCircle2, AlertTriangle, HelpCircle, Plus,
  ShieldAlert, Calculator, ArrowUpRight, Cpu, Search, ChevronRight, ShieldCheck, Loader2,
} from "lucide-react"
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts"
import { getVerificationResults, type ClaimResponse } from "../lib/api"
import { countOf, totalClaims, useHistory } from "../lib/useHistory"

type Verdict = "SUPPORTED" | "CONTRADICTED" | "UNVERIFIED"
type ClaimFilter = "ALL" | Verdict

const pct = (n: number, total: number) => (total > 0 ? Math.round((n / total) * 100) : 0)

const verdictBadge = (status: string) => {
  const norm = status.toUpperCase()
  if (norm === "SUPPORTED")
    return <Badge className="bg-emerald-500/10 text-emerald-300 border border-emerald-400/30 rounded gap-1 font-mono text-[10px]"><CheckCircle2 className="h-3 w-3" /> Supported</Badge>
  if (norm === "CONTRADICTED")
    return <Badge className="bg-rose-500/10 text-rose-300 border border-rose-400/30 rounded gap-1 font-mono text-[10px]"><AlertTriangle className="h-3 w-3" /> Contradicted</Badge>
  return <Badge className="bg-amber-500/10 text-amber-300 border border-amber-400/30 rounded gap-1 font-mono text-[10px]"><HelpCircle className="h-3 w-3" /> Unverified</Badge>
}

interface TooltipPayload { name: string; value: number; color: string; percent: string }
const CustomChartTooltip = ({ active, payload }: { active?: boolean; payload?: { payload: TooltipPayload }[] }) => {
  if (!active || !payload?.length) return null
  const data = payload[0].payload
  return (
    <div className="glass-strong p-2.5 rounded-xl border border-white/15 text-xs shadow-xl">
      <div className="flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: data.color }} />
        <span className="font-bold text-white">{data.name}</span>
      </div>
      <div className="mt-1 font-mono text-slate-300">
        <span className="text-white font-bold">{data.value}</span> claims ({data.percent})
      </div>
    </div>
  )
}

export default function Dashboard() {
  const navigate = useNavigate()
  const { sessions, loading, error } = useHistory(100)
  const [claimFilter, setClaimFilter] = useState<ClaimFilter>("ALL")
  const [searchQuery, setSearchQuery] = useState("")
  const [ledger, setLedger] = useState<{ sessionId: string; claims: ClaimResponse[] } | null>(null)
  const [ledgerLoading, setLedgerLoading] = useState(false)

  const finished = useMemo(() => sessions.filter((s) => s.status === "completed"), [sessions])
  const latest = finished[0]

  const counts = useMemo(() => {
    const supported = finished.reduce((a, s) => a + countOf(s, "SUPPORTED"), 0)
    const contradicted = finished.reduce((a, s) => a + countOf(s, "CONTRADICTED"), 0)
    const unverified = finished.reduce((a, s) => a + countOf(s, "UNVERIFIED"), 0)
    return { supported, contradicted, unverified, total: finished.reduce((a, s) => a + totalClaims(s), 0) }
  }, [finished])

  // The ledger shows the claims of the most recent finished run.
  const latestId = latest?.id
  useEffect(() => {
    if (!latestId) {
      setLedger(null)
      return
    }
    let cancelled = false
    setLedgerLoading(true)
    getVerificationResults(latestId)
      .then((r) => { if (!cancelled) setLedger({ sessionId: latestId, claims: r.claims }) })
      .catch(() => { if (!cancelled) setLedger(null) })
      .finally(() => { if (!cancelled) setLedgerLoading(false) })
    return () => { cancelled = true }
  }, [latestId])

  const chartData = [
    { name: "Supported", value: counts.supported, color: "#10b981", percent: `${pct(counts.supported, counts.total)}%` },
    { name: "Contradicted", value: counts.contradicted, color: "#f43f5e", percent: `${pct(counts.contradicted, counts.total)}%` },
    { name: "Unverified", value: counts.unverified, color: "#f59e0b", percent: `${pct(counts.unverified, counts.total)}%` },
  ]

  const claims = ledger?.claims ?? []
  const filteredClaims = claims.filter((c) => {
    const q = searchQuery.trim().toLowerCase()
    return (claimFilter === "ALL" || c.status.toUpperCase() === claimFilter) &&
      (q === "" || c.claim_text.toLowerCase().includes(q) || c.claim_type.toLowerCase().includes(q))
  })
  const ledgerCount = (v: Verdict) => claims.filter((c) => c.status.toUpperCase() === v).length

  const supportRate = pct(counts.supported, counts.total)
  const hallucinationRate = pct(counts.contradicted, counts.total)
  const unverifiedRate = pct(counts.unverified, counts.total)

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: "easeOut" }} className="space-y-6">
      <div className="glass-strong rounded-2xl p-6 border border-white/10 relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute left-1/3 bottom-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row justify-between lg:items-center gap-6">
          <div className="space-y-1.5 max-w-2xl">
            <h1 className="text-2xl lg:text-3xl font-extrabold text-white tracking-tight">Verification Dashboard</h1>
            <p className="text-slate-300 text-sm leading-relaxed">
              Totals across your organisation's {finished.length} most recent finished verification{finished.length === 1 ? "" : "s"}: claim decomposition, hybrid
              retrieval grounding, NLI and deterministic figure checks.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <Link to="/review">
              <Button variant="outline" className="h-10 text-xs font-semibold gap-1.5 border-white/15 hover:bg-white/10">
                <ShieldCheck className="h-4 w-4 text-amber-400" /> Review Queue
              </Button>
            </Link>
            <Link to="/verify">
              <Button className="h-10 text-xs font-bold gap-2 bg-gradient-to-r from-amber-400 to-amber-500 text-neutral-950 hover:from-amber-300 hover:to-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.3)]">
                <Plus className="h-4 w-4 stroke-[2.5]" /> Run New Verification
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {error && (
        <div role="alert" className="glass-card p-4 text-sm text-rose-300 border border-rose-500/30">{error}</div>
      )}

      {!error && !loading && finished.length === 0 ? (
        <EmptyState
          title="No finished verifications yet"
          message="Upload a financial report and check an LLM answer against it. Totals, charts and the claim ledger fill in as runs complete."
          actionLabel="Start a verification"
          onAction={() => navigate("/verify")}
        />
      ) : (
        <>
          <motion.div
            variants={{ hidden: {}, show: { transition: { staggerChildren: 0.08 } } }}
            initial="hidden"
            animate="show"
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
          >
            {[
              { label: "Total Claims Audited", value: counts.total, color: "text-white", border: "border-white/10", bar: "from-slate-400 to-slate-200", icon: <FileText className="h-4 w-4" />, foot: `Across ${finished.length} finished run${finished.length === 1 ? "" : "s"}` },
              { label: "Supported", value: counts.supported, color: "text-emerald-400", border: "border-emerald-400/25", bar: "from-emerald-400 to-teal-400", icon: <CheckCircle2 className="h-4 w-4" />, foot: `${supportRate}% of claims` },
              { label: "Contradicted", value: counts.contradicted, color: "text-rose-400", border: "border-rose-400/25", bar: "from-rose-500 to-red-400", icon: <AlertTriangle className="h-4 w-4" />, foot: `${hallucinationRate}% of claims` },
              { label: "Unverified", value: counts.unverified, color: "text-amber-400", border: "border-amber-400/25", bar: "from-amber-400 to-amber-600", icon: <HelpCircle className="h-4 w-4" />, foot: `${unverifiedRate}% without enough evidence` },
            ].map((k) => (
              <motion.div key={k.label} variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }}>
                <div className={`glass-card rounded-2xl p-5 border ${k.border} relative overflow-hidden`}>
                  <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${k.bar}`} />
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[11px] font-bold tracking-wider text-slate-400 uppercase">{k.label}</span>
                    <div className={`h-8 w-8 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center ${k.color}`}>{k.icon}</div>
                  </div>
                  <div className={`text-3xl font-extrabold font-mono ${k.color}`}>{loading ? "–" : k.value}</div>
                  <div className="text-xs text-slate-400 mt-2 font-mono">{k.foot}</div>
                </div>
              </motion.div>
            ))}
          </motion.div>

          <div className="grid gap-6 lg:grid-cols-12">
            <div className="lg:col-span-7 glass-card rounded-2xl p-5 border border-white/10 space-y-4">
              <div className="flex items-center justify-between border-b border-white/8 pb-3">
                <div>
                  <h2 className="text-sm font-bold text-white uppercase tracking-wider">Claim Verdict Distribution</h2>
                  <p className="text-xs text-slate-400">Verdicts across your finished verifications</p>
                </div>
                <span className="text-xs font-mono px-2.5 py-1 rounded bg-white/5 border border-white/10 text-slate-300">
                  Total: {counts.total} claims
                </span>
              </div>
              <div className="h-56 w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 12, right: 12, left: -16, bottom: 0 }}>
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#94a3b8", fontWeight: 600 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#64748b" }} allowDecimals={false} />
                    <Tooltip content={<CustomChartTooltip />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
                    <Bar dataKey="value" radius={[8, 8, 0, 0]} barSize={52} animationDuration={800}>
                      {chartData.map((d) => <Cell key={d.name} fill={d.color} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="lg:col-span-5 glass-card rounded-2xl p-5 border border-white/10 space-y-4">
              <div className="flex items-center gap-2 border-b border-white/8 pb-3">
                <Cpu className="h-4 w-4 text-indigo-400" />
                <h2 className="text-sm font-bold text-white uppercase tracking-wider">How a verdict is made</h2>
              </div>
              <div className="space-y-3">
                <div className="p-3 rounded-xl bg-black/30 border border-white/8 space-y-1.5">
                  <span className="font-semibold text-white text-xs flex items-center gap-1.5"><Search className="h-3.5 w-3.5 text-indigo-400" /> Hybrid retrieval</span>
                  <p className="text-[11px] text-slate-400 leading-relaxed">Dense MiniLM embeddings and BM25 merged with reciprocal rank fusion find the passages that could support a claim.</p>
                </div>
                <div className="p-3 rounded-xl bg-black/30 border border-white/8 space-y-1.5">
                  <span className="font-semibold text-white text-xs flex items-center gap-1.5"><Cpu className="h-3.5 w-3.5 text-amber-400" /> NLI cross-encoder</span>
                  <p className="text-[11px] text-slate-400 leading-relaxed">A DeBERTa-v3 model scores entailment and contradiction between claim and evidence.</p>
                </div>
                <div className="p-3 rounded-xl bg-black/30 border border-white/8 space-y-1.5">
                  <span className="font-semibold text-white text-xs flex items-center gap-1.5"><Calculator className="h-3.5 w-3.5 text-cyan-400" /> Deterministic checks</span>
                  <p className="text-[11px] text-slate-400 leading-relaxed">Figure grounding, entity novelty, fiscal-period and derived-value recomputation can override the model, in a fixed priority order. Every verdict records which check decided it.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="glass-card rounded-2xl p-5 border border-white/10 space-y-4">
            <div className="flex items-center justify-between border-b border-white/8 pb-3">
              <div>
                <h2 className="text-sm font-bold text-white uppercase tracking-wider">Recent Verifications</h2>
                <p className="text-xs text-slate-400">Your latest runs</p>
              </div>
              <Link to="/history" className="text-xs text-amber-400 hover:text-amber-300 font-semibold flex items-center gap-1">
                <span>All history</span> <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              {finished.slice(0, 6).map((s) => {
                const con = countOf(s, "CONTRADICTED")
                return (
                  <Link key={s.id} to={`/verify/results/${s.id}`} className="block group">
                    <div className="p-4 rounded-xl bg-black/30 border border-white/8 group-hover:border-amber-400/40 group-hover:bg-white/[0.04] transition-all duration-200 h-full flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[10px] font-mono font-bold text-slate-400 uppercase truncate max-w-[60%]">{s.document_name ?? "(deleted document)"}</span>
                          <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${
                            con > 0 ? "text-rose-300 border-rose-400/30 bg-rose-500/10" : "text-emerald-300 border-emerald-400/30 bg-emerald-500/10"
                          }`}>
                            {con > 0 ? `${con} contradicted` : "No contradictions"}
                          </span>
                        </div>
                        <p className="text-xs text-slate-300 line-clamp-3 leading-relaxed">"{s.statement_preview}"</p>
                      </div>
                      <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-xs font-mono">
                        <span className="text-slate-400">{totalClaims(s)} claims</span>
                        <span className="text-amber-400 font-bold group-hover:translate-x-1 transition-transform flex items-center gap-0.5">
                          Inspect <ChevronRight className="h-3 w-3" />
                        </span>
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>

          <div className="glass-card rounded-2xl border border-white/10 overflow-hidden">
            <div className="p-5 border-b border-white/8 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
              <div>
                <h2 className="text-sm font-bold text-white uppercase tracking-wider">Claims in the latest run</h2>
                <p className="text-xs text-slate-400 mt-0.5 truncate max-w-md">
                  {latest ? `${latest.document_name ?? "(deleted document)"} · ${new Date(latest.created_at).toLocaleString()}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1 bg-black/40 p-1 rounded-xl border border-white/10 text-xs">
                  {(["ALL", "CONTRADICTED", "SUPPORTED", "UNVERIFIED"] as const).map((f) => (
                    <button
                      key={f}
                      onClick={() => setClaimFilter(f)}
                      aria-pressed={claimFilter === f}
                      className={`px-2.5 py-1 rounded-lg font-semibold transition-all text-[11px] capitalize ${
                        claimFilter === f ? "bg-amber-400 text-neutral-950 shadow" : "text-slate-400 hover:text-white hover:bg-white/5"
                      }`}
                    >
                      {f === "ALL" ? `All (${claims.length})` : `${f.toLowerCase()} (${ledgerCount(f)})`}
                    </button>
                  ))}
                </div>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Filter claim text..."
                    aria-label="Filter claims"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-8 w-44 rounded-xl border border-white/10 bg-black/30 pl-8 pr-3 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-400 font-sans"
                  />
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-white/[0.03] text-slate-400 uppercase font-mono text-[10px] border-b border-white/8">
                  <tr>
                    <th className="py-3 px-4 w-12">#</th>
                    <th className="py-3 px-4">Claim Statement</th>
                    <th className="py-3 px-4">Diagnostics</th>
                    <th className="py-3 px-4">Retrieval</th>
                    <th className="py-3 px-4 text-center">Confidence</th>
                    <th className="py-3 px-4">Verdict</th>
                    <th className="py-3 px-4 text-right">Inspect</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {ledgerLoading ? (
                    <tr><td colSpan={7} className="py-10 text-center text-slate-500"><Loader2 className="h-5 w-5 animate-spin inline" /></td></tr>
                  ) : filteredClaims.length === 0 ? (
                    <tr><td colSpan={7} className="py-10 text-center text-slate-500">No claims match this filter.</td></tr>
                  ) : (
                    filteredClaims.map((c, i) => (
                      <tr key={c.id} className="hover:bg-white/[0.04] transition-colors group">
                        <td className="py-3.5 px-4 font-mono text-slate-400">{String(i + 1).padStart(2, "0")}</td>
                        <td className="py-3.5 px-4 font-semibold text-white max-w-md"><span className="line-clamp-2">{c.claim_text}</span></td>
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {c.hallucination_type && c.hallucination_type !== "NONE" ? (
                              <span className="inline-flex items-center gap-1 text-[9px] font-mono px-1.5 py-0.5 rounded border border-rose-400/30 text-rose-300 bg-rose-500/10">
                                <ShieldAlert className="h-2.5 w-2.5" />
                                {c.hallucination_type.replace(/_/g, " ")}
                              </span>
                            ) : (
                              <span className="text-[9px] font-mono text-slate-400 px-1.5 py-0.5 rounded bg-white/5">{c.claim_type}</span>
                            )}
                            {c.numerical_finding && c.numerical_finding.comparison_outcome !== "NO_CALCULATION" && (
                              <span className={`inline-flex items-center gap-1 text-[9px] font-mono px-1.5 py-0.5 rounded border ${
                                c.numerical_finding.comparison_outcome === "VALIDATED" ? "text-emerald-300 border-emerald-400/30 bg-emerald-500/10" : "text-rose-300 border-rose-400/30 bg-rose-500/10"
                              }`}>
                                <Calculator className="h-2.5 w-2.5" />
                                {c.numerical_finding.comparison_outcome}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 font-mono text-[10px]">
                          {c.evidence && c.evidence.page_number > 0 ? (
                            <span className="text-indigo-300 bg-indigo-500/10 border border-indigo-400/30 px-1.5 py-0.5 rounded">Page {c.evidence.page_number}</span>
                          ) : (
                            <span className="text-slate-400 italic">No evidence</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-center font-mono"><span className="font-bold text-white">{Math.round((c.confidence ?? 0) * 100)}%</span></td>
                        <td className="py-3.5 px-4">{verdictBadge(c.status)}</td>
                        <td className="py-3.5 px-4 text-right">
                          <Link
                            to={`/verify/results/${ledger?.sessionId}/claim/${c.id}`}
                            className="inline-flex items-center gap-1 text-amber-400 hover:text-amber-300 font-semibold group-hover:translate-x-0.5 transition-transform"
                          >
                            Audit <ChevronRight className="h-3 w-3" />
                          </Link>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </motion.div>
  )
}
