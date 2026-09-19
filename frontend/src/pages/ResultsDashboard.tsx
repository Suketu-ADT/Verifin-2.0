import { motion } from "framer-motion"
import { useParams, Link } from "react-router-dom"
import { Card, CardContent } from "../components/ui/card"
import { Badge } from "../components/ui/badge"
import { Button } from "../components/ui/button"
import { CheckCircle2, AlertTriangle, HelpCircle, ArrowLeft, ChevronRight, FileText } from "lucide-react"
import { demoSessions, claimCounts, type NLILabel } from "../lib/demoData"

const verdictMeta = (label: NLILabel | undefined) => {
  if (label === "SUPPORTED") return { icon: CheckCircle2, text: "text-emerald-300", bg: "bg-emerald-500/10 border-emerald-400/30", label: "Supported" }
  if (label === "CONTRADICTED") return { icon: AlertTriangle, text: "text-rose-300", bg: "bg-rose-500/10 border-rose-400/30", label: "Contradicted" }
  return { icon: HelpCircle, text: "text-amber-300", bg: "bg-amber-500/10 border-amber-400/30", label: "Unverifiable" }
}

export default function ResultsDashboard() {
  const { id } = useParams()
  const session = demoSessions.find((s) => s.id === id)

  if (!session) {
    return (
      <div className="max-w-2xl mx-auto text-center py-20">
        <h1 className="text-xl font-bold text-white mb-2">Verification not found</h1>
        <p className="text-sm text-slate-400 mb-6">
          Session "{id}" doesn't exist. In demo mode, only the pre-computed sample sessions are available.
        </p>
        <Link to="/verify"><Button>Start a new verification</Button></Link>
      </div>
    )
  }

  const counts = claimCounts(session.claims)
  const overallScore = Math.round((counts.supported / counts.total) * 100)

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: "easeOut" }} className="space-y-6">
      <div>
        <Link to="/verify" className="inline-flex items-center text-xs font-semibold text-slate-400 hover:text-white mb-3">
          <ArrowLeft className="h-3.5 w-3.5 mr-1" /> New verification
        </Link>
        <div className="flex items-center gap-2 mb-1.5">
          <h1 className="text-2xl font-bold tracking-tight text-white">{session.title}</h1>
          <Badge variant="outline" className="text-amber-300 border-amber-400/30 bg-amber-500/10">Demo Data</Badge>
        </div>
        <div className="flex items-center gap-1.5 text-sm text-slate-400">
          <FileText className="h-3.5 w-3.5" /> {session.document}
        </div>
      </div>

      <div className="glass-subtle border border-white/10 rounded-lg p-5 space-y-3">
        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">LLM-generated answer under review</div>
        <p className="text-sm font-serif text-slate-200 leading-relaxed">{session.llm_output}</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="p-4">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Claims Checked</div>
          <div className="text-2xl font-bold text-white">{counts.total}</div>
        </CardContent></Card>
        <Card className="border-emerald-400/30"><CardContent className="p-4">
          <div className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest mb-1">Supported</div>
          <div className="text-2xl font-bold text-emerald-400">{counts.supported}</div>
        </CardContent></Card>
        <Card className="border-rose-400/30"><CardContent className="p-4">
          <div className="text-[10px] font-bold text-rose-400 uppercase tracking-widest mb-1">Contradicted</div>
          <div className="text-2xl font-bold text-rose-400">{counts.contradicted}</div>
        </CardContent></Card>
        <Card className="border-amber-400/30"><CardContent className="p-4">
          <div className="text-[10px] font-bold text-amber-400 uppercase tracking-widest mb-1">Unverifiable</div>
          <div className="text-2xl font-bold text-amber-400">{counts.unverifiable}</div>
        </CardContent></Card>
      </div>

      <div className="glass-subtle border border-white/10 rounded-lg p-4 flex items-center justify-between">
        <span className="text-sm font-semibold text-slate-300">Overall support rate</span>
        <span className="text-sm font-bold text-white">{overallScore}% of claims supported by the source document</span>
      </div>

      <motion.div variants={{ hidden: {}, show: { transition: { staggerChildren: 0.05 } } }} initial="hidden" animate="show" className="space-y-3">
        <h2 className="text-sm font-bold text-slate-500 uppercase tracking-widest">Claim-by-claim verification</h2>
        {session.claims.map((c, i) => {
          const meta = verdictMeta(c.nli?.label)
          return (
            <Link key={c.id} to={`/verify/results/${session.id}/claim/${c.id}`} className="block">
              <motion.div variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } }} whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }} transition={{ duration: 0.15 }}>
                <Card className={`hover:bg-white/[0.04] transition-colors border ${meta.bg}`}>
                <CardContent className="p-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-xs font-mono text-slate-400 shrink-0">{String(i + 1).padStart(2, "0")}</span>
                    <meta.icon className={`h-4 w-4 shrink-0 ${meta.text}`} />
                    <p className="text-sm font-medium text-white truncate">{c.claim_text}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className={`text-xs font-bold uppercase tracking-wide ${meta.text}`}>{meta.label}</span>
                    <ChevronRight className="h-4 w-4 text-slate-400" />
                  </div>
                </CardContent>
              </Card>
              </motion.div>
            </Link>
          )
        })}
      </motion.div>
    </motion.div>
  )
}
