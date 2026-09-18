import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card"
import { Badge } from "../components/ui/badge"
import { Progress } from "../components/ui/progress"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table"
import { 
  Server, Activity, Database, Cpu, HardDrive, Network, 
  CheckCircle2, AlertCircle, Clock, ShieldCheck, 
  Zap, ArrowUpRight, ArrowDownRight, RefreshCw, Layers
} from "lucide-react"
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts"

const latencyData = [
  { time: "10:00", ms: 42 },
  { time: "10:05", ms: 45 },
  { time: "10:10", ms: 38 },
  { time: "10:15", ms: 85 }, // spike
  { time: "10:20", ms: 41 },
  { time: "10:25", ms: 40 },
  { time: "10:30", ms: 43 },
  { time: "10:35", ms: 42 },
]

export default function SystemStatus() {
  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-background relative pb-8 font-sans">
      
      {/* Header */}
      <div className="px-6 py-5 bg-white dark:bg-slate-950 border-b flex justify-between items-start shrink-0">
        <div>
          <div className="flex items-center text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
            <span>VERIFIN</span>
            <span className="mx-2">&gt;</span>
            <span className="text-foreground">Infrastructure Telemetry</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">System Status & Resources</h1>
          <p className="text-sm text-muted-foreground mt-1">Real-time health monitoring of the core verification engine and model serving infrastructure.</p>
        </div>
        <div className="flex items-center space-x-3">
          <div className="flex items-center text-xs font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-full">
            <span className="relative flex h-2 w-2 mr-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            ALL SYSTEMS OPERATIONAL
          </div>
          <button className="p-1.5 text-slate-400 hover:text-slate-700 bg-slate-100 rounded">
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="p-6 space-y-6 flex-1 max-w-[1400px] mx-auto w-full">
        
        {/* Top KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="shadow-sm border-slate-200">
            <CardContent className="p-5 flex flex-col justify-between h-full">
              <div className="flex justify-between items-start mb-2">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Global Uptime</div>
                <Activity className="h-4 w-4 text-emerald-500" />
              </div>
              <div className="text-3xl font-black text-slate-900 dark:text-white">99.998%</div>
              <div className="flex justify-between text-xs font-semibold mt-3 pt-3 border-t border-slate-100 text-slate-500">
                <span>Last 30 Days</span>
                <span className="text-emerald-500">+0.002%</span>
              </div>
            </CardContent>
          </Card>
          
          <Card className="shadow-sm border-slate-200">
            <CardContent className="p-5 flex flex-col justify-between h-full">
              <div className="flex justify-between items-start mb-2">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">API Latency (p95)</div>
                <Zap className="h-4 w-4 text-amber-500" />
              </div>
              <div className="text-3xl font-black text-slate-900 dark:text-white">42<span className="text-xl text-slate-400 ml-1">ms</span></div>
              <div className="flex justify-between text-xs font-semibold mt-3 pt-3 border-t border-slate-100 text-slate-500">
                <span>Core Engine</span>
                <span className="text-emerald-500 flex items-center"><ArrowDownRight className="h-3 w-3 mr-0.5" /> 4ms</span>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm border-slate-200">
            <CardContent className="p-5 flex flex-col justify-between h-full">
              <div className="flex justify-between items-start mb-2">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">GPU Utilization</div>
                <Cpu className="h-4 w-4 text-indigo-500" />
              </div>
              <div className="text-3xl font-black text-slate-900 dark:text-white">68<span className="text-xl text-slate-400 ml-1">%</span></div>
              <div className="flex justify-between text-xs font-semibold mt-3 pt-3 border-t border-slate-100 text-slate-500">
                <span>NVIDIA A100 Cluster</span>
                <span className="text-indigo-600">34GB / 40GB VRAM</span>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm border-slate-200">
            <CardContent className="p-5 flex flex-col justify-between h-full">
              <div className="flex justify-between items-start mb-2">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Verification Queue</div>
                <Layers className="h-4 w-4 text-blue-500" />
              </div>
              <div className="text-3xl font-black text-slate-900 dark:text-white">14</div>
              <div className="flex justify-between text-xs font-semibold mt-3 pt-3 border-t border-slate-100 text-slate-500">
                <span>Active Documents</span>
                <span>~2.4s est. wait</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Network Graph & Services List */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Main Services Table */}
          <Card className="lg:col-span-2 shadow-sm border-slate-200 overflow-hidden flex flex-col">
            <div className="bg-slate-50 border-b border-slate-100 px-4 py-3 flex justify-between items-center">
              <h2 className="text-xs font-bold uppercase tracking-widest text-slate-600">Microservice Architecture Health</h2>
              <span className="text-[10px] font-mono font-bold text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded">All nodes passing health checks</span>
            </div>
            <CardContent className="p-0 flex-1">
              <Table>
                <TableHeader className="bg-slate-50/50">
                  <TableRow>
                    <TableHead className="text-[10px] font-bold uppercase tracking-widest text-slate-400 h-10">Service</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase tracking-widest text-slate-400 h-10">Status</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase tracking-widest text-slate-400 h-10">Uptime</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase tracking-widest text-slate-400 h-10">Response</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase tracking-widest text-slate-400 h-10 text-right">Region</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {/* Service 1 */}
                  <TableRow>
                    <TableCell className="py-3">
                      <div className="flex items-center">
                        <Server className="h-4 w-4 text-slate-400 mr-2" />
                        <div>
                          <div className="font-bold text-xs text-slate-800">Edge Gateway (Vite/React)</div>
                          <div className="text-[10px] font-mono text-slate-400 mt-0.5">app.verifin.io</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="py-3">
                      <div className="flex items-center text-emerald-600 text-[10px] font-bold uppercase tracking-widest">
                        <CheckCircle2 className="h-3 w-3 mr-1" /> Operational
                      </div>
                    </TableCell>
                    <TableCell className="py-3 text-xs font-mono text-slate-600">99.99%</TableCell>
                    <TableCell className="py-3 text-xs font-mono text-emerald-600">12ms</TableCell>
                    <TableCell className="py-3 text-right text-[10px] font-mono text-slate-500">us-east-1</TableCell>
                  </TableRow>
                  
                  {/* Service 2 */}
                  <TableRow>
                    <TableCell className="py-3">
                      <div className="flex items-center">
                        <Activity className="h-4 w-4 text-slate-400 mr-2" />
                        <div>
                          <div className="font-bold text-xs text-slate-800">Verification Engine (FastAPI)</div>
                          <div className="text-[10px] font-mono text-slate-400 mt-0.5">api.verifin.io/v1</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="py-3">
                      <div className="flex items-center text-emerald-600 text-[10px] font-bold uppercase tracking-widest">
                        <CheckCircle2 className="h-3 w-3 mr-1" /> Operational
                      </div>
                    </TableCell>
                    <TableCell className="py-3 text-xs font-mono text-slate-600">99.98%</TableCell>
                    <TableCell className="py-3 text-xs font-mono text-emerald-600">48ms</TableCell>
                    <TableCell className="py-3 text-right text-[10px] font-mono text-slate-500">us-east-1</TableCell>
                  </TableRow>

                  {/* Service 3 */}
                  <TableRow className="bg-slate-50/50">
                    <TableCell className="py-3">
                      <div className="flex items-center">
                        <Cpu className="h-4 w-4 text-indigo-400 mr-2" />
                        <div>
                          <div className="font-bold text-xs text-slate-800">NLI Inference Cluster (A100)</div>
                          <div className="text-[10px] font-mono text-slate-400 mt-0.5">grpc://tensor-core-04</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="py-3">
                      <div className="flex items-center text-emerald-600 text-[10px] font-bold uppercase tracking-widest">
                        <CheckCircle2 className="h-3 w-3 mr-1" /> Operational
                      </div>
                    </TableCell>
                    <TableCell className="py-3 text-xs font-mono text-slate-600">99.90%</TableCell>
                    <TableCell className="py-3 text-xs font-mono text-amber-500">145ms</TableCell>
                    <TableCell className="py-3 text-right text-[10px] font-mono text-slate-500">us-east-2</TableCell>
                  </TableRow>

                  {/* Service 4 */}
                  <TableRow>
                    <TableCell className="py-3">
                      <div className="flex items-center">
                        <Database className="h-4 w-4 text-slate-400 mr-2" />
                        <div>
                          <div className="font-bold text-xs text-slate-800">Vector Retrieval DB</div>
                          <div className="text-[10px] font-mono text-slate-400 mt-0.5">pgvector-cluster-prod</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="py-3">
                      <div className="flex items-center text-emerald-600 text-[10px] font-bold uppercase tracking-widest">
                        <CheckCircle2 className="h-3 w-3 mr-1" /> Operational
                      </div>
                    </TableCell>
                    <TableCell className="py-3 text-xs font-mono text-slate-600">99.99%</TableCell>
                    <TableCell className="py-3 text-xs font-mono text-emerald-600">18ms</TableCell>
                    <TableCell className="py-3 text-right text-[10px] font-mono text-slate-500">us-east-1</TableCell>
                  </TableRow>

                  {/* Service 5 */}
                  <TableRow>
                    <TableCell className="py-3">
                      <div className="flex items-center">
                        <HardDrive className="h-4 w-4 text-slate-400 mr-2" />
                        <div>
                          <div className="font-bold text-xs text-slate-800">SEC EDGAR Sync Worker</div>
                          <div className="text-[10px] font-mono text-slate-400 mt-0.5">celery-worker-01</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="py-3">
                      <div className="flex items-center text-blue-600 text-[10px] font-bold uppercase tracking-widest">
                        <RefreshCw className="h-3 w-3 mr-1 animate-spin-slow" /> Syncing
                      </div>
                    </TableCell>
                    <TableCell className="py-3 text-xs font-mono text-slate-600">100.0%</TableCell>
                    <TableCell className="py-3 text-xs font-mono text-slate-400">-</TableCell>
                    <TableCell className="py-3 text-right text-[10px] font-mono text-slate-500">us-west-1</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Right Column: Chart & Logs */}
          <div className="space-y-6">
            
            <Card className="shadow-sm border-slate-200">
              <div className="bg-slate-50 border-b border-slate-100 px-4 py-3 flex justify-between items-center">
                <h2 className="text-xs font-bold uppercase tracking-widest text-slate-600">API Latency (Past Hour)</h2>
                <Network className="h-3.5 w-3.5 text-slate-400" />
              </div>
              <CardContent className="p-4 pt-6 h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={latencyData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorMs" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} dx={-10} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold' }}
                      itemStyle={{ color: '#10b981' }}
                    />
                    <Area type="monotone" dataKey="ms" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorMs)" />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="shadow-sm border-slate-200 flex flex-col">
              <div className="bg-slate-50 border-b border-slate-100 px-4 py-3 flex justify-between items-center">
                <h2 className="text-xs font-bold uppercase tracking-widest text-slate-600">Recent Incidents</h2>
                <ShieldCheck className="h-3.5 w-3.5 text-slate-400" />
              </div>
              <CardContent className="p-0 flex-1 overflow-y-auto">
                <div className="divide-y divide-slate-100">
                  <div className="p-4 flex items-start space-x-3 hover:bg-slate-50">
                    <div className="bg-blue-100 text-blue-600 p-1.5 rounded-full mt-0.5">
                      <RefreshCw className="h-3 w-3" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-800">Auto-scaling event triggered</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">NLI Inference Cluster scaled to 4 nodes due to queue depth.</div>
                      <div className="text-[9px] font-mono text-slate-400 mt-2 flex items-center"><Clock className="h-2.5 w-2.5 mr-1" /> 22 mins ago</div>
                    </div>
                  </div>
                  
                  <div className="p-4 flex items-start space-x-3 hover:bg-slate-50">
                    <div className="bg-amber-100 text-amber-600 p-1.5 rounded-full mt-0.5">
                      <AlertCircle className="h-3 w-3" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-800">API Latency Spike (85ms)</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">Brief latency spike observed on Core Engine during heavy ingestion.</div>
                      <div className="text-[9px] font-mono text-slate-400 mt-2 flex items-center"><Clock className="h-2.5 w-2.5 mr-1" /> 45 mins ago</div>
                    </div>
                  </div>

                  <div className="p-4 flex items-start space-x-3 hover:bg-slate-50">
                    <div className="bg-emerald-100 text-emerald-600 p-1.5 rounded-full mt-0.5">
                      <CheckCircle2 className="h-3 w-3" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-800">Database Maintenance Completed</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">Vector DB routine vacuum executed successfully.</div>
                      <div className="text-[9px] font-mono text-slate-400 mt-2 flex items-center"><Clock className="h-2.5 w-2.5 mr-1" /> 3 hours ago</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

          </div>
        </div>

      </div>
    </div>
  )
}
