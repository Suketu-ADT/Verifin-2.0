import { useState } from "react"
import { Link } from "react-router-dom"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card"
import { Button } from "../components/ui/button"
import { Badge } from "../components/ui/badge"
import { Progress } from "../components/ui/progress"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table"
import { 
  FileText, CheckCircle, AlertTriangle, ShieldCheck, 
  ArrowUp, ArrowDown, Plus, Download, ChevronDown, File, XCircle
} from "lucide-react"
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts"

const riskTrendData = [
  { date: "Oct 01", risk: 34 },
  { date: "Oct 05", risk: 33 },
  { date: "Oct 10", risk: 34 },
  { date: "Oct 16", risk: 38 },
  { date: "Oct 20", risk: 31 },
  { date: "Oct 25", risk: 25 },
  { date: "Current", risk: 23 },
]

export default function Dashboard() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">Audit Intelligence Dashboard</h1>
          <p className="text-muted-foreground mt-1">Continuous real-time hallucination monitoring across enterprise financial AI pipelines.</p>
        </div>
        <div className="flex items-center space-x-3">
          <Button variant="outline" className="text-muted-foreground">
            Last 30 Days (Oct 2025) <ChevronDown className="ml-2 h-4 w-4" />
          </Button>
          <Button variant="outline" className="text-muted-foreground">
            <Download className="mr-2 h-4 w-4" /> Export Analytics
          </Button>
          <Link to="/verify">
            <Button>
              <Plus className="mr-2 h-4 w-4" /> New Verification
            </Button>
          </Link>
        </div>
      </div>
      
      {/* Metrics Row */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">Documents Analyzed</CardTitle>
            <FileText className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline space-x-2">
              <span className="text-4xl font-bold">128</span>
              <span className="text-sm text-emerald-500 font-medium flex items-center">
                <ArrowUp className="h-3 w-3 mr-0.5" /> 12 this mo.
              </span>
            </div>
            <div className="mt-3 flex justify-between text-xs text-muted-foreground border-t pt-3">
              <span>OCR Extraction</span>
              <span className="font-semibold text-foreground">99.4% SLA</span>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">Claims Verified</CardTitle>
            <CheckCircle className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline space-x-2">
              <span className="text-4xl font-bold">1,842</span>
              <span className="text-sm text-emerald-500 font-medium flex items-center">
                <ArrowUp className="h-3 w-3 mr-0.5" /> 18.4% YoY
              </span>
            </div>
            <div className="mt-3 flex justify-between text-xs text-muted-foreground border-t pt-3">
              <span>Decomposition Density</span>
              <span className="font-semibold text-foreground">14.3 claims/doc avg</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-rose-200 dark:border-rose-900/50 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10 text-rose-500">
             <AlertTriangle className="h-16 w-16" />
          </div>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
            <CardTitle className="text-xs font-semibold tracking-wider text-rose-500 uppercase">Hallucinations Detected</CardTitle>
            <AlertTriangle className="h-4 w-4 text-rose-500" />
          </CardHeader>
          <CardContent className="relative z-10">
            <div className="flex items-baseline space-x-2">
              <span className="text-4xl font-bold text-rose-600 dark:text-rose-500">147</span>
              <span className="text-sm text-emerald-500 font-medium flex items-center">
                <ArrowDown className="h-3 w-3 mr-0.5" /> 8.2%
              </span>
            </div>
            <div className="mt-3 flex justify-between text-xs text-muted-foreground border-t pt-3">
              <span>Aggregate Error Rate</span>
              <span className="font-semibold text-rose-600 dark:text-rose-500">7.9% Flagged</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">Average Trust Score</CardTitle>
            <ShieldCheck className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline space-x-2">
              <span className="text-4xl font-bold">91.4%</span>
              <span className="text-sm text-emerald-500 font-medium flex items-center">
                <ArrowUp className="h-3 w-3 mr-0.5" /> 3.4%
              </span>
            </div>
            <div className="mt-3 flex justify-between text-xs text-muted-foreground border-t pt-3">
              <span>NLI Consensus Threshold</span>
              <span className="font-semibold text-emerald-500">96.2% High</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Analytics Row */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="flex flex-col">
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>Tri-State Claim Classification</CardTitle>
              <span className="text-xs text-muted-foreground font-mono">Sample: 1,842 Claims</span>
            </div>
            <CardDescription>Deterministic NLI ground-truth verification outcomes</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col justify-center">
            {/* Custom Stacked Bar */}
            <div className="h-4 w-full flex rounded-full overflow-hidden mb-6 bg-muted">
              <div className="bg-emerald-500 h-full" style={{ width: '81%' }}></div>
              <div className="bg-rose-500 h-full" style={{ width: '13.5%' }}></div>
              <div className="bg-amber-500 h-full" style={{ width: '5.5%' }}></div>
            </div>
            
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div>
                <div className="flex items-center space-x-1.5 mb-1">
                  <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Supported</span>
                </div>
                <div className="text-2xl font-bold">1,492</div>
                <div className="text-sm text-muted-foreground">81.0% Pass</div>
              </div>
              <div>
                <div className="flex items-center space-x-1.5 mb-1">
                  <div className="w-2 h-2 rounded-full bg-rose-500"></div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-rose-500">Contradicted</span>
                </div>
                <div className="text-2xl font-bold text-rose-500">248</div>
                <div className="text-sm text-rose-500/80">13.5% Critical</div>
              </div>
              <div>
                <div className="flex items-center space-x-1.5 mb-1">
                  <div className="w-2 h-2 rounded-full bg-amber-500"></div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-amber-500">Unverifiable</span>
                </div>
                <div className="text-2xl font-bold text-amber-500">102</div>
                <div className="text-sm text-amber-500/80">5.5% Needs Citation</div>
              </div>
            </div>

            <div className="mt-auto border-t pt-4">
              <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">Contradiction Taxonomy Breakdown</div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Numerical Discrepancy <span className="font-mono text-rose-500 ml-1">64%</span></span>
                <span className="text-muted-foreground">Uncited Attribution <span className="font-mono text-rose-500 ml-1">26%</span></span>
                <span className="text-muted-foreground">Logical Reversal <span className="font-mono text-rose-500 ml-1">10%</span></span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="flex flex-col">
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>Hallucination Risk Trend</CardTitle>
              <Badge variant="outline" className="text-emerald-500 bg-emerald-500/10 border-emerald-500/20 font-mono">
                <ArrowDown className="mr-1 h-3 w-3" /> 11.0% Delta
              </Badge>
            </div>
            <CardDescription>30-day moving average vs filing cycles</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 min-h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={riskTrendData} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRisk" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} dy={10} minTickGap={10} className="text-muted-foreground font-mono" />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                  itemStyle={{ color: '#f43f5e', fontWeight: 'bold' }}
                />
                <Area type="monotone" dataKey="risk" stroke="#f43f5e" strokeWidth={2} fillOpacity={1} fill="url(#colorRisk)" />
              </AreaChart>
            </ResponsiveContainer>
            
            <div className="mt-4 border-t pt-4 flex justify-between items-center text-sm">
              <span className="text-muted-foreground flex items-center">
                <CheckCircle className="mr-2 h-4 w-4" /> Average Verification Latency
              </span>
              <span className="font-mono font-semibold">1.94s <span className="text-emerald-500 text-xs ml-1">p95 &lt; 2.2s</span></span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Table Section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-4 border-b">
          <div>
            <CardTitle>Recent Financial AI Audits</CardTitle>
            <CardDescription className="mt-1">Real-time decompose-and-verify trace logs across generative reports.</CardDescription>
          </div>
          <div className="flex space-x-2">
             {/* Mock search/filter */}
             <div className="relative">
               <span className="text-sm font-semibold mr-4 cursor-pointer">All Audits (128)</span>
               <span className="text-sm text-muted-foreground mr-4 cursor-pointer hover:text-foreground">Contradictions Only (14)</span>
               <span className="text-sm text-muted-foreground cursor-pointer hover:text-foreground">Pending Review (3)</span>
             </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="w-[200px] text-xs uppercase tracking-wider">SEC Target Document</TableHead>
                <TableHead className="text-xs uppercase tracking-wider">Statement / Decomposed Claim</TableHead>
                <TableHead className="text-xs uppercase tracking-wider whitespace-nowrap text-center">Decomposed</TableHead>
                <TableHead className="text-xs uppercase tracking-wider whitespace-nowrap">Trust Score</TableHead>
                <TableHead className="text-xs uppercase tracking-wider whitespace-nowrap">Audit Status</TableHead>
                <TableHead className="text-xs uppercase tracking-wider whitespace-nowrap text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell>
                  <div className="flex items-start space-x-2">
                    <File className="h-4 w-4 mt-0.5 text-muted-foreground" />
                    <div>
                      <div className="font-medium text-sm">Apple Inc. (AAPL)</div>
                      <div className="text-xs text-muted-foreground font-mono">10-K FY2025 • Item 7 MD&A</div>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-sm font-medium">"Services revenue reached $85.2B, up 8.9% ..."</TableCell>
                <TableCell className="text-center"><span className="text-xs font-mono bg-muted px-2 py-1 rounded">5 claims</span></TableCell>
                <TableCell>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-bold font-mono text-emerald-500">91%</span>
                    <Progress value={91} className="h-1.5 w-16 bg-emerald-100 dark:bg-emerald-950" indicatorClassName="bg-emerald-500" />
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-emerald-500 border-emerald-500/30 bg-emerald-500/10 gap-1 pr-2">
                    <CheckCircle className="h-3 w-3" /> VERIFIED
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Link to="/evidence">
                    <Button variant="outline" size="sm" className="h-8 text-xs font-semibold">Inspect Audit</Button>
                  </Link>
                </TableCell>
              </TableRow>

              <TableRow>
                <TableCell>
                  <div className="flex items-start space-x-2">
                    <File className="h-4 w-4 mt-0.5 text-amber-500" />
                    <div>
                      <div className="font-medium text-sm">Tesla, Inc. (TSLA)</div>
                      <div className="text-xs text-muted-foreground font-mono">FY2024 Annual • Note 14 Debt</div>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-sm font-medium text-muted-foreground">"Total long-term liquidity reserves exceed $2..."</TableCell>
                <TableCell className="text-center"><span className="text-xs font-mono bg-muted px-2 py-1 rounded">7 claims</span></TableCell>
                <TableCell>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-bold font-mono text-amber-500">78%</span>
                    <Progress value={78} className="h-1.5 w-16 bg-amber-100 dark:bg-amber-950" indicatorClassName="bg-amber-500" />
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-amber-500 border-amber-500/30 bg-amber-500/10 gap-1 pr-2">
                    <AlertTriangle className="h-3 w-3" /> REVIEW FLAGGED
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Link to="/evidence">
                    <Button variant="outline" size="sm" className="h-8 text-xs font-semibold">Inspect Audit</Button>
                  </Link>
                </TableCell>
              </TableRow>

              <TableRow className="bg-rose-50/50 dark:bg-rose-950/20">
                <TableCell>
                  <div className="flex items-start space-x-2">
                    <AlertTriangle className="h-4 w-4 mt-0.5 text-rose-500" />
                    <div>
                      <div className="font-medium text-sm">NVIDIA Corp (NVDA)</div>
                      <div className="text-xs text-rose-500/80 font-mono">Q3 10-Q • Segment Margins</div>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-sm font-medium">"Data center gross margin expanded to 79.2..."</TableCell>
                <TableCell className="text-center"><span className="text-xs font-mono bg-muted px-2 py-1 rounded">6 claims</span></TableCell>
                <TableCell>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-bold font-mono text-rose-500">64%</span>
                    <Progress value={64} className="h-1.5 w-16 bg-rose-100 dark:bg-rose-950" indicatorClassName="bg-rose-500" />
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-rose-500 border-rose-500/30 bg-rose-500/10 gap-1 pr-2">
                    <XCircle className="h-3 w-3" /> CONTRADICTION
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Link to="/evidence">
                    <Button size="sm" variant="destructive" className="h-8 text-xs font-semibold bg-rose-600 hover:bg-rose-700">Inspect Audit</Button>
                  </Link>
                </TableCell>
              </TableRow>

              <TableRow>
                <TableCell>
                  <div className="flex items-start space-x-2">
                    <File className="h-4 w-4 mt-0.5 text-muted-foreground" />
                    <div>
                      <div className="font-medium text-sm">Microsoft Corp (MSFT)</div>
                      <div className="text-xs text-muted-foreground font-mono">FY25 10-K • Intelligent Cloud</div>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-sm font-medium">"Azure commercial cloud bookings rose 23% ..."</TableCell>
                <TableCell className="text-center"><span className="text-xs font-mono bg-muted px-2 py-1 rounded">8 claims</span></TableCell>
                <TableCell>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-bold font-mono text-emerald-500">98%</span>
                    <Progress value={98} className="h-1.5 w-16 bg-emerald-100 dark:bg-emerald-950" indicatorClassName="bg-emerald-500" />
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-emerald-500 border-emerald-500/30 bg-emerald-500/10 gap-1 pr-2">
                    <CheckCircle className="h-3 w-3" /> VERIFIED
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Link to="/evidence">
                    <Button variant="outline" size="sm" className="h-8 text-xs font-semibold">Inspect Audit</Button>
                  </Link>
                </TableCell>
              </TableRow>

            </TableBody>
          </Table>
          
          <div className="p-4 border-t flex items-center justify-between text-sm text-muted-foreground">
            <span>Showing 4 of 128 audits</span>
            <div className="flex space-x-1">
              <Button variant="ghost" size="sm" disabled>Prev</Button>
              <Button variant="outline" size="sm" className="bg-primary text-primary-foreground border-primary w-8 h-8 p-0">1</Button>
              <Button variant="ghost" size="sm" className="w-8 h-8 p-0">2</Button>
              <Button variant="ghost" size="sm" className="w-8 h-8 p-0">3</Button>
              <Button variant="ghost" size="sm">Next</Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
