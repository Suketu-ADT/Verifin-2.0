import { motion } from "framer-motion"
import { useEffect, useState } from "react"
import { Badge } from "../components/ui/badge"
import { ChevronRight, Sliders } from "lucide-react"
import { getEngineConfig, type EngineConfig } from "../lib/api"

function Row({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 py-2.5 border-b border-white/5 last:border-0">
      <div>
        <div className="text-xs font-semibold text-slate-200">{label}</div>
        {note && <div className="text-[11px] text-slate-500">{note}</div>}
      </div>
      <div className="font-mono text-xs text-amber-300 break-all text-right">{value}</div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="glass-card p-5">
      <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-1">{title}</h2>
      {children}
    </div>
  )
}

export default function Settings() {
  const [config, setConfig] = useState<EngineConfig | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getEngineConfig()
      .then(setConfig)
      .catch((err: any) => setError(err?.message || "Could not load the engine configuration."))
  }, [])

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="max-w-4xl mx-auto space-y-6">
      <div>
        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5 font-mono">
          <span>VERIFIN</span>
          <ChevronRight className="h-3 w-3 text-slate-600" />
          <span className="text-amber-400">Engine configuration</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
          <Sliders className="h-5 w-5 text-amber-400" /> Engine Configuration
        </h1>
        <p className="text-xs text-slate-400 mt-1 max-w-2xl">
          What the engine is running with right now. These values are set in the server's environment, not in the
          browser, so they are shown here but cannot be changed from this page. Every report records the same values in
          its provenance block.
        </p>
      </div>

      {error && <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-300 text-xs">{error}</div>}
      {!config && !error && <div className="text-xs text-slate-400">Loading…</div>}

      {config && (
        <div className="space-y-4">
          <Section title="Pipeline">
            <Row label="Pipeline version" value={config.pipeline_version} note="Stamped on every verification" />
            <Row label="Disabled checks" value={config.policy.disabled_checks.join(", ") || "none"} />
          </Section>

          <Section title="Models">
            <Row label="Embedding" value={config.models.embedding} />
            <Row label="Natural-language inference" value={config.models.nli} />
            <Row label="Reranker" value={config.models.reranker ?? "off"} />
            <Row label="Claim-extraction LLM" value={`${config.llm.provider}${config.llm.model ? ` / ${config.llm.model}` : ""}`} note="Used only to split a statement into claims, never to decide a verdict" />
          </Section>

          <Section title="Retrieval">
            <Row label="Mode" value={config.retrieval.mode} />
            <Row label="Fusion" value={config.retrieval.fusion.toUpperCase()} />
            <Row label="Passages per claim" value={String(config.retrieval.top_k)} />
          </Section>

          <Section title="Verdict policy">
            <Row label="Support threshold (NLI)" value={config.policy.nli_support_threshold.toFixed(2)} />
            <Row label="Contradiction threshold (NLI)" value={config.policy.nli_contradiction_threshold.toFixed(2)} />
            <Row label="NLI aggregation" value={config.policy.aggregation} />
            <Row label="Grounded-support overlap" value={config.policy.grounded_support_min_overlap.toFixed(2)} />
            <Row label="Multi-figure support overlap" value={config.policy.multi_figure_support_min_overlap.toFixed(2)} />
          </Section>

          <Section title="Scanned documents">
            <Row label="OCR confidence floor" value={`${config.ocr.confidence_threshold}%`} note="Figures read below this go to the Review Queue" />
          </Section>
        </div>
      )}
      <Badge variant="outline" className="text-[10px] text-slate-400 border-white/10">Read-only</Badge>
    </motion.div>
  )
}
