import { motion } from "framer-motion"
import { Link } from "react-router-dom"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card"
import { Button } from "../components/ui/button"
import { Badge } from "../components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table"
import { FileText, CheckCircle2, AlertTriangle, HelpCircle, Plus } from "lucide-react"
import { BarChart, Bar, XAxis, ResponsiveContainer, Cell } from "recharts"
import { demoSessions, allDemoClaims, claimCounts } from "../lib/demoData"

const counts = claimCounts()
const chartData = [
  { name: "Supported", value: counts.supported, color: "#10b981" },
  { name: "Contradicted", value: counts.contradicted, color: "#f43f5e" },
  { name: "Unverifiable", value: counts.unverifiable, color: "#f59e0b" },
]

const verdictBadge = (label: string | undefined) => {
  if (label === "SUPPORTED")
    return <Badge className="bg-emerald-500/10 text-emerald-300 border border-emerald-400/30 rounded gap-1"><CheckCircle2 className="h-3 w-3" /> Supported</Badge>
  if (label === "CONTRADICTED")
    return <Badge className="bg-rose-500/10 text-rose-300 border border-rose-400/30 rounded gap-1"><AlertTriangle className="h-3 w-3" /> Contradicted</Badge>
  return <Badge className="bg-amber-500/10 text-amber-300 border border-amber-400/30 rounded gap-1"><HelpCircle className="h-3 w-3" /> Unverifiable</Badge>
}

export default function Dashboard() {
  const recentClaims = allDemoClaims.slice(0, 6)

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: "easeOut" }} className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">
            <span>VERIFIN</span><span>/</span><span className="text-slate-300">Dashboard</span>
          </div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-white tracking-tight">Verification Dashboard</h1>
            <Badge variant="outline" className="text-amber-300 border-amber-400/30 bg-amber-500/10">Demo Data</Badge>
          </div>
          <p className="text-slate-500 mt-1 text-sm">
            Overview of verification activity across {demoSessions.length} demo sessions run against the sample Apple FY2025 document.
          </p>
        </div>
        <Link to="/verify">
          <Button>
            <Plus className="h-4 w-4" /> New Verification
          </Button>
        </Link>
      </div>

      <motion.div variants={{ hidden: {}, show: { transition: { staggerChildren: 0.1 } } }} initial="hidden" animate="show" className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <motion.div variants={{ hidden: { opacity: 0, scale: 0.95 }, show: { opacity: 1, scale: 1 } }}>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-semibold tracking-wider text-slate-400 uppercase">Total Claims</CardTitle>
              <FileText className="h-4 w-4 text-slate-400" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-white">{counts.total}</div>
              <div className="text-xs text-slate-500 mt-1">Across {demoSessions.length} demo sessions</div>
            </CardContent>
          </Card>
        </motion.div>
        
        <motion.div variants={{ hidden: { opacity: 0, scale: 0.95 }, show: { opacity: 1, scale: 1 } }}>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-semibold tracking-wider text-emerald-600 uppercase">Supported</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-emerald-600">{counts.supported}</div>
              <div className="text-xs text-slate-500 mt-1">{Math.round((counts.supported / counts.total) * 100)}% of claims</div>
            </CardContent>
          </Card>
        </motion.div>
        
        <motion.div variants={{ hidden: { opacity: 0, scale: 0.95 }, show: { opacity: 1, scale: 1 } }}>
          <Card className="border-rose-400/30">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-semibold tracking-wider text-rose-600 uppercase">Contradicted</CardTitle>
              <AlertTriangle className="h-4 w-4 text-rose-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-rose-600">{counts.contradicted}</div>
              <div className="text-xs text-slate-500 mt-1">{Math.round((counts.contradicted / counts.total) * 100)}% hallucination rate</div>
            </CardContent>
          </Card>
        </motion.div>
        
        <motion.div variants={{ hidden: { opacity: 0, scale: 0.95 }, show: { opacity: 1, scale: 1 } }}>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-semibold tracking-wider text-amber-600 uppercase">Unverifiable</CardTitle>
              <HelpCircle className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-amber-600">{counts.unverifiable}</div>
              <div className="text-xs text-slate-500 mt-1">{Math.round((counts.unverifiable / counts.total) * 100)}% of claims</div>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Claim Distribution</CardTitle>
            <CardDescription>Verdicts across all demo sessions</CardDescription>
          </CardHeader>
          <CardContent className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "#94a3b8" }} />
                <Bar dataKey="value" radius={[4, 4, 0, 0]} barSize={56} animationDuration={700}>
                  {chartData.map((d) => <Cell key={d.name} fill={d.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Demo Sessions</CardTitle>
            <CardDescription>Each session is one LLM answer verified against the sample document</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <motion.div variants={{ hidden: {}, show: { transition: { staggerChildren: 0.05 } } }} initial="hidden" animate="show" className="space-y-3">
            {demoSessions.map((s) => {
              const c = claimCounts(s.claims)
              return (
                <motion.div variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } }} key={s.id} className="flex items-center justify-between border border-white/10 glass-subtle rounded-md p-3">
                  <div>
                    <div className="text-sm font-semibold text-white">{s.title}</div>
                    <div className="text-xs text-slate-400 mt-0.5">{s.claims.length} claims</div>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs font-semibold">
                    {c.supported > 0 && <span className="text-emerald-600">{c.supported} ✓</span>}
                    {c.contradicted > 0 && <span className="text-rose-600">{c.contradicted} ✗</span>}
                    {c.unverifiable > 0 && <span className="text-amber-600">{c.unverifiable} ?</span>}
                  </div>
                </motion.div>
              )
            })}
            </motion.div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between border-b pb-4">
          <div>
            <CardTitle>Recent Claims</CardTitle>
            <CardDescription className="mt-1">Most recently verified claims across all demo sessions</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-white/[0.03]">
              <TableRow>
                <TableHead className="text-xs uppercase tracking-wider text-slate-400 w-10">#</TableHead>
                <TableHead className="text-xs uppercase tracking-wider text-slate-400">Claim</TableHead>
                <TableHead className="text-xs uppercase tracking-wider text-slate-400">Confidence</TableHead>
                <TableHead className="text-xs uppercase tracking-wider text-slate-400">Result</TableHead>
              </TableRow>
            </TableHeader>
            <motion.tbody variants={{ hidden: {}, show: { transition: { staggerChildren: 0.05 } } }} initial="hidden" animate="show" className="[&_tr:last-child]:border-0">
              {recentClaims.map((c, i) => (
                <motion.tr variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } }} key={c.id} className="border-b transition-colors hover:bg-white/[0.04] data-[state=selected]:bg-muted">
                  <TableCell className="text-xs font-mono text-slate-400">{String(i + 1).padStart(2, "0")}</TableCell>
                  <TableCell className="text-sm font-medium text-white">{c.claim_text}</TableCell>
                  <TableCell className="text-xs font-mono text-slate-500">{Math.round((c.confidence ?? 0) * 100)}%</TableCell>
                  <TableCell>{verdictBadge(c.nli?.label)}</TableCell>
                </motion.tr>
              ))}
            </motion.tbody>
          </Table>
        </CardContent>
      </Card>
    </motion.div>
  )
}
