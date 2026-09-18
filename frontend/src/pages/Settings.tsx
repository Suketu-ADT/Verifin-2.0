import { Button } from "../components/ui/button"
import { Card, CardContent } from "../components/ui/card"
import { Badge } from "../components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table"
import { 
  RotateCcw, Save, Scale, Network, Plus, ChevronDown, Copy, 
  Lock, Server, ShieldCheck, FileText, Code, CheckCircle2, Building2
} from "lucide-react"

export default function Settings() {
  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-background overflow-y-auto font-sans selection:bg-indigo-500/20">
      
      <div className="max-w-[1400px] mx-auto w-full p-8 space-y-8">
        
        {/* Header Section */}
        <div>
          <div className="flex items-center text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 space-x-2">
            <span>VERIFIN</span>
            <span>&gt;</span>
            <span>Administration</span>
            <span>&gt;</span>
            <span className="text-slate-700">Verification & Model Configuration</span>
          </div>
          
          <div className="flex items-center space-x-3 mb-6">
             <div className="flex items-center space-x-1.5 text-[10px] font-mono bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-1 rounded">
               <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
               <span>Config Hash: 0x7F9E..C314</span>
             </div>
             <div className="text-[10px] font-mono text-slate-500 tracking-wider">
               Active Node: cluster-us-east-quants-09
             </div>
          </div>
          
          <div className="flex justify-between items-start">
            <div>
              <div className="flex items-center space-x-3">
                <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">System Configuration & Model Calibration</h1>
                <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 border-none rounded text-[9px] px-1.5 py-0 uppercase">V3.4 Production</Badge>
              </div>
              <p className="text-sm text-slate-500 mt-2 max-w-2xl">
                Manage NLI entailment thresholds, financial corpus indexing, API connections, and audit compliance profiles for institutional quantitative inspection.
              </p>
            </div>
            <div className="flex items-center space-x-3">
              <Button variant="outline" className="text-sm font-semibold h-10 text-slate-600 bg-white border-slate-200">
                <RotateCcw className="mr-2 h-4 w-4" /> Revert to Defaults
              </Button>
              <Button className="text-sm font-semibold h-10 bg-slate-900 text-white hover:bg-slate-800 shadow-md">
                <Save className="mr-2 h-4 w-4" /> Save Configuration
              </Button>
            </div>
          </div>
        </div>
        
        {/* Navigation Tabs */}
        <div className="flex space-x-1 border-b border-slate-200 overflow-x-auto hide-scrollbar">
           <button className="px-4 py-3 text-sm font-semibold text-slate-500 hover:text-slate-900 transition-colors whitespace-nowrap">General & Workspace</button>
           <button className="px-4 py-3 text-sm font-semibold text-white bg-slate-900 rounded-t-md whitespace-nowrap flex items-center space-x-2">
             <SlidersIcon className="h-4 w-4" />
             <span>NLI Engine & Detection Calibration</span>
           </button>
           <button className="px-4 py-3 text-sm font-semibold text-slate-500 hover:text-slate-900 transition-colors whitespace-nowrap">Ground Truth Document Sources</button>
           <button className="px-4 py-3 text-sm font-semibold text-slate-500 hover:text-slate-900 transition-colors whitespace-nowrap">Model Endpoints & LLM APIs</button>
           <button className="px-4 py-3 text-sm font-semibold text-slate-500 hover:text-slate-900 transition-colors whitespace-nowrap">Audit Logging & Security</button>
        </div>
        
        {/* Two-Column Grid */}
        <div className="grid grid-cols-3 gap-8">
          
          {/* Main Column (2/3) */}
          <div className="col-span-2 space-y-8">
            
            {/* Tri-State Classification Thresholds Panel */}
            <Card className="border-slate-200 shadow-sm bg-white/50">
              <div className="p-6 border-b border-slate-100 flex justify-between items-start bg-white rounded-t-lg">
                 <div className="flex items-start space-x-4">
                   <div className="w-10 h-10 rounded-md bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0">
                     <Scale className="h-5 w-5" />
                   </div>
                   <div>
                     <h2 className="text-base font-bold text-slate-900">Tri-State Classification Thresholds</h2>
                     <p className="text-xs text-slate-500 mt-1 max-w-md leading-relaxed">
                       Calibrate deterministic NLI boundary math for Supported, Contradicted, and Unverifiable states.
                     </p>
                   </div>
                 </div>
                 <div className="text-[10px] font-mono font-bold text-slate-600 bg-slate-100 px-2 py-1 rounded">
                   Strictness: High (SEC-17a)
                 </div>
              </div>
              
              <CardContent className="p-6 bg-slate-50/50">
                <div className="grid grid-cols-2 gap-6 mb-8">
                   
                   {/* Slider 1: Entailment Floor */}
                   <div className="bg-white p-4 border border-slate-200 rounded-lg shadow-sm">
                     <div className="flex justify-between items-start mb-2">
                       <div className="flex items-center text-sm font-bold text-slate-900">
                         <span className="w-2 h-2 rounded-full bg-emerald-500 mr-2"></span> Entailment Floor
                       </div>
                       <div className="text-sm font-mono font-bold text-emerald-600">0.88 <span className="text-[10px] text-slate-400 font-sans font-normal">/ 1.00</span></div>
                     </div>
                     <p className="text-[10px] text-slate-500 leading-relaxed mb-4 h-8">
                       Statements with natural language confidence ≥ <span className="font-bold text-slate-700">0.88</span> are classified as <span className="font-bold text-emerald-600">SUPPORTED</span>. (Default: 0.85)
                     </p>
                     <div className="relative pt-2 pb-6">
                       {/* Mock Slider Track */}
                       <div className="h-2 w-full bg-slate-100 rounded-full flex overflow-hidden">
                         <div className="h-full bg-slate-300 w-[70%]"></div>
                         <div className="h-full bg-emerald-500 w-[18%]"></div>
                         <div className="h-full bg-emerald-200 w-[12%]"></div>
                       </div>
                       {/* Handle */}
                       <div className="absolute top-1 left-[88%] w-4 h-4 bg-white border-2 border-slate-900 rounded-full shadow cursor-pointer -ml-2"></div>
                       {/* Labels */}
                       <div className="absolute bottom-0 left-0 text-[9px] font-mono text-slate-400">0.70<br/>Relaxed</div>
                       <div className="absolute bottom-0 left-[70%] text-[9px] font-mono text-slate-400 text-center -ml-3">Default:<br/>0.85</div>
                       <div className="absolute bottom-0 right-0 text-[9px] font-mono text-slate-400 text-right">0.99 Ultra-<br/>Strict</div>
                     </div>
                   </div>

                   {/* Slider 2: Contradiction Delta */}
                   <div className="bg-white p-4 border border-slate-200 rounded-lg shadow-sm">
                     <div className="flex justify-between items-start mb-2">
                       <div className="flex items-center text-sm font-bold text-slate-900">
                         <span className="w-2 h-2 rounded-full bg-rose-500 mr-2"></span> Contradiction Delta Margin
                       </div>
                       <div className="text-sm font-mono font-bold text-rose-600">0.05 <span className="text-[10px] text-slate-400 font-sans font-normal">±</span></div>
                     </div>
                     <p className="text-[10px] text-slate-500 leading-relaxed mb-4 h-8">
                       Discrepancies exceeding this divergence delta trigger immediate hard <span className="font-bold text-rose-600">CONTRADICTION</span> state.
                     </p>
                     <div className="relative pt-2 pb-6">
                       {/* Mock Slider Track */}
                       <div className="h-2 w-full bg-slate-100 rounded-full flex overflow-hidden">
                         <div className="h-full bg-rose-600 w-[20%]"></div>
                         <div className="h-full bg-slate-200 w-[80%]"></div>
                       </div>
                       {/* Handle */}
                       <div className="absolute top-1 left-[20%] w-4 h-4 bg-white border-2 border-slate-900 rounded-full shadow cursor-pointer -ml-2"></div>
                       {/* Labels */}
                       <div className="absolute bottom-0 left-0 text-[9px] font-mono text-slate-400">0.01 Zero-Drift</div>
                       <div className="absolute bottom-0 left-[20%] text-[9px] font-mono text-slate-400 text-center ml-2">Default: 0.05</div>
                       <div className="absolute bottom-0 right-0 text-[9px] font-mono text-slate-400 text-right">0.20 Loose</div>
                     </div>
                   </div>
                   
                   {/* Slider 3: Numerical Precision Drift (Locked) */}
                   <div className="bg-white/60 p-4 border border-slate-200 rounded-lg shadow-sm relative overflow-hidden">
                     <div className="absolute inset-0 bg-slate-50/50 pointer-events-none"></div>
                     <div className="flex justify-between items-start mb-2 relative">
                       <div className="flex items-center text-sm font-bold text-slate-700">
                         <span className="text-lg font-mono text-slate-400 mr-2">%</span> Numerical Precision Drift
                       </div>
                       <div className="flex items-center space-x-2">
                         <div className="text-sm font-mono font-bold text-slate-600">0.00 %</div>
                         <Badge className="bg-blue-50 text-blue-600 border-blue-200 text-[8px] rounded px-1 py-0">STRICT</Badge>
                       </div>
                     </div>
                     <p className="text-[10px] text-slate-500 leading-relaxed mb-4 h-8 relative">
                       Zero tolerance enforced for all monetary metrics, share counts, and basis-point deltas.
                     </p>
                     <div className="relative pt-2 pb-6">
                       {/* Mock Slider Track */}
                       <div className="h-1 w-full bg-blue-100 rounded-full flex overflow-hidden">
                         <div className="h-full bg-blue-500 w-[2%]"></div>
                       </div>
                       {/* Handle */}
                       <div className="absolute top-1.5 left-0 w-2 h-4 bg-slate-900 rounded-sm cursor-not-allowed"></div>
                       {/* Labels */}
                       <div className="absolute bottom-0 left-[10%] text-[9px] font-mono text-slate-500 font-bold flex items-center">
                         0.0000 Delta Lock
                       </div>
                     </div>
                   </div>
                   
                   {/* Slider 4: Missing Citation Ceiling */}
                   <div className="bg-white p-4 border border-slate-200 rounded-lg shadow-sm">
                     <div className="flex justify-between items-start mb-2">
                       <div className="flex items-center text-sm font-bold text-slate-900">
                         <span className="w-2 h-2 rounded-full bg-amber-500 mr-2"></span> Missing-Citation Ceiling
                       </div>
                       <div className="text-sm font-mono font-bold text-amber-600">0.65 <span className="text-[10px] text-slate-400 font-sans font-normal">Cutoff</span></div>
                     </div>
                     <p className="text-[10px] text-slate-500 leading-relaxed mb-4 h-8">
                       Claims whose top chunk alignment score falls below 0.65 are classified as <span className="font-bold text-amber-600">UNVERIFIABLE</span>.
                     </p>
                     <div className="relative pt-2 pb-6">
                       {/* Mock Slider Track */}
                       <div className="h-2 w-full bg-slate-100 rounded-full flex overflow-hidden">
                         <div className="h-full bg-slate-300 w-[40%]"></div>
                         <div className="h-full bg-amber-500 w-[25%]"></div>
                         <div className="h-full bg-amber-200 w-[35%]"></div>
                       </div>
                       {/* Handle */}
                       <div className="absolute top-1 left-[65%] w-4 h-4 bg-white border-2 border-slate-900 rounded-full shadow cursor-pointer -ml-2"></div>
                       {/* Labels */}
                       <div className="absolute bottom-0 left-0 text-[9px] font-mono text-slate-400">0.40<br/>Permissive</div>
                       <div className="absolute bottom-0 left-[65%] text-[9px] font-mono text-slate-400 text-center -ml-4">Default:<br/>0.65</div>
                       <div className="absolute bottom-0 right-0 text-[9px] font-mono text-slate-400 text-right">0.80 High<br/>Recall</div>
                     </div>
                   </div>

                </div>
                
                {/* Toggles */}
                <div>
                  <h3 className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-4">Deterministic Policy Enforcement Rules</h3>
                  <div className="grid grid-cols-3 gap-6">
                    <div className="flex items-start space-x-3">
                      <MockSwitch checked={true} />
                      <div>
                        <div className="text-xs font-bold text-slate-900">Strict Fiscal Quarter Matching</div>
                        <p className="text-[9px] text-slate-500 mt-1 leading-relaxed">Strictly rejects matching Q2 reported data to Q3 comparative queries.</p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-3">
                      <MockSwitch checked={true} />
                      <div>
                        <div className="text-xs font-bold text-slate-900">Symbolic Math Engine</div>
                        <p className="text-[9px] text-slate-500 mt-1 leading-relaxed">Executes formal deterministic Python arithmetic checks on claims.</p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-3">
                      <MockSwitch checked={false} />
                      <div>
                        <div className="text-xs font-bold text-slate-900">Attention Probing</div>
                        <p className="text-[9px] text-slate-500 mt-1 leading-relaxed">Calculates multi-head entropy distribution over sensitive numerical tokens.</p>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Audited LLM Integration Table */}
            <Card className="border-slate-200 shadow-sm bg-white overflow-hidden">
              <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                 <div className="flex items-center space-x-3">
                   <div className="w-8 h-8 rounded-md bg-indigo-100 flex items-center justify-center text-indigo-600">
                     <Network className="h-4 w-4" />
                   </div>
                   <div>
                     <h2 className="text-sm font-bold text-slate-900">Audited LLM Integration & Endpoint Keys</h2>
                     <p className="text-[10px] text-slate-500 mt-0.5">Deterministic runtime orchestration across enterprise model endpoints.</p>
                   </div>
                 </div>
                 <Button variant="outline" size="sm" className="h-8 text-xs font-semibold">
                   <Plus className="h-3 w-3 mr-1.5" /> Add Custom Gateway
                 </Button>
              </div>
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent bg-white">
                    <TableHead className="text-[9px] font-bold uppercase tracking-widest text-slate-400 w-48">Provider & Model Instance</TableHead>
                    <TableHead className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Cluster Route / Status</TableHead>
                    <TableHead className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Latency SLA</TableHead>
                    <TableHead className="text-[9px] font-bold uppercase tracking-widest text-slate-400">API Key / Hash Token</TableHead>
                    <TableHead className="text-[9px] font-bold uppercase tracking-widest text-slate-400 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {/* OpenAI */}
                  <TableRow className="hover:bg-slate-50/50">
                    <TableCell className="py-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-6 h-6 bg-slate-900 text-white flex items-center justify-center rounded text-[8px] font-bold">OA</div>
                        <div>
                          <div className="text-xs font-bold text-slate-900">OpenAI Financial Tier</div>
                          <div className="text-[9px] font-mono text-slate-500 mt-0.5">gpt-4o-fin-audit / gpt-4o-mini</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center text-[10px] font-bold text-emerald-600">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5"></span> Connected
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center text-xs font-mono font-bold text-emerald-600">
                        280ms <span className="font-sans font-normal text-[9px] text-slate-400 ml-1 leading-tight">(p95: 340ms)</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <div className="bg-slate-100 border border-slate-200 text-[10px] font-mono text-slate-600 px-2 py-1 rounded truncate w-32">
                          sk-proj-••••••••••••w9B1
                        </div>
                        <Copy className="h-3 w-3 text-slate-400 cursor-pointer hover:text-slate-900" />
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                       <Button variant="ghost" size="sm" className="h-6 text-[10px] font-semibold text-slate-600">
                         Test Health <ChevronDown className="h-3 w-3 ml-1" />
                       </Button>
                    </TableCell>
                  </TableRow>

                  {/* Anthropic */}
                  <TableRow className="hover:bg-slate-50/50 border-t border-slate-100">
                    <TableCell className="py-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-6 h-6 bg-slate-200 text-slate-700 flex items-center justify-center rounded text-[8px] font-bold">AN</div>
                        <div>
                          <div className="text-xs font-bold text-slate-900">Anthropic Enterprise</div>
                          <div className="text-[9px] font-mono text-slate-500 mt-0.5">claude-3-5-sonnet-latest</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center text-[10px] font-bold text-emerald-600">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5"></span> Connected
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center text-xs font-mono font-bold text-emerald-600">
                        310ms <span className="font-sans font-normal text-[9px] text-slate-400 ml-1 leading-tight">(p95: 390ms)</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <div className="bg-slate-100 border border-slate-200 text-[10px] font-mono text-slate-600 px-2 py-1 rounded truncate w-32">
                          sk-ant-••••••••••••8mK2
                        </div>
                        <Copy className="h-3 w-3 text-slate-400 cursor-pointer hover:text-slate-900" />
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                       <Button variant="ghost" size="sm" className="h-6 text-[10px] font-semibold text-slate-600">
                         Test Health <ChevronDown className="h-3 w-3 ml-1" />
                       </Button>
                    </TableCell>
                  </TableRow>

                  {/* vLLM */}
                  <TableRow className="hover:bg-slate-50/50 border-t border-slate-100">
                    <TableCell className="py-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-6 h-6 bg-emerald-100 text-emerald-700 flex items-center justify-center rounded text-[8px] font-bold">OS</div>
                        <div>
                          <div className="text-xs font-bold text-slate-900">vLLM Finance Cluster (Self-Hosted)</div>
                          <div className="text-[9px] font-mono text-slate-500 mt-0.5">Llama-3-70B-Finance-v1.2</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="inline-flex flex-col text-[9px] font-bold text-indigo-700 bg-indigo-50 px-2 py-1 rounded">
                        A100-SXM4
                        <span className="font-mono text-slate-500 text-[8px]">8-GPU Node</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center text-xs font-mono font-bold text-emerald-600">
                        145ms <span className="font-sans font-normal text-[9px] text-slate-400 ml-1 leading-tight">(Zero Egress)</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <div className="bg-slate-100 border border-slate-200 text-[10px] font-mono text-slate-400 px-2 py-1 rounded truncate w-32 flex items-center">
                           internal-mtls-vault-root
                        </div>
                        <Lock className="h-3 w-3 text-emerald-600" />
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                       <Button variant="ghost" size="sm" className="h-6 text-[10px] font-semibold text-slate-600">
                         Test Health <ChevronDown className="h-3 w-3 ml-1" />
                       </Button>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </Card>

          </div>
          
          {/* Sidebar Column (1/3) */}
          <div className="col-span-1 space-y-6">
            
            {/* Retrieval Parameters */}
            <Card className="border-indigo-100 shadow-sm bg-white overflow-hidden">
              <div className="p-4 border-b border-indigo-50 bg-indigo-50/30 flex items-start space-x-3">
                 <div className="w-8 h-8 rounded bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
                   <Server className="h-4 w-4" />
                 </div>
                 <div>
                   <h3 className="text-sm font-bold text-slate-900">Retrieval Parameters</h3>
                   <p className="text-[10px] text-slate-500 mt-0.5 leading-relaxed">Vector indexing & dense passage extraction.</p>
                 </div>
              </div>
              <CardContent className="p-5 space-y-5">
                 <div>
                   <div className="flex justify-between items-center mb-1.5">
                     <div className="text-xs font-bold text-slate-900">Top-K Passage Chunks</div>
                     <div className="text-[10px] font-mono font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">40 chunks / query</div>
                   </div>
                   <p className="text-[9px] text-slate-500 mb-2">Passage depth evaluated through reciprocal rank fusion (RRF).</p>
                   <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden flex">
                     <div className="h-full bg-slate-400 w-[20%]"></div>
                     <div className="h-full bg-indigo-500 w-[40%]"></div>
                   </div>
                 </div>
                 
                 <div className="bg-slate-50 rounded border border-slate-100 p-3">
                   <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-2">Active Dense Model</div>
                   <div className="flex justify-between items-center mb-2">
                     <div className="text-xs font-mono font-bold text-slate-800">Fin-RoBERTa-ColBERT-v2</div>
                     <Badge className="bg-indigo-100 text-indigo-700 hover:bg-indigo-100 border-none rounded text-[9px] px-1.5 py-0 font-mono">1,536-D</Badge>
                   </div>
                   <p className="text-[9px] text-slate-500 leading-relaxed">Normalized late-interaction token alignments over financial XBRL lexicons.</p>
                 </div>
                 
                 <div className="grid grid-cols-2 gap-3">
                   <div className="bg-white border border-slate-200 rounded p-3">
                     <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Chunk Size</div>
                     <div className="text-sm font-mono font-bold text-slate-900">512 Tokens</div>
                     <div className="text-[9px] text-slate-500 mt-1">Semantic boundary</div>
                   </div>
                   <div className="bg-white border border-slate-200 rounded p-3">
                     <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Stride Overlap</div>
                     <div className="text-sm font-mono font-bold text-slate-900">128 Tokens</div>
                     <div className="text-[9px] text-slate-500 mt-1">Cross-context buffer</div>
                   </div>
                 </div>
                 
                 <div>
                   <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-3">Ingestion Invariants (Active Synced)</div>
                   <div className="space-y-2">
                     <div className="flex items-center justify-between text-xs font-medium text-slate-700 py-1 border-b border-slate-100">
                       <div className="flex items-center"><Building2 className="h-3 w-3 mr-2 text-slate-400" /> SEC EDGAR Archive</div>
                       <div className="flex items-center text-[9px] font-bold text-emerald-600"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5"></span> Live Feed</div>
                     </div>
                     <div className="flex items-center justify-between text-xs font-medium text-slate-700 py-1 border-b border-slate-100">
                       <div className="flex items-center"><Code className="h-3 w-3 mr-2 text-slate-400" /> XBRL Taxonomy 2025</div>
                       <div className="flex items-center text-[9px] font-bold text-emerald-600"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5"></span> Normalized</div>
                     </div>
                     <div className="flex items-center justify-between text-xs font-medium text-slate-700 py-1">
                       <div className="flex items-center"><FileText className="h-3 w-3 mr-2 text-slate-400" /> Earnings Transcripts Audio</div>
                       <div className="flex items-center text-[9px] font-bold text-emerald-600"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5"></span> Synchronized</div>
                     </div>
                   </div>
                 </div>
              </CardContent>
            </Card>

            {/* Compliance & Merkle Ledger */}
            <Card className="border-slate-200 shadow-sm bg-white overflow-hidden">
              <div className="p-4 border-b border-slate-100 flex items-start space-x-3">
                 <div className="w-8 h-8 rounded bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
                   <ShieldCheck className="h-4 w-4" />
                 </div>
                 <div>
                   <h3 className="text-sm font-bold text-slate-900">Compliance & Merkle Ledger</h3>
                   <p className="text-[10px] text-slate-500 mt-0.5 leading-relaxed">SEC Rule 17a-4 compliance chain verification.</p>
                 </div>
              </div>
              <CardContent className="p-5 space-y-4">
                 
                 {/* Dark Terminal Block */}
                 <div className="bg-slate-900 text-slate-300 rounded-lg p-4 shadow-inner">
                    <div className="flex justify-between items-center mb-3">
                      <div className="flex items-center text-xs font-bold text-white">
                        <ShieldCheck className="h-3.5 w-3.5 mr-2 text-emerald-400" /> SHA-256 Merkle Ledger
                      </div>
                      <Badge className="bg-emerald-500/20 text-emerald-400 border-none rounded text-[8px] px-1.5 py-0 uppercase tracking-widest font-bold">Active</Badge>
                    </div>
                    <p className="text-[10px] leading-relaxed mb-4 text-slate-400">
                      Every entailment resolution computes a deterministic root hash written to the multi-region append-only audit trail.
                    </p>
                    <div className="flex justify-between items-center text-[10px] font-mono bg-black/50 p-2 rounded border border-white/10">
                      <div className="text-slate-500">Root<br/>State:</div>
                      <div className="text-white font-bold">d5c4...9a21c4</div>
                      <div className="text-right text-emerald-400">• 0 sec<br/>drift</div>
                    </div>
                 </div>
                 
                 <div className="flex justify-between items-center py-2 border-b border-slate-100">
                   <div>
                     <div className="text-xs font-bold text-slate-900">Statutory Retention Policy</div>
                     <div className="text-[9px] text-slate-500">Mandated under SEC Rule 17a-4</div>
                   </div>
                   <div className="text-xs font-mono font-bold text-slate-700 bg-slate-100 px-2 py-1 rounded border border-slate-200">7 Years</div>
                 </div>
                 
                 <div>
                   <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-2">Default Export Artifacts</div>
                   <div className="space-y-1.5">
                     <div className="inline-flex items-center text-[10px] font-mono text-slate-700 bg-slate-100 px-2 py-1 rounded w-full">
                       <FileText className="h-3 w-3 mr-2 text-slate-400" /> PDF / Formal Attestation
                     </div>
                     <div className="inline-flex items-center text-[10px] font-mono text-slate-700 bg-slate-100 px-2 py-1 rounded w-full">
                       <Code className="h-3 w-3 mr-2 text-slate-400" /> JSON-LD Lineage
                     </div>
                     <div className="inline-flex items-center text-[10px] font-mono text-slate-700 bg-slate-100 px-2 py-1 rounded w-full">
                       <FileText className="h-3 w-3 mr-2 text-slate-400" /> SEC XBRL-Audit Map
                     </div>
                   </div>
                 </div>
                 
              </CardContent>
              <div className="bg-emerald-50/80 p-3 flex items-start space-x-2 border-t border-emerald-100">
                <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                <div className="text-[10px] text-emerald-800 leading-relaxed">All system tamper-detection probes passing without exception.</div>
              </div>
            </Card>

          </div>
        </div>

      </div>
    </div>
  )
}

function SlidersIcon(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="4" x2="20" y1="21" y2="21" />
      <line x1="4" x2="20" y1="14" y2="14" />
      <line x1="4" x2="20" y1="7" y2="7" />
      <polyline points="12 17 12 21" />
      <polyline points="16 10 16 14" />
      <polyline points="8 3 8 7" />
    </svg>
  )
}

function MockSwitch({ checked }: { checked?: boolean }) {
  return (
    <div className={`w-8 h-4 rounded-full flex items-center p-0.5 mt-0.5 cursor-pointer ${checked ? 'bg-slate-900' : 'bg-slate-200'}`}>
      <div className={`w-3 h-3 bg-white rounded-full shadow-sm transform transition-transform ${checked ? 'translate-x-4' : 'translate-x-0'}`}></div>
    </div>
  )
}
