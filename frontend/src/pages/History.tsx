import { useState } from "react"
import { Button } from "../components/ui/button"
import { Card, CardContent } from "../components/ui/card"
import { Badge } from "../components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table"
import { Input } from "../components/ui/input"
import { 
  Search, Download, Copy, ChevronRight, ChevronLeft, Calendar, ShieldCheck,
  AlertTriangle, XCircle, FileText, ArrowUp, Lock, CheckCircle2, ChevronDown
} from "lucide-react"

// Mock Data
const auditHistory = [
  {
    id: "#VRF-2025-0984", hash: "0x8f3c...a24b",
    company: "Apple Inc.", ticker: "AAPL", filing: "FY25 10-K",
    query: "Revenue growth & services ma...", span: "Span: p. 44, Section 7",
    model: "GPT-4o-FinAudit",
    claims: { s: 4, c: 1, u: 0 },
    score: 64, scoreLabel: "HIGH RISK", scoreColor: "text-rose-500", scoreBg: "bg-rose-100 dark:bg-rose-950",
    verdict: "CONTRADICTION", verdictIcon: XCircle, verdictColor: "text-rose-500", verdictBorder: "border-rose-500/30",
    time: "Oct 18 14:32"
  },
  {
    id: "#VRF-2025-0983", hash: "0x1a12...93ec",
    company: "Tesla Inc.", ticker: "TSLA", filing: "FY24 10-K",
    query: "Total debt maturity schedule", span: "Span: p. 82, Note 12",
    model: "Claude-3.5-Sonnet",
    claims: { s: 5, c: 2, u: 0 },
    score: 58, scoreLabel: "CRITICAL", scoreColor: "text-rose-500", scoreBg: "bg-rose-100 dark:bg-rose-950", delta: "Mismatch $1.2B",
    verdict: "CONTRADICTION", verdictIcon: XCircle, verdictColor: "text-rose-500", verdictBorder: "border-rose-500/30",
    time: "Oct 18 11:15"
  },
  {
    id: "#VRF-2025-0982", hash: "0x71a9...b871",
    company: "Nvidia Corp", ticker: "NVDA", filing: "Q3 10-Q",
    query: "Data center cloud gross margin", span: "Span: p. 19, Item 2",
    model: "Llama-3-70B-Fin",
    claims: { s: 6, c: 0, u: 0 },
    score: 98, scoreLabel: "PRISTINE", scoreColor: "text-indigo-500", scoreBg: "bg-indigo-100 dark:bg-indigo-950", delta: "NLI Logit: 0.994",
    verdict: "VERIFIED", verdictIcon: CheckCircle2, verdictColor: "text-emerald-500", verdictBorder: "border-emerald-500/30",
    time: "Oct 17 21:40"
  },
  {
    id: "#VRF-2025-0981", hash: "0x33b1...881f",
    company: "Alphabet Inc.", ticker: "GOOGL", filing: "10-K FY24",
    query: "Search ad revenue YoY", span: "Span: p. 32, MD&A",
    model: "GPT-4o-FinAudit",
    claims: { s: 5, c: 0, u: 0 },
    score: 91, scoreLabel: "HIGH", scoreColor: "text-emerald-500", scoreBg: "bg-emerald-100 dark:bg-emerald-950", delta: "NLI Logit: 0.932",
    verdict: "VERIFIED", verdictIcon: CheckCircle2, verdictColor: "text-emerald-500", verdictBorder: "border-emerald-500/30",
    time: "Oct 17 18:05"
  },
  {
    id: "#VRF-2025-0980", hash: "0x9c42...315f",
    company: "Amazon.com", ticker: "AMZN", filing: "FY24 10-K",
    query: "AWS operating income delta", span: "Span: p. 57, Segment Data",
    model: "Mistral-Large-Quant",
    claims: { s: 3, c: 1, u: 1 },
    score: 82, scoreLabel: "MODERATE", scoreColor: "text-blue-500", scoreBg: "bg-blue-100 dark:bg-blue-950", delta: "1 Unverifiable Span",
    verdict: "REVIEW REQUIRED", verdictIcon: AlertTriangle, verdictColor: "text-amber-500", verdictBorder: "border-amber-500/30",
    time: "Oct 16 15:21"
  },
  {
    id: "#VRF-2025-0979", hash: "0x12a8...612d",
    company: "Meta Platforms", ticker: "META", filing: "10-K FY24",
    query: "CapEx AI infrastructure", span: "Span: p. 48, Liquidity",
    model: "Llama-3-70B-Fin",
    claims: { s: 8, c: 0, u: 0 },
    score: 95, scoreLabel: "HIGH", scoreColor: "text-emerald-500", scoreBg: "bg-emerald-100 dark:bg-emerald-950", delta: "Exact Match",
    verdict: "VERIFIED", verdictIcon: CheckCircle2, verdictColor: "text-emerald-500", verdictBorder: "border-emerald-500/30",
    time: "Oct 16 09:14"
  },
  {
    id: "#VRF-2025-0978", hash: "0x5c77...11a9",
    company: "Berkshire Hathaway", ticker: "BRK.B", filing: "10-Q Q2",
    query: "Cash equivalents & treasury fl...", span: "Span: p. 12, Schedule 1",
    model: "Claude-3.5-Sonnet",
    claims: { s: 4, c: 0, u: 2 },
    score: 78, scoreLabel: "MODERATE", scoreColor: "text-blue-500", scoreBg: "bg-blue-100 dark:bg-blue-950", delta: "Ambiguous Treasury",
    verdict: "REVIEW REQUIRED", verdictIcon: AlertTriangle, verdictColor: "text-amber-500", verdictBorder: "border-amber-500/30",
    time: "Oct 15 16:42"
  }
]

const ClaimsBar = ({ claims }: { claims: { s: number, c: number, u: number } }) => {
  const total = claims.s + claims.c + claims.u;
  const sPct = (claims.s / total) * 100;
  const cPct = (claims.c / total) * 100;
  const uPct = (claims.u / total) * 100;
  
  return (
    <div className="w-24">
      <div className="flex justify-between text-[10px] font-bold mb-1 px-1">
        <span className={claims.s > 0 ? "text-emerald-500" : "text-transparent"}>{claims.s}</span>
        <span className={claims.c > 0 ? "text-rose-500" : "text-transparent"}>{claims.c}</span>
        <span className={claims.u > 0 ? "text-amber-500" : "text-transparent"}>{claims.u}</span>
      </div>
      <div className="h-1.5 w-full flex overflow-hidden bg-slate-100 rounded-sm">
        {sPct > 0 && <div className="bg-emerald-500 h-full border-r border-white dark:border-slate-900" style={{ width: `${sPct}%` }}></div>}
        {cPct > 0 && <div className="bg-rose-500 h-full border-r border-white dark:border-slate-900" style={{ width: `${cPct}%` }}></div>}
        {uPct > 0 && <div className="bg-amber-500 h-full" style={{ width: `${uPct}%` }}></div>}
      </div>
    </div>
  )
}

export default function History() {
  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-background relative pb-8">
      
      {/* Header */}
      <div className="px-6 py-4 bg-white dark:bg-slate-950 border-b">
        <div className="flex items-center text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-4 space-x-2">
          <span>VERIFIN</span>
          <ChevronRight className="h-3 w-3" />
          <span>Governance & Compliance</span>
          <ChevronRight className="h-3 w-3" />
          <span className="text-foreground">Audit History Archive</span>
        </div>
        
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Verification History & Compliance Archive</h1>
            <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
              Searchable audit trail of all automated financial LLM fact-checking runs with cryptographic verification hashes and deterministic claim attribution.
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <Button variant="outline" className="text-sm font-semibold h-9">
              <Calendar className="mr-2 h-4 w-4 text-muted-foreground" /> All-Time Ledger <ChevronDown className="ml-2 h-4 w-4" />
            </Button>
            <Button className="text-sm font-semibold h-9 bg-slate-900 text-white hover:bg-slate-800">
              <Download className="mr-2 h-4 w-4" /> Export Full Ledger <span className="ml-1 text-[10px] opacity-70 bg-white/20 px-1 rounded">CSV/JSON</span>
            </Button>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6 flex-1">
        {/* Metrics Row */}
        <div className="grid grid-cols-4 gap-4">
          <Card className="shadow-sm border-slate-200">
            <CardContent className="p-4 flex flex-col justify-between h-full">
              <div className="flex justify-between items-start mb-2">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Audited Files</div>
                <FileText className="h-4 w-4 text-slate-400" />
              </div>
              <div className="text-3xl font-black text-slate-900 dark:text-white">128</div>
              <div className="flex justify-between text-xs font-semibold mt-3 pt-3 border-t border-slate-100">
                <span className="text-slate-500">10-K & 10-Q</span>
                <span className="text-slate-700">100% SEC Synchronized</span>
              </div>
            </CardContent>
          </Card>
          
          <Card className="shadow-sm border-slate-200">
            <CardContent className="p-4 flex flex-col justify-between h-full">
              <div className="flex justify-between items-start mb-2">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Discrepancies Caught</div>
                <div className="bg-rose-100 text-rose-600 rounded px-1 text-[10px] font-bold">=!</div>
              </div>
              <div className="text-3xl font-black text-rose-600">248</div>
              <div className="flex justify-between text-xs font-semibold mt-3 pt-3 border-t border-slate-100">
                <span className="text-slate-500">Numerical & Delta Inaccuracies</span>
                <span className="text-rose-500">+14 this week</span>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm border-slate-200">
            <CardContent className="p-4 flex flex-col justify-between h-full">
              <div className="flex justify-between items-start mb-2">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Prevented Hallucination</div>
                <ShieldCheck className="h-4 w-4 text-blue-500" />
              </div>
              <div className="text-3xl font-black text-slate-900 dark:text-white">$42.8M</div>
              <div className="flex justify-between text-xs font-semibold mt-3 pt-3 border-t border-slate-100">
                <span className="text-slate-500">Estimated Misallocation Risk</span>
                <span className="text-slate-700">VAR Tier-1</span>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm border-slate-200">
            <CardContent className="p-4 flex flex-col justify-between h-full">
              <div className="flex justify-between items-start mb-2">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Compliance Coverage</div>
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              </div>
              <div className="text-3xl font-black text-emerald-500">100.0%</div>
              <div className="flex justify-between text-xs font-semibold mt-3 pt-3 border-t border-slate-100">
                <span className="text-slate-500">SEC/EDGAR Automated Index</span>
                <span className="text-emerald-600">ZERO BLIND SPOTS</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex items-center justify-between bg-white dark:bg-slate-950 p-2 rounded-lg border shadow-sm">
          <div className="relative w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input className="h-9 pl-9 bg-slate-50 dark:bg-slate-900 border-none text-xs font-medium" placeholder="Search by ticker, claim, hash..." />
          </div>
          <div className="flex space-x-1 p-1">
            <Button size="sm" className="h-7 text-[10px] font-bold bg-slate-900 text-white hover:bg-slate-800 rounded-md">ALL (1,842)</Button>
            <Button size="sm" variant="ghost" className="h-7 text-[10px] font-bold text-slate-500 hover:text-slate-900 rounded-md"><span className="w-2 h-2 rounded-full bg-emerald-500 mr-1.5"></span> VERIFIED (1,492)</Button>
            <Button size="sm" variant="ghost" className="h-7 text-[10px] font-bold text-slate-500 hover:text-slate-900 rounded-md"><span className="w-2 h-2 rounded-full bg-rose-500 mr-1.5"></span> CONTRADICTIONS (248)</Button>
            <Button size="sm" variant="ghost" className="h-7 text-[10px] font-bold text-slate-500 hover:text-slate-900 rounded-md"><span className="w-2 h-2 rounded-full bg-amber-500 mr-1.5"></span> UNVERIFIABLE (102)</Button>
            <Button size="sm" variant="ghost" className="h-7 text-[10px] font-bold text-slate-500 hover:text-slate-900 rounded-md"><AlertTriangle className="w-3 h-3 text-rose-500 mr-1.5" /> HIGH RISK (47)</Button>
          </div>
        </div>

        {/* Table */}
        <Card className="border-slate-200 shadow-sm overflow-hidden">
          <Table>
            <TableHeader className="bg-slate-50 dark:bg-slate-900">
              <TableRow>
                <TableHead className="text-[10px] font-bold uppercase tracking-widest text-slate-500 h-10">Audit ID & Hash</TableHead>
                <TableHead className="text-[10px] font-bold uppercase tracking-widest text-slate-500 h-10">Target Asset / Filing</TableHead>
                <TableHead className="text-[10px] font-bold uppercase tracking-widest text-slate-500 h-10">Financial Query Tested</TableHead>
                <TableHead className="text-[10px] font-bold uppercase tracking-widest text-slate-500 h-10">Model Under Test</TableHead>
                <TableHead className="text-[10px] font-bold uppercase tracking-widest text-slate-500 h-10 text-center">Claims S/C/U</TableHead>
                <TableHead className="text-[10px] font-bold uppercase tracking-widest text-slate-500 h-10">Trust Score</TableHead>
                <TableHead className="text-[10px] font-bold uppercase tracking-widest text-slate-500 h-10">Audit Verdict</TableHead>
                <TableHead className="text-[10px] font-bold uppercase tracking-widest text-slate-500 h-10 text-right">Exec (UTC)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="bg-white dark:bg-slate-950">
              {auditHistory.map((row) => (
                <TableRow key={row.id} className="group hover:bg-slate-50/50">
                  <TableCell className="py-3">
                    <div className="font-bold text-xs text-slate-900 dark:text-white">{row.id}</div>
                    <div className="flex items-center text-[10px] font-mono text-slate-400 mt-1">
                      {row.hash} <Copy className="h-3 w-3 ml-1 cursor-pointer hover:text-slate-600" />
                    </div>
                  </TableCell>
                  <TableCell className="py-3">
                    <div className="font-semibold text-xs text-slate-900 dark:text-white">{row.company}</div>
                    <div className="flex items-center space-x-1 mt-1">
                      <span className="text-[10px] font-mono font-bold bg-blue-50 text-blue-600 px-1 rounded">{row.ticker}</span>
                      <span className="text-[10px] font-mono text-slate-500">{row.filing}</span>
                    </div>
                  </TableCell>
                  <TableCell className="py-3 max-w-[200px]">
                    <div className="font-medium text-xs text-slate-700 dark:text-slate-300 truncate">{row.query}</div>
                    <div className="text-[10px] text-slate-400 mt-1 font-mono truncate">{row.span}</div>
                  </TableCell>
                  <TableCell className="py-3">
                    <div className="flex items-center text-xs font-semibold text-slate-700 bg-slate-100 px-2 py-1 rounded w-max border border-slate-200">
                      <div className="w-1.5 h-1.5 bg-slate-400 rounded-sm mr-2"></div>
                      {row.model}
                    </div>
                  </TableCell>
                  <TableCell className="py-3 text-center">
                    <div className="flex justify-center">
                      <ClaimsBar claims={row.claims} />
                    </div>
                  </TableCell>
                  <TableCell className="py-3">
                    <div className="flex items-center space-x-2">
                      <span className={`text-xs font-bold ${row.scoreColor}`}>{row.score}%</span>
                      <span className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded ${row.scoreBg} ${row.scoreColor}`}>
                        {row.scoreLabel}
                      </span>
                    </div>
                    <div className="text-[10px] font-mono text-slate-500 mt-1">{row.delta || "-"}</div>
                  </TableCell>
                  <TableCell className="py-3">
                    <div className={`flex items-center text-[10px] font-bold tracking-widest uppercase bg-transparent w-max`}>
                      <row.verdictIcon className={`h-3.5 w-3.5 mr-1.5 ${row.verdictColor}`} />
                      <span className={row.verdictColor}>{row.verdict}</span>
                    </div>
                  </TableCell>
                  <TableCell className="py-3 text-right">
                    <div className="text-xs font-mono text-slate-500">{row.time.split(" ")[0]}</div>
                    <div className="text-[10px] font-mono text-slate-400">{row.time.split(" ")[1]}</div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          
          {/* Pagination */}
          <div className="bg-slate-50 dark:bg-slate-900 border-t p-3 flex items-center justify-between">
            <div className="text-xs font-medium text-slate-500">
              Showing <span className="font-bold text-slate-900">1 - 7</span> of <span className="font-bold text-slate-900">1,842</span> audits <span className="mx-2">•</span> Latency p95: 142ms
            </div>
            <div className="flex space-x-1">
              <Button variant="outline" size="sm" className="h-7 w-7 p-0 border-slate-200 text-slate-400"><ChevronLeft className="h-4 w-4" /></Button>
              <Button variant="outline" size="sm" className="h-7 w-7 p-0 border-slate-900 bg-slate-900 text-white">1</Button>
              <Button variant="outline" size="sm" className="h-7 w-7 p-0 border-transparent text-slate-500 hover:border-slate-200">2</Button>
              <Button variant="outline" size="sm" className="h-7 w-7 p-0 border-transparent text-slate-500 hover:border-slate-200">3</Button>
              <span className="flex items-center justify-center w-7 h-7 text-xs text-slate-400">...</span>
              <Button variant="outline" size="sm" className="h-7 w-7 p-0 border-transparent text-slate-500 hover:border-slate-200 text-xs">264</Button>
              <Button variant="outline" size="sm" className="h-7 w-7 p-0 border-slate-200 text-slate-600"><ChevronRight className="h-4 w-4" /></Button>
            </div>
          </div>
        </Card>
      </div>

      {/* Footer Consensus Node Strip */}
      <div className="fixed bottom-0 left-64 right-0 bg-white dark:bg-slate-950 border-t px-6 py-2 flex items-center justify-between text-[10px] font-mono text-slate-500 z-10">
        <div className="flex items-center">
           <span className="w-2 h-2 rounded-full bg-emerald-500 mr-2"></span>
           LEDGER CONSENSUS NODE: <span className="font-bold text-slate-700 ml-1">EDGAR-SHARD-NYC-04</span>
           <span className="mx-4 text-slate-300">|</span>
           Block Height: <span className="font-bold text-slate-700 ml-1">#19,842,812</span>
        </div>
        <div className="flex items-center space-x-4">
           <span className="flex items-center"><Lock className="h-3 w-3 mr-1" /> SHA-256 Merkle Provenance Active</span>
           <span className="cursor-pointer hover:text-slate-800 underline decoration-slate-300 underline-offset-2">View Merkle Tree Specs</span>
        </div>
      </div>
    </div>
  )
}
