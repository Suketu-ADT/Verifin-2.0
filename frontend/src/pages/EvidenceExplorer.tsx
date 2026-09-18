import { Button } from "../components/ui/button"
import { Card, CardContent } from "../components/ui/card"
import { Badge } from "../components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table"
import { Input } from "../components/ui/input"
import { 
  Download, SlidersHorizontal, XCircle, BarChart2, CheckCircle2,
  ChevronLeft, ChevronRight, Search, ZoomIn, ExternalLink, FileText, Target, AlertTriangle, Crosshair, Code
} from "lucide-react"

export default function EvidenceExplorer() {
  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-background overflow-hidden font-sans selection:bg-rose-500/20">
      
      {/* Top Header */}
      <div className="px-6 py-4 bg-white dark:bg-slate-950 border-b flex justify-between items-center shrink-0">
        <div>
          <div className="flex items-center space-x-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
            <span>Audit Run #8942-B</span>
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
            <span className="text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-100">1 Contradiction Detected</span>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">AAPL FY2025 Earnings Assessment vs. Form 10-K</h1>
        </div>
        
        <div className="flex items-center space-x-6">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-1.5 text-xs font-mono font-bold text-slate-500">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span>CLM-01</span>
            </div>
            <div className="flex items-center space-x-1.5 text-xs font-mono font-bold text-white bg-slate-900 px-2 py-1 rounded-md">
              <span className="w-2 h-2 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.8)]"></span>
              <span>CLM-02</span>
              <span className="text-[9px] bg-rose-900/50 text-rose-300 px-1 py-0.5 rounded ml-1 uppercase tracking-widest">Rev</span>
            </div>
            <div className="flex items-center space-x-1.5 text-xs font-mono font-bold text-slate-500">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span>CLM-03</span>
            </div>
            <div className="flex items-center space-x-1.5 text-xs font-mono font-bold text-slate-500">
              <span className="w-2 h-2 rounded-full bg-amber-500"></span>
              <span>CLM-04</span>
            </div>
            <div className="flex items-center space-x-1.5 text-xs font-mono font-bold text-slate-500">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span>CLM-05</span>
            </div>
          </div>
        </div>
      </div>
      
      {/* Action Bar */}
      <div className="px-6 py-2 bg-white border-b flex space-x-2 shrink-0">
        <Button variant="outline" className="h-8 text-xs font-semibold text-slate-600 bg-slate-50">
          <Download className="mr-2 h-3.5 w-3.5" /> Export Audit Pack
        </Button>
        <Button variant="outline" className="h-8 text-xs font-semibold text-slate-600 bg-slate-50">
          <SlidersHorizontal className="mr-2 h-3.5 w-3.5" /> Config
        </Button>
      </div>

      {/* Main Two-Pane Content */}
      <div className="flex flex-1 min-h-0">
        
        {/* LEFT PANE: Verification Matrix */}
        <div className="w-[45%] overflow-y-auto p-6 space-y-6">
          
          {/* Active Claim Verification Card */}
          <Card className="border-rose-200 shadow-sm bg-white overflow-hidden">
            <div className="flex justify-between items-stretch">
              <div className="flex items-center bg-rose-100 text-rose-700 text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 border-r border-rose-200">
                <XCircle className="h-3 w-3 mr-1.5" /> Contradicted
              </div>
              <div className="flex items-center px-4 bg-rose-50/50 flex-1 border-b border-rose-100 justify-between">
                 <div className="text-xs text-rose-600 font-bold font-mono">94.2%<br/><span className="text-[9px] font-sans text-rose-500/80 uppercase">Confidence</span></div>
                 <div className="text-right">
                   <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Risk Level</div>
                   <div className="text-[10px] font-bold text-rose-700 bg-rose-100 px-1.5 py-0.5 rounded mt-0.5">CRITICAL / HIGH</div>
                 </div>
              </div>
            </div>
            <CardContent className="p-5">
              <h2 className="text-lg font-bold text-slate-900 mb-4">Active Claim #2 Verification</h2>
              
              <div className="mb-4">
                <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Generated Text Hypothesis (Claim)</div>
                <div className="text-sm font-serif italic text-slate-800 bg-slate-50 p-3 rounded border border-slate-100">
                  "Services revenue increased by 12%."
                </div>
              </div>
              
              <div className="flex space-x-6 text-xs font-mono text-slate-500 mb-6">
                <div>Model: <span className="font-bold text-slate-700">gpt-4o-fin-v2</span></div>
                <div>Chunk Span: <span className="font-bold text-slate-700">[T:4291-4308]</span></div>
                <div>Loss: <span className="font-bold text-slate-700">0.048</span></div>
              </div>
              
              <div>
                <div className="flex justify-between items-end mb-2">
                  <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Natural Language Inference</div>
                  <div className="text-[10px] font-bold text-rose-600 uppercase tracking-widest">Contradiction</div>
                </div>
                {/* NLI Progress Bar */}
                <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden flex">
                  <div className="h-full bg-rose-600" style={{ width: '94.2%' }}></div>
                  <div className="h-full bg-slate-300" style={{ width: '4.1%' }}></div>
                  <div className="h-full bg-emerald-500" style={{ width: '1.7%' }}></div>
                </div>
                <div className="flex justify-between text-[9px] font-mono text-slate-500 mt-2">
                  <span className="font-bold text-rose-600">Contradiction: 94.2%</span>
                  <span>Neutral: 4.1%</span>
                  <span>Entailment: 1.7%</span>
                </div>
              </div>
            </CardContent>
          </Card>
          
          {/* Numerical Discrepancy Matrix */}
          <Card className="border-slate-200 shadow-sm bg-white">
            <div className="flex justify-between items-center p-3 border-b border-slate-100 bg-slate-50">
               <div className="flex items-center text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                 <BarChart2 className="h-3.5 w-3.5 mr-1.5 text-rose-500" /> Numerical Discrepancy Matrix
               </div>
               <Badge className="bg-rose-100 text-rose-700 hover:bg-rose-100 border-none text-[9px] rounded font-mono px-1.5 py-0">Δ = -1.00 pp</Badge>
            </div>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Parameter</TableHead>
                    <TableHead className="text-[9px] font-bold uppercase tracking-widest text-slate-400 text-right">Extracted / LLM</TableHead>
                    <TableHead className="text-[9px] font-bold uppercase tracking-widest text-slate-400 text-right">SEC Form 10-K</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="text-xs font-medium text-slate-700 py-3">Growth Rate</TableCell>
                    <TableCell className="text-right text-xs font-mono font-bold text-rose-600 bg-rose-50/50">12.0%</TableCell>
                    <TableCell className="text-right text-xs font-mono font-bold text-emerald-600 bg-emerald-50/50">13.0%</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="text-xs font-medium text-slate-700 py-3">Implied Value</TableCell>
                    <TableCell className="text-right text-xs font-mono text-slate-600">$85.20B</TableCell>
                    <TableCell className="text-right text-xs font-mono text-slate-900 font-bold">$96.17B</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="text-xs font-medium text-slate-700 py-3">Period</TableCell>
                    <TableCell className="text-right text-xs font-mono text-slate-500">FY 2025 YoY</TableCell>
                    <TableCell className="text-right text-xs font-mono text-slate-500">FY 2025 YoY</TableCell>
                  </TableRow>
                  <TableRow className="bg-slate-50">
                    <TableCell className="text-[10px] font-bold uppercase tracking-widest text-rose-600 py-4 align-top">
                      Variance<br/>(Deficit)
                    </TableCell>
                    <TableCell colSpan={2} className="text-right text-sm font-mono font-bold text-rose-600 py-4">
                      -1.00 percentage point (-$1.18B Gross Net)
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
              
              <div className="p-5 border-t border-slate-100">
                <div className="flex justify-between items-end mb-2">
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Metric Delta Distribution</div>
                  <div className="text-[10px] font-bold text-rose-600 font-mono">-7.69% relative error</div>
                </div>
                <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden flex relative">
                  {/* Base line */}
                  <div className="absolute inset-0 bg-gradient-to-r from-rose-500 to-emerald-500 opacity-20"></div>
                  {/* Indicator Line */}
                  <div className="h-full bg-emerald-500 absolute right-0 w-[40%]"></div>
                  <div className="h-full bg-rose-600 absolute right-[40%] w-[25%]"></div>
                  {/* Target Mark */}
                  <div className="absolute top-0 bottom-0 w-0.5 bg-slate-900 right-[40%] shadow-[0_0_4px_rgba(0,0,0,0.5)]"></div>
                </div>
                <div className="flex justify-between text-[9px] font-mono text-slate-400 mt-2">
                  <span>LLM Target: 12.0%</span>
                  <span>Audited SEC Baseline: 13.0%</span>
                </div>
              </div>
            </CardContent>
          </Card>
          
          {/* Vector Retrieval Quality */}
          <Card className="border-slate-200 shadow-sm bg-white">
            <div className="flex justify-between items-center p-3 border-b border-slate-100">
               <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                 Vector Retrieval Quality
               </div>
               <div className="flex items-center text-[10px] font-mono font-bold text-amber-500">
                 <span className="text-amber-400 mr-2 text-sm tracking-[0.2em]">★★★★★</span> 5.0 / 5.0
               </div>
            </div>
            <CardContent className="p-5">
              <div className="flex gap-3 mb-6">
                 <div className="flex-1 bg-slate-50 p-3 rounded text-center border border-slate-100">
                   <div className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1">Evidence Rel.</div>
                   <div className="text-xl font-black text-slate-900 mb-2">98.2%</div>
                   <div className="h-1 w-full bg-slate-200 rounded-full overflow-hidden"><div className="h-full bg-slate-900 w-[98%]"></div></div>
                 </div>
                 <div className="flex-1 bg-blue-50/50 p-3 rounded text-center border border-blue-100">
                   <div className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1">Semantic Match</div>
                   <div className="text-xl font-black text-blue-700 mb-2">94.6%</div>
                   <div className="h-1 w-full bg-blue-200 rounded-full overflow-hidden"><div className="h-full bg-blue-600 w-[94%]"></div></div>
                 </div>
                 <div className="flex-1 bg-slate-50 p-3 rounded text-center border border-slate-100">
                   <div className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1">Passage Cov.</div>
                   <div className="text-xl font-black text-slate-900 mb-2">91.0%</div>
                   <div className="h-1 w-full bg-slate-200 rounded-full overflow-hidden"><div className="h-full bg-slate-700 w-[91%]"></div></div>
                 </div>
              </div>
              
              <div className="bg-slate-50 rounded border border-slate-200 p-4 relative">
                <div className="flex items-center text-[10px] font-bold text-emerald-700 uppercase tracking-widest mb-2">
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" /> Extracted SEC Premise Passage
                </div>
                <div className="text-sm font-serif italic text-slate-700 leading-relaxed">
                  "Services net sales grew <span className="bg-amber-100 font-bold px-1 rounded text-amber-900">13%</span> compared with fiscal 2024, reflecting growth in cloud, advertising, and App Store offerings."
                </div>
                <div className="text-[9px] font-mono text-slate-400 mt-3 pt-3 border-t border-slate-200">
                  Source: Item 7 MD&A (p. 43) Token Offset: #11,842 → #11,864
                </div>
              </div>
            </CardContent>
          </Card>
          
        </div>
        
        {/* RIGHT PANE: Document Viewer */}
        <div className="flex-1 bg-indigo-50/30 border-l border-slate-200 flex flex-col min-w-0 relative">
          
          {/* Viewer Header */}
          <div className="bg-white px-4 py-3 border-b flex justify-between items-center shrink-0 shadow-sm z-10">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 rounded bg-rose-100 flex items-center justify-center text-rose-600">
                <FileText className="h-4 w-4" />
              </div>
              <div>
                <div className="text-sm font-bold text-slate-900 font-mono truncate max-w-[200px]">Apple_Inc_10K_FY2025.pdf</div>
                <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">SEC EDGAR Official Archive • 14.8 MB</div>
              </div>
            </div>
            
            <div className="flex items-center bg-slate-50 border rounded-md">
               <Button variant="ghost" size="icon" className="h-8 w-8 rounded-none text-slate-500 hover:text-slate-900"><ChevronLeft className="h-4 w-4" /></Button>
               <span className="text-xs font-mono font-bold text-slate-700 px-3 border-x">Page 43 of 184</span>
               <Button variant="ghost" size="icon" className="h-8 w-8 rounded-none text-slate-500 hover:text-slate-900"><ChevronRight className="h-4 w-4" /></Button>
            </div>
          </div>
          
          {/* Viewer Toolbar */}
          <div className="bg-white/80 backdrop-blur px-4 py-2 border-b flex justify-between items-center shrink-0">
            <div className="relative w-64">
              <Search className="absolute left-2.5 top-1.5 h-4 w-4 text-slate-400" />
              <Input className="h-7 text-xs pl-8 bg-slate-50 border-slate-200 focus-visible:ring-0" defaultValue="Services revenue" />
            </div>
            <div className="flex items-center space-x-3 text-xs font-mono font-bold text-slate-500">
               <span>100%</span>
               <ZoomIn className="h-4 w-4 cursor-pointer hover:text-slate-900" />
               <div className="w-px h-4 bg-slate-300 mx-2"></div>
               <ExternalLink className="h-4 w-4 cursor-pointer hover:text-slate-900" />
            </div>
          </div>

          {/* Viewer Content Area */}
          <div className="flex-1 flex overflow-hidden relative">
            
            {/* Thumbnails Sidebar */}
            <div className="w-20 bg-slate-100/50 border-r border-slate-200 overflow-y-auto p-2 space-y-4 shrink-0 flex flex-col items-center">
               <div className="w-full aspect-[1/1.4] bg-white border border-slate-200 shadow-sm rounded-sm p-1 flex flex-col opacity-60">
                 <div className="w-full h-0.5 bg-slate-200 mb-1"></div>
                 <div className="w-full h-0.5 bg-slate-200 mb-1"></div>
                 <div className="w-3/4 h-0.5 bg-slate-200 mb-3"></div>
                 <div className="text-[6px] font-mono text-center text-slate-400 mt-auto">p. 42</div>
               </div>
               
               <div className="w-full aspect-[1/1.4] bg-white border-2 border-slate-900 shadow-md rounded-sm p-1 flex flex-col relative">
                 <div className="w-full h-1 bg-slate-900 mb-1"></div>
                 <div className="w-full h-0.5 bg-slate-200 mb-1"></div>
                 <div className="w-3/4 h-2 bg-amber-200 mb-2"></div>
                 <div className="w-full h-6 bg-indigo-50 mb-1"></div>
                 <div className="absolute bottom-1 right-1 w-1.5 h-1.5 bg-rose-500 rounded-full"></div>
                 <div className="text-[6px] font-mono font-bold text-center text-slate-900 mt-auto">p. 43</div>
               </div>
               
               <div className="w-full aspect-[1/1.4] bg-white border border-slate-200 shadow-sm rounded-sm p-1 flex flex-col opacity-60">
                 <div className="w-full h-0.5 bg-slate-200 mb-1"></div>
                 <div className="w-full h-0.5 bg-slate-200 mb-1"></div>
                 <div className="text-[6px] font-mono text-center text-slate-400 mt-auto">p. 44</div>
               </div>
            </div>
            
            {/* Main Document Scroll Area */}
            <div className="flex-1 overflow-y-auto p-8 flex justify-center bg-slate-100/50 pb-20">
              
              {/* The "Paper" */}
              <div className="bg-white w-full max-w-[600px] shadow-xl border border-slate-200 p-10 text-[11px] leading-relaxed text-slate-800 font-serif h-fit relative">
                
                <div className="flex justify-between items-start mb-8 border-b border-slate-900 pb-4">
                  <div className="font-sans font-bold text-xs text-slate-900 tracking-wider">
                    UNITED STATES SECURITIES AND<br/>EXCHANGE COMMISSION<br/>
                    <span className="text-[8px] text-slate-500 font-normal uppercase tracking-widest mt-1 block">Washington, D.C. 20549 • FORM 10-K • ANNUAL REPORT</span>
                  </div>
                  <div className="text-right text-[8px] font-mono text-slate-400">
                    SEC CIK:<br/><span className="text-slate-500">0000320193</span><br/>
                    Commission File:<br/><span className="text-slate-500">001-36743</span>
                  </div>
                </div>
                
                <h2 className="font-sans font-bold text-sm text-slate-900 mb-6">Apple Inc. (Exact name of Registrant as specified in its charter)</h2>
                
                <h3 className="font-sans font-bold text-[10px] tracking-wider text-slate-900 mb-4 mt-8">
                  ITEM 7. MANAGEMENT'S DISCUSSION AND ANALYSIS OF FINANCIAL CONDITION AND RESULTS OF OPERATIONS (CONTINUED)
                </h3>
                
                <p className="mb-4 text-justify">
                  Total net sales increased 8% or $29.8 billion during fiscal 2025 compared to fiscal 2024, driven by higher net sales of Services, iPhone, and Mac products. Continued adoption of enterprise hardware ecosystems alongside recurring subscription suites contributed significantly to total consolidated performance across all geographic operating segments.
                </p>
                
                {/* Highlighted Citation Block */}
                <div className="my-6 relative">
                   {/* Left Border indicator */}
                   <div className="absolute -left-10 top-0 bottom-0 w-1 bg-amber-400 rounded-full"></div>
                   
                   <div className="bg-[#FFF9D6] border border-amber-200 rounded p-4 relative shadow-sm">
                     <div className="flex justify-between items-start mb-2 border-b border-amber-200/50 pb-2">
                       <div className="flex items-center text-[8px] font-bold text-amber-700 uppercase tracking-widest font-sans">
                         <Target className="h-3 w-3 mr-1.5" /> Cited in Claim #2 (Line 14-16) • SEC CIK: 0000320193
                       </div>
                       <div className="text-[8px] font-bold text-amber-700 uppercase tracking-widest font-sans text-right">
                         Match Score:<br/><span className="text-amber-900 font-mono text-[10px]">98.2%</span>
                       </div>
                     </div>
                     <p className="font-bold text-slate-900 text-xs leading-relaxed">
                       "Net sales of Services increased <span className="bg-amber-400/60 px-1 py-0.5 rounded text-amber-950 mx-0.5">13%</span> or $11.0 billion during 2025 compared to 2024, driven primarily by gains in Advertising, Cloud Services, and Payment Services."
                     </p>
                   </div>
                   
                   {/* Audit Note below citation */}
                   <div className="mt-2 bg-white border border-rose-200 shadow-sm rounded p-3 flex items-start text-[10px] font-sans text-slate-600 ml-4">
                     <AlertTriangle className="h-3 w-3 text-rose-500 mr-1.5 shrink-0" />
                     <div>
                       <span className="font-bold text-rose-700">Audit Note:</span> LLM claimed 12.0%. The text specifically states 13% ($11.0B incremental), resulting in a factual error.
                     </div>
                   </div>
                </div>
                
                <p className="mb-6 mt-6 text-justify">
                  Cost of sales for Services increased in 2025 compared to 2024, primarily due to higher hosting, compute infrastructure costs, and content acquisition costs. Services gross margin percentage was 74.2% in 2025, compared to 70.8% in 2024, expanding 340 basis points due to higher services leverage and product mix.
                </p>
                
                <div className="font-sans text-[9px] font-bold text-slate-900 uppercase tracking-wider mb-3 mt-8">
                  TABLE 4: NET SALES BY PRODUCT AND SERVICE CATEGORY (DOLLARS IN MILLIONS)
                </div>
                
                <table className="w-full text-[10px] font-sans mb-8 border-t border-b border-slate-900">
                  <thead>
                    <tr className="border-b border-slate-300">
                      <th className="text-left py-2">Category</th>
                      <th className="text-right py-2">FY 2025</th>
                      <th className="text-right py-2">FY 2024</th>
                      <th className="text-right py-2">Change ($)</th>
                      <th className="text-right py-2">Change (%)</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-slate-100">
                      <td className="py-2">iPhone ®</td>
                      <td className="text-right py-2 font-mono">$209,586</td>
                      <td className="text-right py-2 font-mono">$200,583</td>
                      <td className="text-right py-2 font-mono">+$9,003</td>
                      <td className="text-right py-2 font-mono">+4%</td>
                    </tr>
                    <tr className="border-b border-slate-100">
                      <td className="py-2">Mac ®</td>
                      <td className="text-right py-2 font-mono">$31,950</td>
                      <td className="text-right py-2 font-mono">$29,357</td>
                      <td className="text-right py-2 font-mono">+$2,593</td>
                      <td className="text-right py-2 font-mono">+9%</td>
                    </tr>
                    <tr className="border-b border-slate-100 bg-amber-50">
                      <td className="py-2 font-bold text-slate-900">Services</td>
                      <td className="text-right py-2 font-mono font-bold text-slate-900">$96,170</td>
                      <td className="text-right py-2 font-mono">$85,200</td>
                      <td className="text-right py-2 font-mono text-emerald-700">+$10,970</td>
                      <td className="text-right py-2 font-mono text-emerald-700 font-bold bg-amber-200/50 px-1">+13%</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
            
            {/* Viewer Bottom Footer (Floating) */}
            <div className="absolute bottom-0 left-0 right-0 bg-white/95 backdrop-blur border-t border-slate-200 p-2 flex justify-between items-center text-[9px] font-mono text-slate-500 z-20 shadow-[0_-4px_10px_rgba(0,0,0,0.05)] px-4">
              <div className="flex items-center space-x-3">
                <div className="flex items-center"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5"></span> Doc Hash: <span className="font-bold text-slate-700 ml-1">0x4f8a...e9b2</span></div>
                <div>Vector Cosine Sim: <span className="font-bold text-slate-700">0.912</span></div>
                <div>Latency: <span className="font-bold text-slate-700">42ms</span></div>
              </div>
              <div className="flex items-center space-x-3">
                <div>Chunk Size: <span className="font-bold text-slate-700">512 TOKENS</span></div>
                <div className="flex items-center cursor-pointer hover:text-slate-900 font-bold">
                  <Code className="h-3 w-3 mr-1" /> Raw JSON
                </div>
              </div>
            </div>
            
          </div>
          
        </div>

      </div>
    </div>
  )
}
