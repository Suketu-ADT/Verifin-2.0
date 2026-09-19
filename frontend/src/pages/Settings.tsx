import { motion } from "framer-motion"
import { useState, useEffect } from "react"
import { Card, CardContent } from "../components/ui/card"
import { Badge } from "../components/ui/badge"
import { Input } from "../components/ui/input"
import { Scale, Server, Cpu, Save } from "lucide-react"

export default function Settings() {
  const [entailmentFloor, setEntailmentFloor] = useState(0.85)
  const [apiBase, setApiBase] = useState(
    (import.meta as any).env?.VITE_API_BASE_URL ?? "http://localhost:8000"
  )

  return (
    <motion.div initial="hidden" animate="show" variants={{ hidden: {}, show: { transition: { staggerChildren: 0.1 } } }} className="max-w-2xl mx-auto space-y-6">
      <motion.div variants={{ hidden: { opacity: 0, y: 15 }, show: { opacity: 1, y: 0 } }}>
        <h1 className="text-2xl font-bold tracking-tight text-white">Settings</h1>
        <p className="text-sm text-slate-500 mt-1">Backend connection and NLI classification thresholds.</p>
      </motion.div>

      <motion.div variants={{ hidden: { opacity: 0, scale: 0.98 }, show: { opacity: 1, scale: 1 } }}>
      <Card>
        <div className="p-5 border-b border-white/10 flex items-center gap-3">
          <Server className="h-5 w-5 text-slate-400" />
          <h2 className="text-base font-bold text-white">Backend Connection</h2>
        </div>
        <CardContent className="p-5 space-y-3">
          <label className="text-xs font-semibold text-slate-300">API base URL</label>
          <Input
            value={apiBase}
            onChange={(e) => setApiBase(e.target.value)}
            className="font-mono text-sm bg-black/20 border-white/10 text-white focus-visible:ring-amber-500"
          />
          <p className="text-[11px] text-slate-400">
            Set VITE_API_BASE_URL in your .env to point the frontend at a running FastAPI backend.
            This field is a placeholder until the API client reads from it directly.
          </p>
        </CardContent>
      </Card>
      </motion.div>

      <motion.div variants={{ hidden: { opacity: 0, scale: 0.98 }, show: { opacity: 1, scale: 1 } }}>
      <Card>
        <div className="p-5 border-b border-white/10 flex items-center gap-3">
          <Scale className="h-5 w-5 text-slate-400" />
          <h2 className="text-base font-bold text-white">NLI Classification Threshold</h2>
        </div>
        <CardContent className="p-5 space-y-4">
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-semibold text-white">Entailment floor for "Supported"</span>
              <span className="text-sm font-mono font-bold text-amber-400">{entailmentFloor.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min={0.5}
              max={0.99}
              step={0.01}
              value={entailmentFloor}
              onChange={(e) => setEntailmentFloor(parseFloat(e.target.value))}
              className="w-full accent-amber-500"
            />
            <p className="text-[11px] text-slate-400 mt-1.5">
              Claims with entailment confidence at or above this value are classified Supported.
              backend/app/services/risk_engine.py would need to read this value to make it live.
            </p>
          </div>
        </CardContent>
      </Card>
      </motion.div>

      <motion.div variants={{ hidden: { opacity: 0, scale: 0.98 }, show: { opacity: 1, scale: 1 } }}>
      <Card>
        <div className="p-5 border-b border-white/10 flex items-center gap-3">
          <Cpu className="h-5 w-5 text-slate-400" />
          <h2 className="text-base font-bold text-white">Models in Use</h2>
        </div>
        <CardContent className="p-5 space-y-3">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <div>
              <div className="text-sm font-semibold text-white">NLI verification</div>
              <div className="text-[11px] text-slate-500">cross-encoder/nli-deberta-v3-base</div>
            </div>
            <Badge variant="outline" className="font-mono text-[10px]">HuggingFace</Badge>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-white">Semantic retrieval</div>
              <div className="text-[11px] text-slate-500">sentence-transformers/all-MiniLM-L6-v2</div>
            </div>
            <Badge variant="outline" className="font-mono text-[10px]">HuggingFace</Badge>
          </div>
        </CardContent>
      </Card>
      </motion.div>

      <motion.div variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }} className="flex justify-end">
        <button className="inline-flex items-center gap-1.5 h-9 px-4 rounded-md bg-white/10 border border-white/10 text-white text-sm font-semibold hover:bg-white/20 transition-colors">
          <Save className="h-3.5 w-3.5" /> Save
        </button>
      </motion.div>
    </motion.div>
  )
}
