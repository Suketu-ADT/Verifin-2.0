import { motion } from "framer-motion"
import { Card, CardContent } from "../components/ui/card"
import { Badge } from "../components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table"
import { Server, AlertCircle } from "lucide-react"

const endpoints = [
  { method: "POST", path: "/api/documents/upload", desc: "Upload a financial document (PDF) and start parsing" },
  { method: "POST", path: "/api/verification/start", desc: "Run verification for an LLM answer against a document" },
  { method: "GET", path: "/api/verification/{id}/results", desc: "Fetch results for a completed verification" },
  { method: "POST", path: "/api/demo/run", desc: "Run the built-in demo verification" },
  { method: "GET", path: "/api/system/health", desc: "Backend health check" },
]

export default function SystemStatus() {
  return (
    <motion.div initial="hidden" animate="show" variants={{ hidden: {}, show: { transition: { staggerChildren: 0.1 } } }} className="max-w-3xl mx-auto space-y-6">
      <motion.div variants={{ hidden: { opacity: 0, y: 15 }, show: { opacity: 1, y: 0 } }}>
        <h1 className="text-2xl font-bold tracking-tight text-white">System Status</h1>
        <p className="text-sm text-slate-500 mt-1">
          Backend API reference. This page shows the endpoints the frontend expects — it does not yet
          poll them live.
        </p>
      </motion.div>

      <motion.div variants={{ hidden: { opacity: 0, scale: 0.98 }, show: { opacity: 1, scale: 1 } }} className="glass-subtle bg-amber-500/5 border border-amber-500/20 rounded-lg p-4 flex items-start gap-3">
        <AlertCircle className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
        <p className="text-xs text-amber-200/80 leading-relaxed">
          This is a final-year academic prototype, not a monitored production service. There is no
          uptime SLA, GPU cluster, or live telemetry — the frontend currently runs against the
          demo dataset shown throughout the app.
        </p>
      </motion.div>

      <motion.div variants={{ hidden: { opacity: 0, scale: 0.98 }, show: { opacity: 1, scale: 1 } }}>
      <Card>
        <div className="p-5 border-b border-white/10 flex items-center gap-3">
          <Server className="h-5 w-5 text-slate-400" />
          <h2 className="text-base font-bold text-white">Backend Endpoints (FastAPI)</h2>
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
