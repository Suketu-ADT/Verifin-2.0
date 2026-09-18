import { Button } from "../components/ui/button"
import { Link } from "react-router-dom"
import { Card, CardContent } from "../components/ui/card"
import { Badge } from "../components/ui/badge"
import { 
  Cpu, CheckCircle2, Hourglass, Lock, FileUp, ShieldCheck, 
  FileText, RefreshCw, HelpCircle, SlidersHorizontal, ChevronUp, Rocket, FileArchive
} from "lucide-react"

export default function VerificationFlow() {
  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-background overflow-hidden font-sans selection:bg-indigo-500/20 relative">
      
      {/* Scrollable Content Area (with padding at bottom for footer) */}
      <div className="flex-1 overflow-y-auto pb-32">
        <div className="max-w-[1400px] mx-auto w-full p-8 space-y-6">
          
          {/* Header Section */}
          <div className="flex justify-between items-start">
            <div>
              <div className="flex items-center space-x-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">
                <Badge className="bg-indigo-100 text-indigo-700 hover:bg-indigo-100 border-none rounded px-1.5 py-0 font-mono text-[9px]">PIPELINE EXECUTION MODE</Badge>
                <span>ID: 0x88F2_INGEST</span>
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white mb-2">Initiate Financial Claim Verification</h1>
              <p className="text-sm text-slate-500 max-w-2xl font-serif">
                Ingest institutional SEC filings or financial disclosures, decompose factual assertions, and verify semantic entailment.
              </p>
            </div>
            
            <div className="bg-slate-100/80 border border-slate-200 rounded-lg p-3 flex items-center space-x-4 shrink-0">
               <div className="w-8 h-8 rounded bg-slate-200 flex items-center justify-center text-slate-500">
                 <Cpu className="h-4 w-4" />
               </div>
               <div>
                 <div className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">GPU Worker Cluster:</div>
                 <div className="text-xs font-mono font-bold text-slate-900">32 Nodes (A100-80G)</div>
               </div>
            </div>
          </div>
          
          {/* 4-Stage Progress Tracker */}
          <div className="flex space-x-2">
            {/* Stage 1: Loaded */}
            <div className="flex-1 bg-[#0a0f1c] text-white rounded-lg p-4 flex items-center space-x-4 relative overflow-hidden shadow-lg shadow-slate-900/10">
              <div className="w-8 h-8 rounded bg-white/10 flex items-center justify-center text-xs font-mono font-bold">01</div>
              <div className="flex-1">
                <div className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">STAGE 1 • LOADED</div>
                <div className="text-sm font-bold">Document Ingestion</div>
              </div>
              <CheckCircle2 className="h-5 w-5 text-emerald-400" />
            </div>
            
            {/* Stage 2: Active Focus */}
            <div className="flex-1 bg-indigo-50 border border-indigo-100 text-indigo-900 rounded-lg p-4 flex items-center space-x-4 shadow-sm">
              <div className="w-8 h-8 rounded bg-indigo-900 text-white flex items-center justify-center text-xs font-mono font-bold">02</div>
              <div className="flex-1">
                <div className="text-[8px] font-bold text-indigo-400 uppercase tracking-widest mb-0.5">STAGE 2 • ACTIVE FOCUS</div>
                <div className="text-sm font-bold">Target Financial Query</div>
              </div>
              <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></div>
            </div>

            {/* Stage 3: Pending */}
            <div className="flex-1 bg-slate-100/50 border border-slate-200 text-slate-400 rounded-lg p-4 flex items-center space-x-4">
              <div className="w-8 h-8 rounded bg-slate-200/50 flex items-center justify-center text-xs font-mono font-bold text-slate-400">03</div>
              <div className="flex-1">
                <div className="text-[8px] font-bold uppercase tracking-widest mb-0.5">STAGE 3 • PENDING</div>
                <div className="text-sm font-bold">NLI & Entailment Engine</div>
              </div>
              <Hourglass className="h-4 w-4" />
            </div>

            {/* Stage 4: Locked */}
            <div className="flex-1 bg-slate-100/50 border border-slate-200 text-slate-400 rounded-lg p-4 flex items-center space-x-4">
              <div className="w-8 h-8 rounded bg-slate-200/50 flex items-center justify-center text-xs font-mono font-bold text-slate-400">04</div>
              <div className="flex-1">
                <div className="text-[8px] font-bold uppercase tracking-widest mb-0.5">STAGE 4 • LOCKED</div>
                <div className="text-sm font-bold">Audit Matrix & Proofs</div>
              </div>
              <Lock className="h-4 w-4" />
            </div>
          </div>
          
          {/* Main Two-Column Content */}
          <div className="grid grid-cols-2 gap-6">
            
            {/* LEFT COLUMN: Document Ingestion */}
            <div className="space-y-6">
              <Card className="border-slate-200 shadow-sm bg-white">
                <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 rounded-t-lg">
                   <div className="flex items-center space-x-3">
                     <FileUp className="h-5 w-5 text-slate-700" />
                     <h2 className="text-base font-bold text-slate-900">Step 1: Financial Document Source</h2>
                   </div>
                   <Badge className="bg-indigo-50 text-indigo-700 hover:bg-indigo-50 border border-indigo-100 text-[8px] rounded uppercase font-mono px-2 py-0.5">EDGAR / SEC<br/>COMPLIANT</Badge>
                </div>
                <CardContent className="p-6 space-y-6">
                  
                  {/* Drag and Drop Zone */}
                  <div className="border-2 border-dashed border-slate-200 rounded-xl bg-slate-50 p-8 flex flex-col items-center justify-center text-center">
                    <div className="w-10 h-10 rounded-full bg-slate-200/50 flex items-center justify-center mb-4">
                      <ShieldCheck className="h-5 w-5 text-slate-500" />
                    </div>
                    <p className="text-sm font-bold text-slate-700 mb-2">Drop your financial document here or <span className="text-indigo-600 font-normal cursor-pointer hover:underline">browse files</span></p>
                    <p className="text-[10px] text-slate-400 mb-4 max-w-xs">Supported: SEC 10-K, 10-Q, 8-K, Earnings Transcripts, XBRL Instance XML, Consolidated Balance Sheets (Max 50MB)</p>
                    <div className="flex space-x-2">
                      <Badge className="bg-white text-slate-500 border-slate-200 font-mono text-[9px] hover:bg-white">Auto-OCR Active</Badge>
                      <Badge className="bg-white text-slate-500 border-slate-200 font-mono text-[9px] hover:bg-white">Vector Embedding v2</Badge>
                    </div>
                  </div>
                  
                  {/* Active Document Card */}
                  <div>
                    <div className="flex justify-between items-end mb-4">
                      <div className="flex items-start space-x-3">
                        <div className="w-10 h-10 rounded bg-[#0a0f1c] text-white flex items-center justify-center shrink-0">
                          <FileArchive className="h-5 w-5" />
                        </div>
                        <div>
                          <div className="flex items-center space-x-2">
                            <div className="text-sm font-bold text-slate-900">Apple_Inc_FY2025_Annual_Report_10K.pdf</div>
                            <Badge className="bg-emerald-100 text-emerald-800 border-none rounded text-[8px] font-bold uppercase tracking-widest px-1 py-0 leading-tight">VERIFIED<br/>HASH</Badge>
                          </div>
                          <div className="text-[9px] font-mono text-slate-500 mt-1">SHA-256: 7e2f...b981ca99 • Filed with U.S. SEC</div>
                        </div>
                      </div>
                      <div className="text-[10px] font-bold text-slate-400 flex items-center cursor-pointer hover:text-slate-600">
                        <RefreshCw className="h-3 w-3 mr-1" /> Replace
                      </div>
                    </div>
                    
                    <div className="flex flex-wrap gap-2 mb-6">
                      <Badge className="bg-slate-100 text-slate-700 hover:bg-slate-100 border-none rounded font-mono text-[9px]">4.8 MB</Badge>
                      <Badge className="bg-slate-100 text-slate-700 hover:bg-slate-100 border-none rounded font-mono text-[9px]">184 Pages</Badge>
                      <Badge className="bg-slate-100 text-slate-700 hover:bg-slate-100 border-none rounded font-mono text-[9px]">CIK: 0000320193</Badge>
                      <Badge className="bg-slate-100 text-slate-700 hover:bg-slate-100 border-none rounded font-mono text-[9px]">FY 2025 (Period: 2025-09-27)</Badge>
                      <Badge className="bg-slate-900 text-white hover:bg-slate-900 border-none rounded font-mono text-[9px] font-bold">3,420 Extracted Vectors</Badge>
                    </div>
                    
                    {/* Segmented Progress Bar Block */}
                    <div className="bg-slate-50 border border-slate-100 rounded p-4 mb-4">
                      <div className="flex justify-between items-end mb-3">
                        <div className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Ingestion Matrix & Section Parsing</div>
                        <div className="text-[10px] font-mono text-slate-700 font-bold text-right leading-tight">100% Extracted (14 Disclosures)</div>
                      </div>
                      <div className="h-2 w-full bg-slate-200 rounded-full flex overflow-hidden mb-2">
                        <div className="h-full bg-slate-300 w-[28%]"></div>
                        <div className="h-full bg-indigo-500 w-[38%]"></div>
                        <div className="h-full bg-blue-500 w-[24%]"></div>
                        <div className="h-full bg-emerald-500 w-[10%]"></div>
                      </div>
                      <div className="flex justify-between text-[9px] font-mono text-slate-500 text-center">
                        <div className="w-[28%]">Part I: Business<br/>(28%)</div>
                        <div className="w-[38%]">Part II: MD&A<br/>(38%)</div>
                        <div className="w-[24%]">Financials<br/>(24%)</div>
                        <div className="w-[10%]">Notes<br/>(10%)</div>
                      </div>
                    </div>
                    
                    <div className="bg-emerald-50 text-emerald-800 p-3 rounded flex justify-between items-center border border-emerald-100">
                      <div className="flex items-center text-xs font-bold">
                        <CheckCircle2 className="h-4 w-4 mr-2 text-emerald-500" />
                        Ready for Semantic Decomposition & Verification
                      </div>
                      <div className="text-[10px] font-mono text-emerald-600 text-right">Indexed 0.4s ago</div>
                    </div>
                  </div>
                  
                </CardContent>
              </Card>
              
              {/* Lower Left UI: OCR & Graph */}
              <div className="space-y-4">
                <div className="bg-white border border-slate-200 rounded p-4 shadow-sm">
                  <div className="flex justify-between items-center mb-2">
                     <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest font-mono">Document Header Signature (OCR RAW)</div>
                     <div className="text-[9px] font-mono text-slate-400">PAGE 1 / INDEX</div>
                  </div>
                  <div className="bg-slate-50 border border-slate-100 p-3 rounded text-[9px] font-mono text-slate-600 leading-relaxed overflow-hidden">
                    "UNITED STATES SECURITIES AND EXCHANGE COMMISSION<br/>
                    Washington, D.C. 20549 FORM 10-K ANNUAL REPORT<br/>
                    PURSUANT TO SECTION 13 OR 15(d) OF THE SECURITIES...
                  </div>
                </div>
                
                <div className="bg-white border border-slate-200 rounded p-4 shadow-sm relative overflow-hidden">
                  <div className="flex justify-between items-center mb-4 relative z-10">
                     <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest font-mono">Document Graph Topology</div>
                     <div className="text-[10px] font-mono font-bold text-slate-700">3,420 Nodes • 8,924 Edges</div>
                  </div>
                  {/* Mock Graph Visualization */}
                  <div className="h-24 relative opacity-60">
                    <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
                      <path d="M 10 50 Q 50 10 100 50 T 200 40 T 300 60 T 400 30" fill="none" stroke="#cbd5e1" strokeWidth="1" strokeDasharray="4 4" />
                      <path d="M 20 80 Q 80 40 150 70 T 250 50 T 350 80" fill="none" stroke="#94a3b8" strokeWidth="1" strokeDasharray="2 2" />
                      <circle cx="10" cy="50" r="3" fill="#0f172a" />
                      <circle cx="100" cy="50" r="4" fill="#64748b" />
                      <circle cx="200" cy="40" r="4" fill="#0f172a" />
                      <circle cx="300" cy="60" r="6" fill="#3b82f6" />
                      <circle cx="400" cy="30" r="3" fill="#64748b" />
                      <circle cx="150" cy="70" r="5" fill="#6366f1" />
                    </svg>
                  </div>
                  <div className="absolute bottom-2 right-4 z-10 text-[9px] font-mono text-slate-400 bg-white/80 px-1">Embedding Dimension: 1,536-D Dense</div>
                </div>
              </div>
            </div>
            
            {/* RIGHT COLUMN: Query Formulation */}
            <div className="space-y-6">
              <Card className="border-slate-200 shadow-sm bg-white">
                <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 rounded-t-lg">
                   <div className="flex items-center space-x-3">
                     <HelpCircle className="h-5 w-5 text-slate-700" />
                     <h2 className="text-base font-bold text-slate-900">Step 2: Financial Query Formulation</h2>
                   </div>
                   <Badge className="bg-[#0a0f1c] text-white hover:bg-slate-900 border-none rounded uppercase font-mono px-2 py-0.5 text-[9px]">NLI Entailment</Badge>
                </div>
                <CardContent className="p-6 space-y-6">
                  
                  <div>
                    <div className="flex justify-between items-end mb-2">
                      <div className="text-[11px] font-bold text-slate-700">Target Financial Query / Statement to Audit</div>
                      <div className="text-[9px] font-mono text-slate-500">Token Count: 14</div>
                    </div>
                    <div className="bg-indigo-50/50 border border-indigo-100 rounded-lg p-4 relative">
                      <p className="text-sm font-serif text-slate-800 leading-relaxed mb-6">
                        What was <span className="font-bold">Apple's revenue growth in FY2025</span> and what were the major contributors?
                      </p>
                      <div className="absolute bottom-3 right-3 text-slate-400 cursor-pointer hover:text-slate-600">
                        <RefreshCw className="h-3 w-3" />
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <div className="flex justify-between items-end mb-3">
                      <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest font-mono">Suggested High-Precision Verification Scenarios</div>
                      <div className="text-[9px] font-mono text-blue-500 font-bold">Pre-calculated ground truths</div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge className="bg-blue-50 text-blue-700 border border-blue-100 hover:bg-blue-100 font-normal px-2 py-1 cursor-pointer">
                        <RefreshCw className="h-3 w-3 mr-1.5 inline" /> Revenue Growth & Segment Breakdown
                      </Badge>
                      <Badge className="bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100 font-normal px-2 py-1 cursor-pointer">
                        <RefreshCw className="h-3 w-3 mr-1.5 inline" /> Net Income & Diluted EPS
                      </Badge>
                      <Badge className="bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100 font-normal px-2 py-1 cursor-pointer">
                        <RefreshCw className="h-3 w-3 mr-1.5 inline" /> Operating Cash Flow vs Capex
                      </Badge>
                      <Badge className="bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100 font-normal px-2 py-1 cursor-pointer">
                        <RefreshCw className="h-3 w-3 mr-1.5 inline" /> Long-Term Debt & Liquidity
                      </Badge>
                      <Badge className="bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100 font-normal px-2 py-1 cursor-pointer">
                        <RefreshCw className="h-3 w-3 mr-1.5 inline" /> Gross Margin Dynamics
                      </Badge>
                    </div>
                  </div>
                  
                  {/* Advanced Configuration Accordion */}
                  <div className="bg-slate-50 border border-slate-200 rounded-lg overflow-hidden">
                    <div className="p-4 border-b border-slate-200 flex justify-between items-center cursor-pointer bg-slate-100/50">
                      <div className="flex items-center space-x-2 text-sm font-bold text-slate-800">
                        <SlidersHorizontal className="h-4 w-4" />
                        <span>Advanced Extraction & Inference Configuration</span>
                      </div>
                      <ChevronUp className="h-4 w-4 text-slate-500" />
                    </div>
                    
                    <div className="p-4 space-y-4">
                      {/* Config Row 1 */}
                      <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                        <div>
                          <div className="text-xs font-bold text-slate-800">Core Entailment Model</div>
                          <div className="text-[10px] text-slate-500">Pre-trained financial quantitative NLI classifier</div>
                        </div>
                        <div className="bg-white border border-slate-200 rounded p-1.5 flex items-center space-x-2">
                           <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 ml-1"></span>
                           <span className="text-[10px] font-mono font-bold text-slate-700">Fin-RoBERTa-Large-Audit v3.4</span>
                           <Badge className="bg-slate-100 text-slate-500 hover:bg-slate-100 border-none rounded text-[8px] px-1 font-mono">STRICT</Badge>
                        </div>
                      </div>
                      
                      {/* Config Row 2 */}
                      <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                        <div>
                          <div className="text-xs font-bold text-slate-800">Chunk Retrieval Strategy</div>
                          <div className="text-[10px] text-slate-500">Multi-tier semantic & keyword alignment</div>
                        </div>
                        <div className="bg-white border border-slate-200 rounded p-1.5 px-3">
                           <span className="text-[10px] font-mono text-slate-700">Hierarchical Hybrid (Dense ColBERT + BM25)</span>
                        </div>
                      </div>
                      
                      {/* Config Row 3 */}
                      <div className="flex justify-between items-center pb-4 border-b border-slate-100">
                        <div>
                          <div className="text-xs font-bold text-slate-800">Sub-claim Decomposition Granularity</div>
                          <div className="text-[10px] text-slate-500">Extract discrete financial propositions</div>
                        </div>
                        <div className="bg-white border border-slate-200 rounded p-1.5 px-3">
                           <span className="text-[10px] font-mono text-slate-700">Atomic (&lt;15 tokens / claim)</span>
                        </div>
                      </div>
                      
                      {/* Sliders */}
                      <div className="grid grid-cols-2 gap-6 pt-2">
                         <div>
                           <div className="flex justify-between items-center mb-2">
                             <div className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Hallucination Penalty</div>
                             <div className="text-[10px] font-mono font-bold text-slate-900">0.95</div>
                           </div>
                           <div className="h-1.5 w-full bg-slate-200 flex">
                             <div className="h-full bg-slate-900 w-[95%] relative">
                               <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-white border-2 border-slate-900 rounded-full shadow"></div>
                             </div>
                           </div>
                         </div>
                         <div>
                           <div className="flex justify-between items-center mb-2">
                             <div className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Confidence Floor</div>
                             <div className="text-[10px] font-mono font-bold text-slate-900">88.0%</div>
                           </div>
                           <div className="h-1.5 w-full bg-blue-100 flex">
                             <div className="h-full bg-blue-500 w-[88%] relative">
                               <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-white border-2 border-blue-500 rounded-full shadow"></div>
                             </div>
                           </div>
                         </div>
                      </div>
                    </div>
                  </div>
                  
                </CardContent>
              </Card>
              
              {/* Target Tri-State Output Classification */}
              <div className="space-y-3">
                 <div className="flex justify-between items-end">
                   <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest font-mono">Target Tri-State Output Classification</div>
                   <div className="text-[9px] font-mono text-slate-500">ISO 20022 Audit Ready</div>
                 </div>
                 <div className="grid grid-cols-3 gap-3">
                   <div className="bg-emerald-50/50 border border-emerald-100 rounded p-3 text-center">
                     <div className="text-[9px] font-bold text-emerald-700 uppercase tracking-widest mb-1">Supported</div>
                     <div className="text-[9px] font-mono text-emerald-600">Entailment &gt; 0.88</div>
                   </div>
                   <div className="bg-rose-50/50 border border-rose-100 rounded p-3 text-center">
                     <div className="text-[9px] font-bold text-rose-700 uppercase tracking-widest mb-1">Contradicted</div>
                     <div className="text-[9px] font-mono text-rose-600">Refutation Proof</div>
                   </div>
                   <div className="bg-amber-50/50 border border-amber-100 rounded p-3 text-center">
                     <div className="text-[9px] font-bold text-amber-700 uppercase tracking-widest mb-1">Unverifiable</div>
                     <div className="text-[9px] font-mono text-amber-600">Missing Citation</div>
                   </div>
                 </div>
              </div>
              
            </div>
            
          </div>
          
        </div>
      </div>
      
      {/* Floating Action Footer */}
      <div className="absolute bottom-0 left-0 right-0 bg-white/95 backdrop-blur shadow-[0_-8px_30px_rgba(0,0,0,0.05)] border-t border-slate-200">
        <div className="max-w-[1400px] mx-auto px-8 py-4 flex justify-between items-center">
           <Button variant="outline" className="h-12 bg-indigo-50/50 border-indigo-100 text-indigo-700 hover:bg-indigo-100 hover:text-indigo-800 space-x-2">
             <FileText className="h-4 w-4" />
             <span className="text-xs font-bold font-mono">Load Sample Demo (Apple FY25 10-K)</span>
           </Button>
           
           <div className="flex items-center space-x-12">
             <div className="text-[10px] font-mono text-slate-500">
               SEC Accession: 0000320193-25-000106
             </div>
             <div className="text-right">
               <div className="text-xs font-bold text-slate-900 font-mono">~2.4s execution time</div>
               <div className="text-[9px] font-mono text-slate-500 uppercase tracking-widest mt-0.5">Estimated Inference Cost: $0.0041</div>
             </div>
             
             <Link to="/dashboard">
               <Button className="h-12 px-8 bg-[#0a0f1c] text-white hover:bg-slate-900 shadow-lg shadow-indigo-900/20 text-sm font-bold transition-transform hover:scale-105 active:scale-95">
                 <Rocket className="mr-2 h-4 w-4" />
                 Start Deep Verification Pipeline
               </Button>
             </Link>
           </div>
        </div>
      </div>

    </div>
  )
}
