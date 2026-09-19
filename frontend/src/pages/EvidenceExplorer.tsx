import { motion } from "framer-motion"
import { useState } from "react"
import { Badge } from "../components/ui/badge"
import { CheckCircle2, AlertTriangle, HelpCircle, FileText, Search } from "lucide-react"
import { allDemoClaims, type DemoClaim, type NLILabel } from "../lib/demoData"

const verdictMeta = (label: NLILabel | undefined) => {
  if (label === "SUPPORTED") return { icon: CheckCircle2, color: "text-emerald-400", dot: "bg-emerald-400" }
  if (label === "CONTRADICTED") return { icon: AlertTriangle, color: "text-rose-400", dot: "bg-rose-400" }
  return { icon: HelpCircle, color: "text-amber-400", dot: "bg-amber-400" }
}

export default function EvidenceExplorer() {
  const [selectedId, setSelectedId] = useState<string>(allDemoClaims[0].id)
  const [query, setQuery] = useState("")

  const filtered = allDemoClaims.filter((c) =>
    c.claim_text.toLowerCase().includes(query.toLowerCase())
  )
  const selected: DemoClaim = allDemoClaims.find((c) => c.id === selectedId) ?? allDemoClaims[0]
  const selectedMeta = verdictMeta(selected.nli?.label)

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: "easeOut" }} className="flex flex-col h-full -m-6">
      <div className="px-6 py-4 glass-strong border-b border-white/10 flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-lg font-bold tracking-tight text-white">Evidence Explorer</h1>
          <p className="text-xs text-slate-500 mt-0.5">Browse every claim from the demo sessions alongside its retrieved evidence.</p>
        </div>
        <Badge variant="outline" className="text-amber-300 border-amber-400/30 bg-amber-500/10">Demo Data</Badge>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Claim list */}
        <div className="w-[38%] border-r border-white/10 glass-subtle overflow-y-auto">
          <div className="p-3 border-b border-white/10 bg-black/20 sticky top-0 backdrop-blur-md">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search claims..."
                className="h-8 w-full rounded-md border border-white/10 bg-white/[0.04] pl-8 pr-3 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500/50"
              />
            </div>
          </div>
          <motion.div variants={{ hidden: {}, show: { transition: { staggerChildren: 0.05 } } }} initial="hidden" animate="show" className="divide-y divide-white/5">
            {filtered.map((c) => {
              const meta = verdictMeta(c.nli?.label)
              const active = c.id === selectedId
              return (
                <motion.button
                  variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } }}
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  transition={{ duration: 0.15 }}
                  key={c.id}
                  onClick={() => setSelectedId(c.id)}
                  className={`w-full text-left p-3.5 transition-colors ${active ? "bg-amber-500/20" : "hover:bg-white/[0.05]"}`}
                >
                  <div className="flex items-start gap-2">
                    <span className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${meta.dot}`} />
                    <p className="text-xs font-medium text-slate-200 leading-snug">{c.claim_text}</p>
                  </div>
                </motion.button>
              )
            })}
          </motion.div>
        </div>

        {/* Detail */}
        <div className="flex-1 overflow-y-auto p-6 glass-strong">
          <div className="max-w-xl">
            <div className="flex items-center gap-2 mb-4">
              <selectedMeta.icon className={`h-4 w-4 ${selectedMeta.color}`} />
              <span className={`text-xs font-bold uppercase tracking-widest ${selectedMeta.color}`}>
                {selected.nli?.label}
              </span>
            </div>

            <p className="text-base font-serif text-white leading-relaxed mb-6">"{selected.claim_text}"</p>

            {selected.nli && (
              <div className="mb-6">
                <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden flex mb-2">
                  <motion.div initial={{ width: 0 }} animate={{ width: `${selected.nli.entailment * 100}%` }} transition={{ duration: 0.6, ease: "easeOut", delay: 0.1 }} className="h-full bg-emerald-500" />
                  <motion.div initial={{ width: 0 }} animate={{ width: `${selected.nli.neutral * 100}%` }} transition={{ duration: 0.6, ease: "easeOut", delay: 0.15 }} className="h-full bg-slate-300" />
                  <motion.div initial={{ width: 0 }} animate={{ width: `${selected.nli.contradiction * 100}%` }} transition={{ duration: 0.6, ease: "easeOut", delay: 0.2 }} className="h-full bg-rose-500" />
                </div>
                <div className="flex justify-between text-[10px] font-mono text-slate-500">
                  <span>Entail {(selected.nli.entailment * 100).toFixed(0)}%</span>
                  <span>Neutral {(selected.nli.neutral * 100).toFixed(0)}%</span>
                  <span>Contradict {(selected.nli.contradiction * 100).toFixed(0)}%</span>
                </div>
              </div>
            )}

            <div className="glass-subtle border border-white/10 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Document Excerpt</div>
                {selected.evidence && selected.evidence.page_number > 0 && (
                  <div className="flex items-center gap-1 text-[11px] font-mono text-slate-500">
                    <FileText className="h-3 w-3" /> p. {selected.evidence.page_number}
                  </div>
                )}
              </div>
              <p className="text-sm font-serif italic text-slate-300 leading-relaxed">
                {selected.evidence && selected.evidence.page_number > 0
                  ? `"${selected.evidence.text}"`
                  : "No matching passage was retrieved from the source document."}
              </p>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
