import { motion } from "framer-motion"
import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { Button } from "../components/ui/button"
import { Card, CardContent } from "../components/ui/card"
import { Badge } from "../components/ui/badge"
import { Textarea } from "../components/ui/textarea"
import {
  FileUp, ShieldCheck, FileText, CheckCircle2, ArrowRight,
  FileSearch, Search, Cpu, Scale, Sparkles,
} from "lucide-react"
import { demoSessions } from "../lib/demoData"

const stages = [
  { icon: FileText, label: "Claim Decomposition" },
  { icon: Search, label: "Evidence Retrieval" },
  { icon: Cpu, label: "NLI Verification" },
  { icon: Scale, label: "Consistency Checks" },
]

export default function VerificationFlow() {
  const navigate = useNavigate()
  const [fileName, setFileName] = useState<string | null>(null)
  const [answer, setAnswer] = useState("")
  const [selectedSample, setSelectedSample] = useState<string | null>(null)

  const loadSample = (sessionId: string) => {
    const session = demoSessions.find((s) => s.id === sessionId)
    if (!session) return
    setFileName(session.document)
    setAnswer(session.llm_output)
    setSelectedSample(sessionId)
  }

  const handleSubmit = () => {
    // Demo mode: route to the matching pre-computed demo session's results.
    // A real submission would POST to /api/documents/upload then /api/verification/start.
    const target = selectedSample ?? demoSessions[0].id
    navigate(`/verify/results/${target}`)
  }

  const canSubmit = Boolean(fileName) && answer.trim().length > 0

  return (
    <motion.div initial="hidden" animate="show" variants={{ hidden: {}, show: { transition: { staggerChildren: 0.1 } } }} className="max-w-5xl mx-auto space-y-6">
      <motion.div variants={{ hidden: { opacity: 0, y: 15 }, show: { opacity: 1, y: 0 } }}>
        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">
          <Badge className="bg-white/10 text-slate-300 border-none rounded font-mono text-[9px]">New Verification</Badge>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-white mb-2">Verify a Financial Claim</h1>
        <p className="text-sm text-slate-500 max-w-2xl">
          Upload the source financial document, paste the LLM-generated answer you want checked, and VERIFIN
          will decompose it into claims and verify each one against the document.
        </p>
      </motion.div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Left: document */}
        <motion.div variants={{ hidden: { opacity: 0, x: -20 }, show: { opacity: 1, x: 0 } }}>
        <Card className="border-white/10 h-full">
          <div className="p-5 border-b border-white/10 flex items-center gap-3 bg-white/[0.02] rounded-t-2xl">
            <FileUp className="h-5 w-5 text-slate-700" />
            <h2 className="text-base font-bold text-white">Step 1 · Source Document</h2>
          </div>
          <CardContent className="p-6 space-y-4">
            {!fileName ? (
              <label className="border-2 border-dashed border-white/15 rounded-xl glass-subtle p-8 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-white/[0.05] transition-colors">
                <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center mb-3">
                  <ShieldCheck className="h-5 w-5 text-slate-400" />
                </div>
                <p className="text-sm font-semibold text-slate-300 mb-1">Drop a financial document, or browse files</p>
                <p className="text-[11px] text-slate-400">PDF · 10-K, 10-Q, earnings transcripts</p>
                <input
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && setFileName(e.target.files[0].name)}
                />
              </label>
            ) : (
              <div className="flex items-center justify-between glass-subtle border border-white/10 rounded-lg p-3.5">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded glass-strong text-white flex items-center justify-center shrink-0">
                    <FileText className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-white truncate">{fileName}</div>
                    <div className="text-[11px] text-emerald-400 flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Ready</div>
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => { setFileName(null); setSelectedSample(null) }}>Remove</Button>
              </div>
            )}

            <div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Or try a sample</div>
              <motion.div variants={{ hidden: {}, show: { transition: { staggerChildren: 0.05 } } }} initial="hidden" animate="show" className="flex flex-col gap-2">
                {demoSessions.map((s) => (
                  <motion.button
                    variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } }}
                    key={s.id}
                    onClick={() => loadSample(s.id)}
                    className={`text-left text-xs font-medium px-3 py-2 rounded border transition-colors ${
                      selectedSample === s.id
                        ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
                        : "border-white/10 text-slate-400 hover:bg-white/[0.04]"
                    }`}
                  >
                    <Sparkles className="h-3 w-3 inline mr-1.5 -mt-0.5" /> {s.title}
                  </motion.button>
                ))}
              </motion.div>
            </div>
          </CardContent>
        </Card>
        </motion.div>

        {/* Right: LLM answer */}
        <motion.div variants={{ hidden: { opacity: 0, x: 20 }, show: { opacity: 1, x: 0 } }}>
        <Card className="border-white/10 h-full">
          <div className="p-5 border-b border-white/10 flex items-center gap-3 bg-white/[0.02] rounded-t-2xl">
            <FileSearch className="h-5 w-5 text-slate-700" />
            <h2 className="text-base font-bold text-white">Step 2 · LLM-Generated Answer</h2>
          </div>
          <CardContent className="p-6 space-y-4">
            <Textarea
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="Paste the LLM's generated summary or answer here — e.g. &quot;Revenue increased 12% this year, driven by strong iPhone demand...&quot;"
              className="min-h-[160px] text-sm font-serif bg-transparent border-white/10 focus-visible:ring-amber-500"
            />
            <div className="text-[11px] text-slate-400">{answer.length} characters</div>

            <div className="glass-subtle border border-white/10 rounded-lg p-4">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">What happens next</div>
              <div className="grid grid-cols-2 gap-3">
                {stages.map((s) => (
                  <div key={s.label} className="flex items-center gap-2 text-xs font-medium text-slate-300">
                    <s.icon className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                    {s.label}
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
        </motion.div>
      </div>

      <motion.div variants={{ hidden: { opacity: 0, y: 15 }, show: { opacity: 1, y: 0 } }} className="flex justify-end">
        <Button
          disabled={!canSubmit}
          onClick={handleSubmit}
          className="h-11 px-6"
        >
          Run Verification <ArrowRight className="h-4 w-4" />
        </Button>
      </motion.div>
    </motion.div>
  )
}
