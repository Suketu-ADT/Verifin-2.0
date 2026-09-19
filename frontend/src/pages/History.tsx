import { motion } from "framer-motion"
import { useState } from "react"
import { Link } from "react-router-dom"
import { Card, CardContent } from "../components/ui/card"
import { Badge } from "../components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table"
import { FileText, ChevronRight } from "lucide-react"
import { demoSessions, claimCounts } from "../lib/demoData"

type Filter = "all" | "clean" | "flagged"

export default function History() {
  const [filter, setFilter] = useState<Filter>("all")

  const rows = demoSessions.filter((s) => {
    if (filter === "all") return true
    const c = claimCounts(s.claims)
    return filter === "flagged" ? c.contradicted > 0 : c.contradicted === 0
  })

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: "easeOut" }} className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">
            <span>VERIFIN</span><ChevronRight className="h-3 w-3" /><span className="text-slate-300">History</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Verification History</h1>
          <p className="text-sm text-slate-500 mt-1">Every demo verification session, most recent first.</p>
        </div>
        <Badge variant="outline" className="text-amber-300 border-amber-400/30 bg-amber-500/10">Demo Data</Badge>
      </div>

      <div className="flex items-center gap-1 glass-subtle border border-white/10 rounded-lg p-1 w-fit">
        {(["all", "flagged", "clean"] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
              filter === f ? "bg-white/10 text-white" : "text-slate-400 hover:text-white"
            }`}
          >
            {f === "all" ? "All sessions" : f === "flagged" ? "With contradictions" : "Clean"}
          </button>
        ))}
      </div>

      <Card className="overflow-hidden">
        <Table>
          <TableHeader className="bg-white/[0.03]">
            <TableRow>
              <TableHead className="text-xs uppercase tracking-wider text-slate-400">Session</TableHead>
              <TableHead className="text-xs uppercase tracking-wider text-slate-400">Document</TableHead>
              <TableHead className="text-xs uppercase tracking-wider text-slate-400 text-center">Claims (S/C/U)</TableHead>
              <TableHead className="text-xs uppercase tracking-wider text-slate-400">Run At</TableHead>
              <TableHead className="text-xs uppercase tracking-wider text-slate-400 text-right">Open</TableHead>
            </TableRow>
          </TableHeader>
          <motion.tbody variants={{ hidden: {}, show: { transition: { staggerChildren: 0.05 } } }} initial="hidden" animate="show" className="[&_tr:last-child]:border-0">
            {rows.map((s) => {
              const c = claimCounts(s.claims)
              return (
                <motion.tr variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } }} key={s.id} className="border-b transition-colors hover:bg-white/[0.04] data-[state=selected]:bg-muted">
                  <TableCell className="font-semibold text-sm text-white">{s.title}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                      <FileText className="h-3.5 w-3.5" /> {s.document}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <span className="text-xs font-mono">
                      <span className="text-emerald-400 font-bold">{c.supported}</span> /{" "}
                      <span className="text-rose-400 font-bold">{c.contradicted}</span> /{" "}
                      <span className="text-amber-400 font-bold">{c.unverifiable}</span>
                    </span>
                  </TableCell>
                  <TableCell className="text-xs font-mono text-slate-500">
                    {new Date(s.ran_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </TableCell>
                  <TableCell className="text-right">
                    <Link to={`/verify/results/${s.id}`}>
                      <motion.div whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }} transition={{ duration: 0.15 }} className="inline-block">
                        <Badge variant="outline" className="cursor-pointer hover:bg-white/10 text-white">View results</Badge>
                      </motion.div>
                    </Link>
                  </TableCell>
                </motion.tr>
              )
            })}
          </motion.tbody>
        </Table>
      </Card>
    </motion.div>
  )
}
