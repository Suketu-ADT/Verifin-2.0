import { motion } from "framer-motion"
import { useState } from "react"
import { Button } from "../components/ui/button"
import { Card, CardContent } from "../components/ui/card"
import { Badge } from "../components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table"
import { Download, CheckCircle2, AlertTriangle, HelpCircle } from "lucide-react"
import { demoSessions, claimCounts, type NLILabel } from "../lib/demoData"

const verdictBadge = (label: NLILabel | undefined) => {
  if (label === "SUPPORTED")
    return <Badge className="bg-emerald-500/10 text-emerald-300 border border-emerald-400/30 rounded gap-1"><CheckCircle2 className="h-3 w-3" /> Supported</Badge>
  if (label === "CONTRADICTED")
    return <Badge className="bg-rose-500/10 text-rose-300 border border-rose-400/30 rounded gap-1"><AlertTriangle className="h-3 w-3" /> Contradicted</Badge>
  return <Badge className="bg-amber-500/10 text-amber-300 border border-amber-400/30 rounded gap-1"><HelpCircle className="h-3 w-3" /> Unverifiable</Badge>
}

export default function Reports() {
  const [sessionId, setSessionId] = useState(demoSessions[0].id)
  const session = demoSessions.find((s) => s.id === sessionId)!
  const counts = claimCounts(session.claims)
  const supportRate = Math.round((counts.supported / counts.total) * 100)

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: "easeOut" }} className="max-w-4xl mx-auto space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Verification Report</h1>
          <p className="text-sm text-slate-500 mt-1">Claim-by-claim breakdown for a single verification session.</p>
        </div>
        <Button variant="outline" className="text-slate-300 hover:text-white">
          <Download className="h-4 w-4" /> Export (not yet implemented)
        </Button>
      </div>

      <div className="flex gap-2">
        {demoSessions.map((s) => (
          <button
            key={s.id}
            onClick={() => setSessionId(s.id)}
            className={`text-xs font-semibold px-3 py-1.5 rounded-md border transition-colors ${
              s.id === sessionId ? "bg-white/10 text-white border-white/20" : "border-white/10 text-slate-400 hover:bg-white/[0.04]"
            }`}
          >
            {s.title}
          </button>
        ))}
      </div>

      <Card>
        <CardContent className="p-5 grid grid-cols-2 gap-6">
          <div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Document</div>
            <div className="text-sm font-semibold text-white">{session.document}</div>
          </div>
          <div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Support Rate</div>
            <div className="text-sm font-semibold text-white">{supportRate}% of claims supported</div>
          </div>
          <div className="col-span-2">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">LLM-generated answer evaluated</div>
            <p className="text-sm font-serif text-slate-300 leading-relaxed">{session.llm_output}</p>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-3 gap-4">
        <Card><CardContent className="p-4 text-center">
          <div className="text-2xl font-bold text-emerald-400">{counts.supported}</div>
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Supported</div>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <div className="text-2xl font-bold text-rose-400">{counts.contradicted}</div>
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Contradicted</div>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <div className="text-2xl font-bold text-amber-400">{counts.unverifiable}</div>
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Unverifiable</div>
        </CardContent></Card>
      </div>

      <Card className="overflow-hidden">
        <Table>
          <TableHeader className="bg-white/[0.03]">
            <TableRow>
              <TableHead className="text-xs uppercase tracking-wider text-slate-400 w-10">#</TableHead>
              <TableHead className="text-xs uppercase tracking-wider text-slate-400">Claim</TableHead>
              <TableHead className="text-xs uppercase tracking-wider text-slate-400">Evidence Page</TableHead>
              <TableHead className="text-xs uppercase tracking-wider text-slate-400">Confidence</TableHead>
              <TableHead className="text-xs uppercase tracking-wider text-slate-400 text-right">Verdict</TableHead>
            </TableRow>
          </TableHeader>
          <motion.tbody variants={{ hidden: {}, show: { transition: { staggerChildren: 0.05 } } }} initial="hidden" animate="show" className="[&_tr:last-child]:border-0">
            {session.claims.map((c, i) => (
              <motion.tr variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } }} key={c.id} className="border-b transition-colors hover:bg-white/[0.04] data-[state=selected]:bg-muted">
                <TableCell className="text-xs font-mono text-slate-400">{String(i + 1).padStart(2, "0")}</TableCell>
                <TableCell className="text-sm text-white">{c.claim_text}</TableCell>
                <TableCell className="text-xs font-mono text-slate-500">
                  {c.evidence && c.evidence.page_number > 0 ? `p. ${c.evidence.page_number}` : "—"}
                </TableCell>
                <TableCell className="text-xs font-mono text-slate-500">{Math.round(c.confidence * 100)}%</TableCell>
                <TableCell className="text-right">{verdictBadge(c.nli?.label)}</TableCell>
              </motion.tr>
            ))}
          </motion.tbody>
        </Table>
      </Card>

      <p className="text-[11px] text-slate-400 text-center">
        Generated from illustrative demo data — not a verified audit of any real filing.
      </p>
    </motion.div>
  )
}
