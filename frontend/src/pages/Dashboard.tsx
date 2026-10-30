import { motion } from "framer-motion"
import { Link } from "react-router-dom"
import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card"
import { Button } from "../components/ui/button"
import { Badge } from "../components/ui/badge"
import {
  FileText, CheckCircle2, AlertTriangle, HelpCircle, Plus,
  ShieldAlert, Calculator, Calendar, Layers, Search, ArrowUpRight,
  Cpu, Sparkles, Filter, ChevronRight, Activity, TrendingUp, ShieldCheck,
} from "lucide-react"
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts"
import { demoSessions, allDemoClaims, claimCounts } from "../lib/demoData"

const counts = claimCounts()
const chartData = [
  { name: "Supported", value: counts.supported, color: "#10b981", percent: `${Math.round((counts.supported / counts.total) * 100)}%` },
  { name: "Contradicted", value: counts.contradicted, color: "#f43f5e", percent: `${Math.round((counts.contradicted / counts.total) * 100)}%` },
  { name: "Unverifiable", value: counts.unverifiable, color: "#f59e0b", percent: `${Math.round((counts.unverifiable / counts.total) * 100)}%` },
]

const verdictBadge = (label: string | undefined) => {
  const norm = (label || "").toUpperCase()
  if (norm === "SUPPORTED" || norm === "ENTAILMENT")
    return <Badge className="bg-emerald-500/10 text-emerald-300 border border-emerald-400/30 rounded gap-1 font-mono text-[10px]"><CheckCircle2 className="h-3 w-3" /> Supported</Badge>
  if (norm === "CONTRADICTED" || norm === "CONTRADICTION")
    return <Badge className="bg-rose-500/10 text-rose-300 border border-rose-400/30 rounded gap-1 font-mono text-[10px]"><AlertTriangle className="h-3 w-3" /> Contradicted</Badge>
  return <Badge className="bg-amber-500/10 text-amber-300 border border-amber-400/30 rounded gap-1 font-mono text-[10px]"><HelpCircle className="h-3 w-3" /> Unverifiable</Badge>
}

// Custom chart tooltip with dark glass backdrop
const CustomChartTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
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
  return null
}

export default function Dashboard() {
  const [claimFilter, setClaimFilter] = useState<"ALL" | "CONTRADICTED" | "SUPPORTED" | "UNVERIFIABLE">("ALL")
  const [searchQuery, setSearchQuery] = useState("")

  const filteredClaims = allDemoClaims.filter((c) => {
    const matchesFilter =
      claimFilter === "ALL" ||
      (claimFilter === "CONTRADICTED" && c.nli?.label === "CONTRADICTED") ||
      (claimFilter === "SUPPORTED" && c.nli?.label === "SUPPORTED") ||
      (claimFilter === "UNVERIFIABLE" && c.nli?.label === "UNVERIFIABLE")
    const matchesSearch =
      searchQuery === "" ||
      c.claim_text.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.claim_type.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesFilter && matchesSearch
  })

  const supportRate = Math.round((counts.supported / counts.total) * 100)
  const hallucinationRate = Math.round((counts.contradicted / counts.total) * 100)

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: "easeOut" }} className="space-y-6">
      {/* ─── Hero Command Header ─── */}
      <div className="glass-strong rounded-2xl p-6 border border-white/10 relative overflow-hidden">
        {/* Ambient background glow */}
        <div className="absolute right-0 top-0 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute left-1/3 bottom-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row justify-between lg:items-center gap-6">
          <div className="space-y-1.5 max-w-2xl">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-400/15 border border-amber-400/30 text-amber-300 font-mono text-[11px] font-bold">
                <Sparkles className="h-3 w-3" /> Financial LLM Hallucination Guard
              </span>
              <Badge variant="outline" className="text-emerald-400 border-emerald-400/30 bg-emerald-500/10 font-mono text-[10px]">
                Engine: Online
              </Badge>
            </div>
            <h1 className="text-2xl lg:text-3xl font-extrabold text-white tracking-tight">
              Verification Intelligence Dashboard
            </h1>
            <p className="text-slate-300 text-sm leading-relaxed">
              Real-time audit telemetry across financial filings, continuous claim decomposition, BM25 Hybrid RAG grounding, and DeBERTa-v3 cross-encoder consistency checks.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <Link to="/review">
              <Button variant="outline" className="h-10 text-xs font-semibold gap-1.5 border-white/15 hover:bg-white/10">
                <ShieldCheck className="h-4 w-4 text-amber-400" /> Review OCR Queue (2)
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

      {/* ─── 4 Elevated KPI Cards ─── */}
      <motion.div
        variants={{ hidden: {}, show: { transition: { staggerChildren: 0.08 } } }}
        initial="hidden"
        animate="show"
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        {/* Total Claims */}
        <motion.div variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }}>
          <div className="glass-card rounded-2xl p-5 border border-white/10 relative overflow-hidden group">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-slate-400 to-slate-200 opacity-60" />
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-bold tracking-wider text-slate-400 uppercase">Total Claims Audited</span>
              <div className="h-8 w-8 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-300 group-hover:scale-110 transition-transform">
                <FileText className="h-4 w-4" />
              </div>
            </div>
            <div className="text-3xl font-extrabold text-white font-mono">{counts.total}</div>
            <div className="flex items-center justify-between text-xs text-slate-400 mt-2 font-mono">
              <span>Across {demoSessions.length} active sessions</span>
              <span className="text-slate-300">100% parsed</span>
            </div>
          </div>
        </motion.div>

        {/* Supported Claims */}
        <motion.div variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }}>
          <div className="glass-card rounded-2xl p-5 border border-emerald-400/25 relative overflow-hidden group">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-400 to-teal-400" />
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-bold tracking-wider text-emerald-400 uppercase">Supported / Factual</span>
              <div className="h-8 w-8 rounded-xl bg-emerald-500/15 border border-emerald-400/30 flex items-center justify-center text-emerald-300 group-hover:scale-110 transition-transform">
                <CheckCircle2 className="h-4 w-4" />
              </div>
            </div>
            <div className="text-3xl font-extrabold text-emerald-400 font-mono">{counts.supported}</div>
            <div className="flex items-center justify-between text-xs mt-2 font-mono">
              <span className="text-emerald-400/90 font-semibold">{supportRate}% verified factual</span>
              <span className="text-slate-400">Zero delta</span>
            </div>
          </div>
        </motion.div>

        {/* Contradicted / Hallucinations */}
        <motion.div variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }}>
          <div className="glass-card rounded-2xl p-5 border border-rose-400/25 relative overflow-hidden group">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-rose-500 to-red-400" />
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-bold tracking-wider text-rose-400 uppercase">Hallucinations Flagged</span>
              <div className="h-8 w-8 rounded-xl bg-rose-500/15 border border-rose-400/30 flex items-center justify-center text-rose-300 group-hover:scale-110 transition-transform">
                <AlertTriangle className="h-4 w-4" />
              </div>
            </div>
            <div className="text-3xl font-extrabold text-rose-400 font-mono">{counts.contradicted}</div>
            <div className="flex items-center justify-between text-xs mt-2 font-mono">
              <span className="text-rose-400/90 font-semibold">{hallucinationRate}% contradiction rate</span>
              <span className="text-slate-400">High Risk</span>
            </div>
          </div>
        </motion.div>

        {/* Unverifiable */}
        <motion.div variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }}>
          <div className="glass-card rounded-2xl p-5 border border-amber-400/25 relative overflow-hidden group">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-400 to-amber-600" />
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-bold tracking-wider text-amber-400 uppercase">Unverifiable Claims</span>
              <div className="h-8 w-8 rounded-xl bg-amber-500/15 border border-amber-400/30 flex items-center justify-center text-amber-300 group-hover:scale-110 transition-transform">
                <HelpCircle className="h-4 w-4" />
              </div>
            </div>
            <div className="text-3xl font-extrabold text-amber-400 font-mono">{counts.unverifiable}</div>
            <div className="flex items-center justify-between text-xs mt-2 font-mono">
              <span className="text-amber-400/90 font-semibold">{Math.round((counts.unverifiable / counts.total) * 100)}% missing evidence</span>
              <span className="text-slate-400">Speculative</span>
            </div>
          </div>
        </motion.div>
      </motion.div>

      {/* ─── Middle Section: Analytics & Engine Telemetry ─── */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left: Claim Distribution Chart */}
        <div className="lg:col-span-7 glass-card rounded-2xl p-5 border border-white/10 space-y-4">
          <div className="flex items-center justify-between border-b border-white/8 pb-3">
            <div>
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">Claim Verdict Distribution</h2>
              <p className="text-xs text-slate-400">Natural Language Inference breakdown across filing corpora</p>
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
                  {chartData.map((d) => (
                    <Cell key={d.name} fill={d.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-3 gap-3 pt-2 border-t border-white/8 text-center">
            <div className="p-2 rounded-xl bg-emerald-500/5 border border-emerald-400/20">
              <span className="text-[10px] text-slate-400 block uppercase font-mono">Support Rate</span>
              <span className="text-base font-bold text-emerald-400 font-mono">{supportRate}%</span>
            </div>
            <div className="p-2 rounded-xl bg-rose-500/5 border border-rose-400/20">
              <span className="text-[10px] text-slate-400 block uppercase font-mono">Hallucination Catch</span>
              <span className="text-base font-bold text-rose-400 font-mono">{hallucinationRate}%</span>
            </div>
            <div className="p-2 rounded-xl bg-amber-500/5 border border-amber-400/20">
              <span className="text-[10px] text-slate-400 block uppercase font-mono">Missing Evid.</span>
              <span className="text-base font-bold text-amber-400 font-mono">{Math.round((counts.unverifiable / counts.total) * 100)}%</span>
            </div>
          </div>
        </div>

        {/* Right: Real-Time Engine Telemetry Matrix */}
        <div className="lg:col-span-5 glass-card rounded-2xl p-5 border border-white/10 space-y-4">
          <div className="flex items-center justify-between border-b border-white/8 pb-3">
            <div className="flex items-center gap-2">
              <Cpu className="h-4 w-4 text-indigo-400" />
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">Engine Telemetry Matrix</h2>
            </div>
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          </div>

          <div className="space-y-3">
            {/* Retrieval Component */}
            <div className="p-3 rounded-xl bg-black/30 border border-white/8 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-white flex items-center gap-1.5">
                  <Search className="h-3.5 w-3.5 text-indigo-400" /> BM25 Hybrid Retrieval
                </span>
                <span className="font-mono text-[10px] text-indigo-300 font-bold bg-indigo-500/15 px-2 py-0.5 rounded border border-indigo-400/30">
                  RRF Fused
                </span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Dual-channel sparse lexical BM25 tokenization + 384d dense embeddings merged with Reciprocal Rank Fusion (k=60).
              </p>
            </div>

            {/* Cross-Encoder Component */}
            <div className="p-3 rounded-xl bg-black/30 border border-white/8 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-white flex items-center gap-1.5">
                  <Cpu className="h-3.5 w-3.5 text-amber-400" /> DeBERTa-v3 Cross-Encoder
                </span>
                <span className="font-mono text-[10px] text-emerald-400 font-bold bg-emerald-500/15 px-2 py-0.5 rounded border border-emerald-400/30">
                  96.8% Confidence
                </span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Pre-trained NLI model evaluates premise-hypothesis pairs for full directional entailment and contradiction detection.
              </p>
            </div>

            {/* Deterministic Reasoning */}
            <div className="p-3 rounded-xl bg-black/30 border border-white/8 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-white flex items-center gap-1.5">
                  <Calculator className="h-3.5 w-3.5 text-cyan-400" /> Arithmetic & Multi-Hop
                </span>
                <span className="font-mono text-[10px] text-cyan-300 font-bold bg-cyan-500/15 px-2 py-0.5 rounded border border-cyan-400/30">
                  Active
                </span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Equation parsing detects YoY percentage distortions, rounding errors, and cross-table synthesized metrics.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Verification Sessions Gallery ─── */}
      <div className="glass-card rounded-2xl p-5 border border-white/10 space-y-4">
        <div className="flex items-center justify-between border-b border-white/8 pb-3">
          <div>
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">Demo Audit Sessions</h2>
            <p className="text-xs text-slate-400">Pre-indexed test sessions evaluating SEC 10-K report excerpts</p>
          </div>
          <Link to="/verify" className="text-xs text-amber-400 hover:text-amber-300 font-semibold flex items-center gap-1">
            <span>New Session</span> <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          {demoSessions.map((s) => {
            const sc = claimCounts(s.claims)
            const sRate = Math.round((sc.supported / sc.total) * 100)
            return (
              <Link key={s.id} to={`/verify/results/${s.id}`} className="block group">
                <div className="p-4 rounded-xl bg-black/30 border border-white/8 group-hover:border-amber-400/40 group-hover:bg-white/[0.04] transition-all duration-200 h-full flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-mono font-bold text-slate-400 uppercase">{s.id}</span>
                      <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${
                        sc.contradicted > 0 ? "text-rose-300 border-rose-400/30 bg-rose-500/10" : "text-emerald-300 border-emerald-400/30 bg-emerald-500/10"
                      }`}>
                        {sc.contradicted > 0 ? `${sc.contradicted} Hallucinations` : "Clean"}
                      </span>
                    </div>
                    <h3 className="text-sm font-bold text-white group-hover:text-amber-300 transition-colors">
                      {s.title}
                    </h3>
                    <p className="text-xs text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                      "{s.llm_output}"
                    </p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-xs font-mono">
                    <span className="text-slate-400">{s.claims.length} claims</span>
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

      {/* ─── Recent Claims Ledger ─── */}
      <div className="glass-card rounded-2xl border border-white/10 overflow-hidden">
        <div className="p-5 border-b border-white/8 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
          <div>
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">Granular Claims Audit Ledger</h2>
            <p className="text-xs text-slate-400 mt-0.5">Filter and inspect individual claim verdicts with multi-hop grounding</p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Filter Pills */}
            <div className="flex items-center gap-1 bg-black/40 p-1 rounded-xl border border-white/10 text-xs">
              {(["ALL", "CONTRADICTED", "SUPPORTED", "UNVERIFIABLE"] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setClaimFilter(filter)}
                  className={`px-2.5 py-1 rounded-lg font-semibold transition-all text-[11px] ${
                    claimFilter === filter
                      ? "bg-amber-400 text-neutral-950 shadow"
                      : "text-slate-400 hover:text-white hover:bg-white/5"
                  }`}
                >
                  {filter === "ALL" ? "All (9)" : filter === "CONTRADICTED" ? `Contradicted (${counts.contradicted})` : filter === "SUPPORTED" ? `Supported (${counts.supported})` : `Unverified (${counts.unverifiable})`}
                </button>
              ))}
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Filter claim text..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 w-44 rounded-xl border border-white/10 bg-black/30 pl-8 pr-3 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-400 font-sans"
              />
            </div>
          </div>
        </div>

        {/* Claims Table */}
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
              {filteredClaims.map((c, i) => (
                <tr key={c.id} className="hover:bg-white/[0.04] transition-colors group">
                  <td className="py-3.5 px-4 font-mono text-slate-400">{String(i + 1).padStart(2, "0")}</td>
                  <td className="py-3.5 px-4 font-semibold text-white max-w-md">
                    <span className="line-clamp-2">{c.claim_text}</span>
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {c.hallucination_type && c.hallucination_type !== "NONE" ? (
                        <span className="inline-flex items-center gap-1 text-[9px] font-mono px-1.5 py-0.5 rounded border border-rose-400/30 text-rose-300 bg-rose-500/10">
                          <ShieldAlert className="h-2.5 w-2.5" />
                          {c.hallucination_type.replace(/_/g, " ")}
                        </span>
                      ) : (
                        <span className="text-[9px] font-mono text-slate-400 px-1.5 py-0.5 rounded bg-white/5">
                          {c.claim_type}
                        </span>
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
                    {c.evidence ? (
                      <span className="text-indigo-300 bg-indigo-500/10 border border-indigo-400/30 px-1.5 py-0.5 rounded">
                        Page {c.evidence.page_number} · Hybrid RAG
                      </span>
                    ) : (
                      <span className="text-slate-400 italic">No evidence</span>
                    )}
                  </td>
                  <td className="py-3.5 px-4 text-center font-mono">
                    <span className="font-bold text-white">{Math.round((c.confidence ?? 0) * 100)}%</span>
                  </td>
                  <td className="py-3.5 px-4">{verdictBadge(c.nli?.label)}</td>
                  <td className="py-3.5 px-4 text-right">
                    <Link
                      to={`/verify/results/${demoSessions.find((s) => s.claims.some((item) => item.id === c.id))?.id || "demo-1"}/claim/${c.id}`}
                      className="inline-flex items-center gap-1 text-amber-400 hover:text-amber-300 font-semibold group-hover:translate-x-0.5 transition-transform"
                    >
                      Audit <ChevronRight className="h-3 w-3" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </motion.div>
  )
}

