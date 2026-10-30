import { motion, AnimatePresence } from "framer-motion"
import { useState, useEffect } from "react"
import { Badge } from "../components/ui/badge"
import { Input } from "../components/ui/input"
import { Button } from "../components/ui/button"
import { 
  Scale, 
  Server, 
  Cpu, 
  Save, 
  ChevronRight, 
  Sliders, 
  Sparkles, 
  Check, 
  ShieldCheck, 
  Database,
  Layers,
  Percent
} from "lucide-react"

export default function Settings() {
  const [entailmentFloor, setEntailmentFloor] = useState(0.85)
  const [contradictionFloor, setContradictionFloor] = useState(0.50)
  const [hybridAlpha, setHybridAlpha] = useState(0.70) // 70% dense, 30% BM25
  const [ocrFloor, setOcrFloor] = useState(60.0) // 60% OCR threshold
  const [apiBase, setApiBase] = useState(
    (import.meta as any).env?.VITE_API_BASE_URL ?? "http://localhost:8000"
  )
  const [savedSuccess, setSavedSuccess] = useState(false)

  // Load from localStorage on mount if available
  useEffect(() => {
    try {
      const stored = localStorage.getItem("verifin_settings")
      if (stored) {
        const parsed = JSON.parse(stored)
        if (parsed.entailmentFloor) setEntailmentFloor(parsed.entailmentFloor)
        if (parsed.contradictionFloor) setContradictionFloor(parsed.contradictionFloor)
        if (parsed.hybridAlpha) setHybridAlpha(parsed.hybridAlpha)
        if (parsed.ocrFloor) setOcrFloor(parsed.ocrFloor)
        if (parsed.apiBase) setApiBase(parsed.apiBase)
      }
    } catch {}
  }, [])

  const handleSave = () => {
    try {
      const cfg = { entailmentFloor, contradictionFloor, hybridAlpha, ocrFloor, apiBase }
      localStorage.setItem("verifin_settings", JSON.stringify(cfg))
      setSavedSuccess(true)
      setTimeout(() => setSavedSuccess(false), 3000)
    } catch {}
  }

  return (
    <motion.div 
      initial="hidden" 
      animate="show" 
      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.08 } } }} 
      className="max-w-4xl mx-auto space-y-6"
    >
      {/* Header & Breadcrumb */}
      <motion.div variants={{ hidden: { opacity: 0, y: 15 }, show: { opacity: 1, y: 0 } }} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5 font-mono">
            <span>VERIFIN</span>
            <ChevronRight className="h-3 w-3 text-slate-600" />
            <span className="text-amber-400">Platform Control</span>
            <ChevronRight className="h-3 w-3 text-slate-600" />
            <span className="text-slate-300">Engine Parameters</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center glow-amber">
              <Sliders className="h-4.5 w-4.5 text-amber-400" />
            </div>
            Quant Engine Configuration
          </h1>
          <p className="text-xs text-slate-400 mt-1 max-w-xl">
            Fine-tune DeBERTa cross-encoder thresholds, BM25 Hybrid RAG fusion weights, and OCR quarantine floor limits.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <AnimatePresence>
            {savedSuccess && (
              <motion.div
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="text-xs text-emerald-300 font-mono flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-lg"
              >
                <Check className="h-3.5 w-3.5 text-emerald-400" /> Settings Applied
              </motion.div>
            )}
          </AnimatePresence>
          <Button
            onClick={handleSave}
            className="text-xs font-bold bg-amber-500 hover:bg-amber-400 text-black px-4 shadow-lg shadow-amber-500/20"
          >
            <Save className="h-3.5 w-3.5 mr-1.5" /> Save Parameters
          </Button>
        </div>
      </motion.div>

      {/* Threshold Sliders Card */}
      <motion.div variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }} className="glass-card p-6 space-y-6">
        <div className="flex items-center gap-2.5 border-b border-white/10 pb-4">
          <div className="w-7 h-7 rounded-md bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
            <Scale className="h-4 w-4 text-amber-400" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white">NLI Verification & Decision Floors</h2>
            <p className="text-[11px] text-slate-400 font-mono">Probabilistic classification triggers for DeBERTa-v3 cross-encoder</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Entailment Floor */}
          <div className="p-4 rounded-xl bg-black/30 border border-white/5 space-y-3">
            <div className="flex justify-between items-center">
              <div>
                <span className="text-xs font-semibold text-white block">Entailment Floor (Supported)</span>
                <span className="text-[10px] text-slate-400">Minimum score to rule a claim Supported</span>
              </div>
              <Badge className="bg-emerald-500/10 text-emerald-300 border-emerald-500/30 font-mono text-xs">
                {(entailmentFloor * 100).toFixed(0)}%
              </Badge>
            </div>
            <input
              type="range"
              min={0.5}
              max={0.99}
              step={0.01}
              value={entailmentFloor}
              onChange={(e) => setEntailmentFloor(parseFloat(e.target.value))}
              className="w-full accent-amber-500 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] font-mono text-slate-500">
              <span>0.50 (Loose)</span>
              <span>Default: 0.85</span>
              <span>0.99 (Strict)</span>
            </div>
          </div>

          {/* Contradiction Trigger Floor */}
          <div className="p-4 rounded-xl bg-black/30 border border-white/5 space-y-3">
            <div className="flex justify-between items-center">
              <div>
                <span className="text-xs font-semibold text-white block">Contradiction Trigger Floor</span>
                <span className="text-[10px] text-slate-400">Threshold to flag high-risk discrepancy</span>
              </div>
              <Badge className="bg-rose-500/10 text-rose-300 border-rose-500/30 font-mono text-xs">
                {(contradictionFloor * 100).toFixed(0)}%
              </Badge>
            </div>
            <input
              type="range"
              min={0.2}
              max={0.8}
              step={0.01}
              value={contradictionFloor}
              onChange={(e) => setContradictionFloor(parseFloat(e.target.value))}
              className="w-full accent-rose-500 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] font-mono text-slate-500">
              <span>0.20 (Sensitive)</span>
              <span>Default: 0.50</span>
              <span>0.80 (Conservative)</span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Hybrid RAG Parameters Card */}
      <motion.div variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }} className="glass-card p-6 space-y-6">
        <div className="flex items-center gap-2.5 border-b border-white/10 pb-4">
          <div className="w-7 h-7 rounded-md bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
            <Layers className="h-4 w-4 text-indigo-400" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white">Hybrid Retrieval Fusion Ratio (&alpha;)</h2>
            <p className="text-[11px] text-slate-400 font-mono">Weighting between Dense Semantic Embeddings and Lexical BM25 Okapi</p>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-black/30 border border-white/5 space-y-3">
          <div className="flex justify-between items-center">
            <div>
              <span className="text-xs font-semibold text-white block">Dense vs. Lexical Balance</span>
              <span className="text-[10px] font-mono text-indigo-300">
                Score = {Math.round(hybridAlpha * 100)}% Dense + {Math.round((1 - hybridAlpha) * 100)}% BM25
              </span>
            </div>
            <Badge className="bg-indigo-500/10 text-indigo-300 border-indigo-500/30 font-mono text-xs">
              &alpha; = {hybridAlpha.toFixed(2)}
            </Badge>
          </div>

          <input
            type="range"
            min={0.1}
            max={0.9}
            step={0.05}
            value={hybridAlpha}
            onChange={(e) => setHybridAlpha(parseFloat(e.target.value))}
            className="w-full accent-indigo-500 cursor-pointer"
          />

          <div className="flex justify-between text-[10px] font-mono text-slate-500">
            <span>BM25 Dominant (Keyword exact)</span>
            <span>Balanced 50/50</span>
            <span>Dense Dominant (Semantic)</span>
          </div>
        </div>
      </motion.div>

      {/* OCR Quarantine Guardrails Card */}
      <motion.div variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }} className="glass-card p-6 space-y-6">
        <div className="flex items-center gap-2.5 border-b border-white/10 pb-4">
          <div className="w-7 h-7 rounded-md bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
            <ShieldCheck className="h-4 w-4 text-cyan-400" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white">OCR Character Ambiguity Quarantine Floor</h2>
            <p className="text-[11px] text-slate-400 font-mono">Tokens with character confidence below this value trigger Human Review</p>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-black/30 border border-white/5 space-y-3">
          <div className="flex justify-between items-center">
            <div>
              <span className="text-xs font-semibold text-white block">Quarantine Confidence Threshold</span>
              <span className="text-[10px] text-slate-400">Tokens with confidence below this floor enter review</span>
            </div>
            <Badge className="bg-cyan-500/10 text-cyan-300 border-cyan-500/30 font-mono text-xs">
              {ocrFloor.toFixed(0)}%
            </Badge>
          </div>

          <input
            type="range"
            min={40}
            max={85}
            step={1}
            value={ocrFloor}
            onChange={(e) => setOcrFloor(parseFloat(e.target.value))}
            className="w-full accent-cyan-500 cursor-pointer"
          />

          <div className="flex justify-between text-[10px] font-mono text-slate-500">
            <span>40% (Permissive)</span>
            <span>Default: 60%</span>
            <span>85% (Aggressive Quarantine)</span>
          </div>
        </div>
      </motion.div>

      {/* Backend Connection Card */}
      <motion.div variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }} className="glass-card p-6 space-y-4">
        <div className="flex items-center gap-2.5 border-b border-white/10 pb-4">
          <div className="w-7 h-7 rounded-md bg-white/5 border border-white/10 flex items-center justify-center">
            <Server className="h-4 w-4 text-slate-300" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white">Backend Connection</h2>
            <p className="text-[11px] text-slate-400 font-mono">FastAPI backend gateway URL</p>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-300">API Gateway Endpoint</label>
          <Input
            value={apiBase}
            onChange={(e) => setApiBase(e.target.value)}
            className="font-mono text-xs bg-black/30 border-white/10 text-white focus-visible:ring-amber-500"
          />
          <p className="text-[11px] text-slate-500 font-mono">
            Overrides VITE_API_BASE_URL for frontend network requests.
          </p>
        </div>
      </motion.div>

      {/* Registered Checkpoints Card */}
      <motion.div variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }} className="glass-card p-6 space-y-4">
        <div className="flex items-center gap-2.5 border-b border-white/10 pb-4">
          <div className="w-7 h-7 rounded-md bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
            <Cpu className="h-4 w-4 text-violet-400" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white">Active Checkpoints & Tokenizers</h2>
            <p className="text-[11px] text-slate-400 font-mono">Deterministic models mounted in runtime</p>
          </div>
        </div>

        <div className="divide-y divide-white/5 text-xs">
          <div className="flex items-center justify-between py-2.5">
            <div>
              <div className="font-semibold text-white">Cross-Encoder NLI Engine</div>
              <div className="text-[11px] text-slate-400 font-mono">cross-encoder/nli-deberta-v3-base</div>
            </div>
            <Badge variant="outline" className="font-mono text-[10px] text-violet-300 border-violet-400/30">HuggingFace</Badge>
          </div>

          <div className="flex items-center justify-between py-2.5">
            <div>
              <div className="font-semibold text-white">Dense Semantic Bi-Encoder</div>
              <div className="text-[11px] text-slate-400 font-mono">sentence-transformers/all-MiniLM-L6-v2</div>
            </div>
            <Badge variant="outline" className="font-mono text-[10px] text-indigo-300 border-indigo-400/30">HuggingFace</Badge>
          </div>

          <div className="flex items-center justify-between py-2.5">
            <div>
              <div className="font-semibold text-white">Lexical Inverted Index</div>
              <div className="text-[11px] text-slate-400 font-mono">BM25Okapi (k1=1.5, b=0.75, English Stopwords)</div>
            </div>
            <Badge variant="outline" className="font-mono text-[10px] text-amber-300 border-amber-400/30">Native Ranker</Badge>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}
