import { motion } from "framer-motion"
import { useState, useEffect } from "react"
import { Card, CardContent } from "../components/ui/card"
import { Badge } from "../components/ui/badge"
import { Button } from "../components/ui/button"
import { Table, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table"
import { Server, AlertCircle, RefreshCw, CheckCircle2, Database, Cpu, Layers, Bot } from "lucide-react"
import { getSystemHealth, getLlmHealth, type HealthResponse } from "../lib/api"

const endpoints = [
  { method: "POST", path: "/api/documents/upload", desc: "Upload a financial document (PDF) and start parsing" },
  { method: "POST", path: "/api/verification/start", desc: "Run verification for an LLM answer against a document" },
  { method: "GET", path: "/api/verification/{id}/results", desc: "Fetch results for a completed verification" },
  { method: "GET", path: "/api/review/queue", desc: "Human review queue for low-confidence OCR numerical cells" },
  { method: "POST", path: "/api/demo/run", desc: "Run the built-in demo verification" },
  { method: "GET", path: "/api/system/health", desc: "Backend health check" },
]

export default function SystemStatus() {
  const [health, setHealth] = useState<HealthResponse | null>(null)
  const [llmHealth, setLlmHealth] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchHealth = () => {
    setLoading(true)
    setError(null)
    Promise.allSettled([getSystemHealth(), getLlmHealth()])
      .then(([healthRes, llmRes]) => {
        if (healthRes.status === "fulfilled") {
          setHealth(healthRes.value)
        } else {
          setError("Failed to connect to backend health service.")
        }
        if (llmRes.status === "fulfilled") {
          setLlmHealth(llmRes.value)
        }
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
    <motion.div initial="hidden" animate="show" variants={{ hidden: {}, show: { transition: { staggerChildren: 0.1 } } }} className="max-w-3xl mx-auto space-y-6">
      <motion.div variants={{ hidden: { opacity: 0, y: 15 }, show: { opacity: 1, y: 0 } }} className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">System Status</h1>
          <p className="text-sm text-slate-500 mt-1">
            Live infrastructure status and registered backend API capabilities.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchHealth}
          disabled={loading}
          className="text-xs"
        >
          <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
          Refresh Status
        </Button>
      </motion.div>

      {/* Live Service Cards */}
      <motion.div variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }} className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {/* Backend API */}
        <div className="glass-subtle border border-white/10 rounded-xl p-3.5 space-y-2">
          <div className="flex items-center justify-between">
            <Server className="h-4 w-4 text-slate-400" />
            {health?.services?.backend === "healthy" ? (
              <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[10px]">Online</Badge>
            ) : error ? (
              <Badge className="bg-rose-500/10 text-rose-400 border-rose-500/20 text-[10px]">Offline</Badge>
            ) : (
              <Badge variant="outline" className="text-[10px]">Checking...</Badge>
            )}
          </div>
          <div>
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">FastAPI</div>
            <div className="text-xs font-semibold text-white mt-0.5">
              {health?.services?.backend === "healthy" ? "Healthy (200 OK)" : error ? "Disconnected" : "Connecting"}
            </div>
          </div>
        </div>

        {/* Database */}
        <div className="glass-subtle border border-white/10 rounded-xl p-3.5 space-y-2">
          <div className="flex items-center justify-between">
            <Database className="h-4 w-4 text-slate-400" />
            {health?.services?.database === "healthy" ? (
              <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[10px]">Connected</Badge>
            ) : health ? (
              <Badge className="bg-rose-500/10 text-rose-400 border-rose-500/20 text-[10px]">Degraded</Badge>
            ) : (
              <Badge variant="outline" className="text-[10px]">Checking...</Badge>
            )}
          </div>
          <div>
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">MongoDB Atlas</div>
            <div className="text-xs font-semibold text-white mt-0.5">
              {health?.services?.database === "healthy" ? "Cluster Ready" : "Unreachable"}
            </div>
          </div>
        </div>

        {/* LLM Service */}
        <div className="glass-subtle border border-white/10 rounded-xl p-3.5 space-y-2">
          <div className="flex items-center justify-between">
            <Bot className="h-4 w-4 text-amber-400" />
            <Badge className="bg-amber-500/10 text-amber-300 border-amber-500/20 text-[10px]">
              {llmHealth?.status === "ready" ? "Active" : "Modular"}
            </Badge>
          </div>
          <div>
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">LLM Provider</div>
            <div className="text-xs font-semibold text-white mt-0.5 truncate">
              {llmHealth?.model ?? (llmHealth?.provider ? `${llmHealth.provider}` : "Configured")}
            </div>
          </div>
        </div>

        {/* Embedding */}
        <div className="glass-subtle border border-white/10 rounded-xl p-3.5 space-y-2">
          <div className="flex items-center justify-between">
            <Layers className="h-4 w-4 text-slate-400" />
            <Badge className="bg-white/5 text-slate-400 border-white/10 text-[10px]">Phase 2</Badge>
          </div>
          <div>
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Embeddings</div>
            <div className="text-xs font-semibold text-slate-400 mt-0.5">
              {health?.services?.embedding ?? "not_initialized"}
            </div>
          </div>
        </div>

        {/* NLI */}
        <div className="glass-subtle border border-white/10 rounded-xl p-3.5 space-y-2">
          <div className="flex items-center justify-between">
            <Cpu className="h-4 w-4 text-slate-400" />
            <Badge className="bg-white/5 text-slate-400 border-white/10 text-[10px]">Phase 3</Badge>
          </div>
          <div>
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">DeBERTa NLI</div>
            <div className="text-xs font-semibold text-slate-400 mt-0.5">
              {health?.services?.nli ?? "not_initialized"}
            </div>
          </div>
        </div>
      </motion.div>

      <motion.div variants={{ hidden: { opacity: 0, scale: 0.98 }, show: { opacity: 1, scale: 1 } }} className="glass-subtle bg-amber-500/5 border border-amber-500/20 rounded-lg p-4 flex items-start gap-3">
        <AlertCircle className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
        <p className="text-xs text-amber-200/80 leading-relaxed">
          VERIFIN 2.0 uses truth-in-advertising reporting: embedding models and NLI verifiers are scheduled for activation in subsequent phases. No metrics or claim predictions are simulated or fabricated.
        </p>
      </motion.div>

      <motion.div variants={{ hidden: { opacity: 0, scale: 0.98 }, show: { opacity: 1, scale: 1 } }}>
      <Card>
        <div className="p-5 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Server className="h-5 w-5 text-slate-400" />
            <h2 className="text-base font-bold text-white">Backend Endpoints (FastAPI)</h2>
          </div>
          {health && (
            <Badge variant="outline" className="text-emerald-400 border-emerald-400/30 text-[11px] flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" /> Live Verified
            </Badge>
          )}
        </div>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-white/[0.03]">
              <TableRow>
                <TableHead className="text-xs uppercase tracking-wider text-slate-400 w-20">Method</TableHead>
                <TableHead className="text-xs uppercase tracking-wider text-slate-400">Path</TableHead>
                <TableHead className="text-xs uppercase tracking-wider text-slate-400">Purpose</TableHead>
              </TableRow>
            </TableHeader>
            <motion.tbody variants={{ hidden: {}, show: { transition: { staggerChildren: 0.05 } } }} initial="hidden" animate="show" className="[&_tr:last-child]:border-0">
              {endpoints.map((e) => (
                <motion.tr variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } }} key={e.path} className="border-b transition-colors hover:bg-white/[0.04]">
                  <TableCell>
                    <Badge variant="outline" className="font-mono text-[10px]">{e.method}</Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-slate-300">{e.path}</TableCell>
                  <TableCell className="text-xs text-slate-500">{e.desc}</TableCell>
                </motion.tr>
              ))}
            </motion.tbody>
          </Table>
        </CardContent>
      </Card>
      </motion.div>
    </motion.div>
  )
}
