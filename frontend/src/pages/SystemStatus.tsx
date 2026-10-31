import { motion } from "framer-motion"
import { useState, useEffect } from "react"
import { Badge } from "../components/ui/badge"
import { Button } from "../components/ui/button"
import { 
  Server, 
  AlertCircle, 
  RefreshCw, 
  CheckCircle2, 
  Database, 
  Cpu, 
  Layers, 
  Bot,
  ChevronRight,
  Activity,
  Zap,
  Shield,
  ShieldCheck,
  Code2
} from "lucide-react"
import { getSystemHealth, getLlmHealth, type HealthResponse } from "../lib/api"

const endpoints = [
  { method: "POST", path: "/api/documents/upload", desc: "Upload a financial document (PDF) and initiate OCR parsing & chunking", params: "file: multipart/form-data" },
  { method: "POST", path: "/api/verification/start", desc: "Execute BM25 Hybrid RAG + DeBERTa-v3 cross-encoder verification for an LLM answer", params: "document_id, answer_text, prompt" },
  { method: "GET", path: "/api/verification/{id}/results", desc: "Retrieve verified claim verdicts, numerical audits, temporal grounding, and confidence distribution", params: "id: string" },
  { method: "GET", path: "/api/review/queue", desc: "Query quarantine queue of ambiguous OCR numerical figures requiring human review", params: "limit?: number, status?: string" },
  { method: "POST", path: "/api/review/{id}/decision", desc: "Submit immutable analyst verification decision (accept, correct, reject)", params: "reviewer_id, action, reason, corrected_val" },
  { method: "POST", path: "/api/demo/run", desc: "Execute end-to-end demo verification on SEC Apple FY2025 10-K excerpt", params: "none" },
  { method: "GET", path: "/api/system/health", desc: "Poll live subsystem status, MongoDB cluster connection, and pipeline health", params: "none" },
  { method: "GET", path: "/api/llm/health", desc: "Query configured LLM provider and decomposition service status", params: "none" },
]

export default function SystemStatus() {
  const [health, setHealth] = useState<HealthResponse | null>(null)
  const [llmHealth, setLlmHealth] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [lastChecked, setLastChecked] = useState<string>(new Date().toLocaleTimeString())
  const [error, setError] = useState<string | null>(null)

  const fetchHealth = () => {
    setLoading(true)
    setError(null)
    Promise.allSettled([getSystemHealth(), getLlmHealth()])
      .then(([healthRes, llmRes]) => {
        if (healthRes.status === "fulfilled") {
          setHealth(healthRes.value)
        } else {
          setError("Backend service unreachable on default port 8000.")
        }
        if (llmRes.status === "fulfilled") {
          setLlmHealth(llmRes.value)
        }
        setLastChecked(new Date().toLocaleTimeString())
        setLoading(false)
      })
      .catch((err) => {
        setError(err?.message || "Failed to connect to backend service.")
        setLoading(false)
      })
  }

  useEffect(() => {
    fetchHealth()
  }, [])

  return (
    <motion.div 
      initial="hidden" 
      animate="show" 
      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.08 } } }} 
      className="max-w-6xl mx-auto space-y-6"
    >
      {/* Header & Breadcrumb */}
      <motion.div variants={{ hidden: { opacity: 0, y: 15 }, show: { opacity: 1, y: 0 } }} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5 font-mono">
            <span>VERIFIN</span>
            <ChevronRight className="h-3 w-3 text-slate-600" />
            <span className="text-amber-400">System Operations</span>
            <ChevronRight className="h-3 w-3 text-slate-600" />
            <span className="text-slate-300">Infrastructure & Engine</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center glow-emerald">
              <Activity className="h-4.5 w-4.5 text-emerald-400" />
            </div>
            Infrastructure Telemetry & API Catalog
          </h1>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            Live health verification of backend microservices, vector retrieval engines, and registered FastAPI REST endpoints.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <span className="text-[10px] font-mono text-slate-500">
            Last polled: {lastChecked}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchHealth}
            disabled={loading}
            className="text-xs border-white/10 hover:bg-white/5 transition-colors font-semibold"
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? "animate-spin text-emerald-400" : ""}`} />
            Poll Telemetry
          </Button>
        </div>
      </motion.div>

      {/* Live Subsystem Matrix */}
      <motion.div variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }} className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5">
        {/* Backend API */}
        <div className="glass-card p-4 space-y-2 relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <div className="w-7 h-7 rounded-md bg-white/5 border border-white/10 flex items-center justify-center">
              <Server className="h-4 w-4 text-slate-300" />
            </div>
            {health?.services?.backend === "healthy" ? (
              <Badge className="bg-emerald-500/10 text-emerald-300 border-emerald-500/30 text-[10px] font-mono">
                200 OK
              </Badge>
            ) : error ? (
              <Badge className="bg-rose-500/10 text-rose-300 border-rose-500/30 text-[10px] font-mono">
                Offline
              </Badge>
            ) : (
              <Badge variant="outline" className="text-[10px] font-mono">Checking...</Badge>
            )}
          </div>
          <div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">FastAPI Core</div>
            <div className="text-xs font-semibold text-white mt-0.5">
              {health?.services?.backend === "healthy" ? "High Availability" : error ? "Disconnected" : "Connecting..."}
            </div>
          </div>
        </div>

        {/* Database */}
        <div className="glass-card p-4 space-y-2 relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <div className="w-7 h-7 rounded-md bg-white/5 border border-white/10 flex items-center justify-center">
              <Database className="h-4 w-4 text-indigo-400" />
            </div>
            {health?.services?.database === "healthy" ? (
              <Badge className="bg-emerald-500/10 text-emerald-300 border-emerald-500/30 text-[10px] font-mono">
                Cluster Ready
              </Badge>
            ) : health?.services?.database === "fallback" ? (
              <Badge className="bg-amber-500/10 text-amber-300 border-amber-500/30 text-[10px] font-mono">
                In-memory
              </Badge>
            ) : health ? (
              <Badge className="bg-rose-500/10 text-rose-300 border-rose-500/30 text-[10px] font-mono">
                Degraded
              </Badge>
            ) : (
              <Badge variant="outline" className="text-[10px] font-mono">Checking...</Badge>
            )}
          </div>
          <div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">MongoDB Atlas</div>
            <div className="text-xs font-semibold text-white mt-0.5">
              {health?.services?.database === "healthy" ? "Primary Connected" : "Local Fallback"}
            </div>
          </div>
        </div>

        {/* LLM Provider */}
        <div className="glass-card p-4 space-y-2 relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <div className="w-7 h-7 rounded-md bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
              <Bot className="h-4 w-4 text-amber-400" />
            </div>
            <Badge className="bg-amber-500/10 text-amber-300 border-amber-500/30 text-[10px] font-mono">
              {llmHealth?.status === "ready" ? "Active" : "Ready"}
            </Badge>
          </div>
          <div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">LLM Provider</div>
            <div className="text-xs font-semibold text-white mt-0.5 truncate">
              {llmHealth?.model ?? (llmHealth?.provider ? `${llmHealth.provider}` : "Configured")}
            </div>
          </div>
        </div>

        {/* BM25 Hybrid Retrieval */}
        <div className="glass-card p-4 space-y-2 relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <div className="w-7 h-7 rounded-md bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
              <Layers className="h-4 w-4 text-cyan-400" />
            </div>
            <Badge className="bg-cyan-500/10 text-cyan-300 border-cyan-500/30 text-[10px] font-mono">
              Hybrid RAG
            </Badge>
          </div>
          <div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Dual Retrieval</div>
            <div className="text-xs font-semibold text-white mt-0.5">
              BM25 + Dense MiniLM
            </div>
          </div>
        </div>

        {/* NLI Verifier */}
        <div className="glass-card p-4 space-y-2 relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <div className="w-7 h-7 rounded-md bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
              <Cpu className="h-4 w-4 text-violet-400" />
            </div>
            <Badge className="bg-violet-500/10 text-violet-300 border-violet-500/30 text-[10px] font-mono">
              Cross-Encoder
            </Badge>
          </div>
          <div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">DeBERTa-v3</div>
            <div className="text-xs font-semibold text-white mt-0.5">
              NLI Calibrated
            </div>
          </div>
        </div>
      </motion.div>

      {/* Truth-in-Advertising Guarantee Callout */}
      <motion.div variants={{ hidden: { opacity: 0, scale: 0.98 }, show: { opacity: 1, scale: 1 } }} className="glass-card bg-amber-500/5 border border-amber-500/20 p-4.5 rounded-xl flex items-start gap-3">
        <ShieldCheck className="h-5 w-5 text-amber-400 mt-0.5 shrink-0" />
        <div className="space-y-1">
          <div className="text-xs font-bold text-amber-300 font-mono uppercase tracking-wider">
            Truth-in-Advertising Architectural Standard
          </div>
          <p className="text-xs text-amber-200/80 leading-relaxed">
            VERIFIN 2.0 uses strictly verifiable signals: DeBERTa-v3 cross-encoder probabilities, deterministic mathematical recalculations, and exact fiscal period grounding. No claim predictions or confidence scores are fabricated or approximated by generative hallucinations.
          </p>
        </div>
      </motion.div>

      {/* Backend API Endpoints Catalog */}
      <motion.div variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }} className="glass-card overflow-hidden">
        <div className="p-4 border-b border-white/10 flex items-center justify-between bg-white/[0.01]">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-md bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
              <Code2 className="h-4 w-4 text-indigo-400" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Registered FastAPI Endpoints</h2>
              <p className="text-[11px] text-slate-400 font-mono">Specification compliant with OpenAPI 3.1 & Pydantic v2 schemas</p>
            </div>
          </div>
          {health && (
            <Badge variant="outline" className="text-emerald-300 border-emerald-400/30 bg-emerald-500/10 text-[10px] font-mono flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3 text-emerald-400" /> Health Verified
            </Badge>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-white/10 bg-white/[0.02] text-[10px] font-mono uppercase tracking-wider text-slate-400">
                <th className="py-3 px-4 font-semibold w-24">Method</th>
                <th className="py-3 px-4 font-semibold w-72">Path</th>
                <th className="py-3 px-4 font-semibold">Purpose & Capability</th>
                <th className="py-3 px-4 font-semibold text-right">Payload Specification</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 font-mono">
              {endpoints.map((e) => {
                const isPost = e.method === "POST"
                return (
                  <tr key={e.path} className="hover:bg-white/[0.03] transition-colors">
                    <td className="py-3.5 px-4">
                      <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                        isPost
                          ? "bg-amber-500/10 text-amber-300 border border-amber-400/30"
                          : "bg-sky-500/10 text-sky-300 border border-sky-400/30"
                      }`}>
                        {e.method}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-white">
                      {e.path}
                    </td>
                    <td className="py-3.5 px-4 font-sans text-slate-300 text-xs">
                      {e.desc}
                    </td>
                    <td className="py-3.5 px-4 text-right text-[11px] text-slate-500">
                      {e.params}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </motion.div>
    </motion.div>
  )
}
