import { Button } from "../components/ui/button"
import { Badge } from "../components/ui/badge"
import { Link } from "react-router-dom"
import { 
  CheckCircle2, ArrowRight, Lock, ShieldCheck, FileText, 
  Activity, Database, Cpu, Search, AlertTriangle, Code, Play
} from "lucide-react"

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-50 font-sans selection:bg-indigo-500/20 flex flex-col overflow-x-hidden">
      
      {/* 1. Global Navigation & Status */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-[1400px] mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-12">
            <div className="flex items-center space-x-2">
              <div className="w-6 h-6 bg-slate-900 flex items-center justify-center rounded-[4px]">
                <div className="w-3 h-3 bg-white rounded-sm transform rotate-45"></div>
              </div>
              <span className="text-lg font-black tracking-tighter text-slate-900">VERIFIN</span>
              <span className="text-[8px] font-bold uppercase tracking-widest text-slate-400 leading-none ml-2 border-l border-slate-300 pl-2">Financial AI Audit<br/>Engine</span>
            </div>
            
            <nav className="hidden lg:flex items-center space-x-8">
              <a href="#product" className="text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-full">Product</a>
              <a href="#how-it-works" className="text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors">How it Works</a>
              <a href="#architecture" className="text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors">Architecture & NLI</a>
              <a href="#enterprise" className="text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors">Enterprise Research</a>
              <a href="#pricing" className="text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors">Pricing</a>
            </nav>
          </div>
          
          <div className="flex items-center space-x-4">
            <a href="#" className="text-xs font-semibold text-slate-600 hover:text-slate-900 hidden sm:block">Sign In</a>
            <Button variant="outline" className="h-9 text-xs font-semibold border-slate-200 hidden sm:flex">Try Live Demo</Button>
            <Link to="/verify">
              <Button className="h-9 text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800 shadow-md">
                Request Institutional Access
              </Button>
            </Link>
          </div>
        </div>
      </div>
      
      {/* Live Status Ticker */}
      <div className="bg-slate-900 text-slate-300 py-1.5 px-6 border-b border-black overflow-hidden flex items-center text-[9px] font-mono tracking-widest">
         <div className="flex items-center space-x-8 whitespace-nowrap animate-pulse">
           <div className="flex items-center text-emerald-400 font-bold"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-2 shadow-[0_0_8px_rgba(16,185,129,0.8)]"></span> CLUSTER STATUS: ACTIVE</div>
           <div>EDGAR BROADBAND LATENCY: 34ms</div>
           <div>NLI INFERENCE-V2 QUEUE: ONLINE</div>
           <div className="text-slate-500 hidden md:block">AUDIT HASH (SHA256): 1...e2f94</div>
           <div className="text-slate-500 hidden lg:block">PARITY: 100% SEC 17a-4</div>
         </div>
      </div>

      {/* 2. Hero Section */}
      <div id="product" className="bg-white border-b border-slate-200 py-20 lg:py-32 relative overflow-hidden">
        {/* Background Grid Pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]"></div>
        
        <div className="max-w-[1400px] mx-auto px-6 relative z-10">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            
            {/* Left Copy */}
            <div className="max-w-xl">
              <div className="inline-flex items-center space-x-2 bg-indigo-50 border border-indigo-100 text-indigo-700 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest mb-8">
                <ShieldCheck className="h-3.5 w-3.5" />
                <span>SEC Edgar Aligned • NLI Engine v3.4 Active • Zero Unbacked Claims</span>
              </div>
              <h1 className="text-5xl lg:text-6xl font-black tracking-tight text-slate-900 leading-[1.1] mb-6">
                Verify every financial claim before you trust it.
              </h1>
              <p className="text-lg text-slate-600 mb-10 leading-relaxed font-serif">
                VERIFIN decomposes LLM-generated financial answers into atomic claims, retrieves supporting evidence from authoritative SEC filings, verifies each claim using Natural Language Inference, and provides interpretable hallucination-risk signals.
              </p>
              
              <div className="flex flex-col sm:flex-row items-center space-y-4 sm:space-y-0 sm:space-x-4 mb-8">
                <Link to="/verify" className="w-full sm:w-auto">
                  <Button className="w-full h-12 px-8 text-sm font-bold bg-[#0a0f1c] text-white hover:bg-slate-800 shadow-lg shadow-indigo-900/20">
                    Start Verification Run <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
                <Link to="/verify" className="w-full sm:w-auto">
                  <Button variant="outline" className="w-full h-12 px-8 text-sm font-bold border-slate-200 text-slate-700 hover:bg-slate-50">
                    <Play className="mr-2 h-4 w-4 text-indigo-600" /> Explore Live Interactive Demo
                  </Button>
                </Link>
              </div>
              
              <div className="flex items-center text-[10px] font-mono text-slate-500">
                <Database className="h-3.5 w-3.5 mr-2 text-slate-400" />
                Pre-Loaded with Apple FY25 10-K, Tesla, NVIDIA, and Berkshire transcripts.
              </div>
            </div>
            
            {/* Right App Preview (Stylized Mockup) */}
            <div className="relative">
               {/* Decorative elements */}
               <div className="absolute -inset-4 bg-gradient-to-r from-indigo-500 to-emerald-500 opacity-20 blur-2xl rounded-[40px]"></div>
               
               <div className="bg-white border border-slate-200 shadow-2xl rounded-xl overflow-hidden relative flex flex-col">
                 {/* Mock App Header */}
                 <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 flex justify-between items-center text-[10px] font-mono font-bold">
                   <div className="flex items-center text-slate-500"><Activity className="h-3 w-3 mr-2 text-indigo-500" /> LIVE AUDIT SESSION // AAPL_FY2025_04</div>
                   <div className="flex items-center text-emerald-600"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5"></span> NLI INFERENCE ONLINE</div>
                 </div>
                 
                 <div className="p-6 bg-white space-y-6">
                   {/* Mock Claim Context */}
                   <div className="bg-slate-50 p-4 rounded border border-slate-100">
                     <div className="flex justify-between items-center mb-2">
                       <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">AI GENERATED ANSWER UNDER AUDIT</div>
                       <div className="text-[9px] font-mono text-slate-400">Target DB : models.llama.3_2.fin</div>
                     </div>
                     <p className="text-sm font-serif text-slate-800 leading-relaxed">
                       "Apple's revenue increased by <span className="bg-emerald-100 text-emerald-900 font-bold px-1 rounded">8% to $29.8B</span>, primarily driven by strong iPhone sales and a <span className="bg-rose-100 text-rose-900 font-bold px-1 rounded border border-rose-200">12% increase</span> in Services revenue."
                     </p>
                   </div>
                   
                   <div>
                     <div className="flex justify-between items-center mb-3 text-[9px] font-bold uppercase tracking-widest text-slate-400">
                       <span>Atomic Claim Evaluation Stream</span>
                       <span>Active/Strict: NLI Pass</span>
                     </div>
                     
                     {/* Mock Claim 1 */}
                     <div className="border border-emerald-200 rounded p-4 mb-3 bg-emerald-50/30">
                       <div className="flex justify-between items-start mb-2">
                         <div className="text-xs font-bold text-slate-900 font-mono">CLM_01 "Revenue increased by 8%"</div>
                         <div className="text-[9px] font-bold text-emerald-700 uppercase bg-emerald-100 px-2 py-0.5 rounded">Supported</div>
                       </div>
                       <div className="flex justify-between text-[10px] font-mono text-slate-500">
                         <div>NLI Conf • SEC 10-K Item 7, p. 42</div>
                         <div className="text-emerald-700">Entail: 99% ...0.03</div>
                       </div>
                     </div>
                     
                     {/* Mock Claim 2 (Contradiction) */}
                     <div className="border border-rose-300 rounded p-4 bg-white relative overflow-hidden shadow-[0_0_15px_rgba(244,63,94,0.1)]">
                       <div className="absolute left-0 top-0 bottom-0 w-1 bg-rose-500"></div>
                       <div className="flex justify-between items-start mb-2">
                         <div className="text-xs font-bold text-slate-900 font-mono">CLM_02 "Services revenue increased by 12%"</div>
                         <div className="text-[9px] font-bold text-rose-700 uppercase bg-rose-100 px-2 py-0.5 rounded border border-rose-200 flex items-center">
                           <AlertTriangle className="h-2.5 w-2.5 mr-1" /> Contradicted
                         </div>
                       </div>
                       <div className="text-[10px] font-mono text-slate-600 mb-1">
                         <span className="font-bold text-rose-600">Num Diff •</span> Form 10-K reports 13.0% [$96.17B vs $85.20B]
                       </div>
                       <div className="text-[10px] font-mono font-bold text-rose-600">Variance: -1.00 Bps</div>
                     </div>
                   </div>
                   
                   {/* Footer Bar */}
                   <div className="bg-slate-900 rounded p-3 flex justify-between items-center text-white mt-4 shadow-lg">
                      <div className="flex items-center space-x-3">
                        <div className="w-6 h-6 rounded bg-slate-800 flex items-center justify-center">
                          <div className="w-3 h-3 border-2 border-white rounded-full border-t-transparent animate-spin"></div>
                        </div>
                        <div className="text-[9px] font-bold uppercase tracking-widest font-sans leading-tight text-slate-300">
                          Hallucination Prob<br/><span className="text-white text-xs font-mono">22% (Critical)</span>
                        </div>
                      </div>
                      <div className="flex items-center space-x-4">
                        <div className="text-right text-[9px] font-mono text-slate-400 leading-tight">Trust Score<br/><span className="text-white text-sm">91 / 100</span></div>
                        <Button size="sm" className="h-7 text-[10px] font-bold bg-white text-slate-900 hover:bg-slate-200">Stop Run</Button>
                      </div>
                   </div>
                 </div>
               </div>
            </div>

          </div>
        </div>
      </div>

      {/* 3. Feature Sections: SEC Artifacts */}
      <div id="architecture" className="bg-indigo-50/50 py-24 border-b border-slate-200">
        <div className="max-w-[1400px] mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between items-end mb-12">
            <div>
              <div className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest mb-2 font-mono">Endosmic Retrieval Artifacts</div>
              <h2 className="text-3xl font-black text-slate-900 tracking-tight">Cryptographically Grounded in SEC EDGAR Filings</h2>
            </div>
            <p className="text-sm text-slate-600 max-w-md mt-4 md:mt-0 text-right font-serif italic">
              Every proposition is cross-mapped to high-density XBRL data vectors, earnings call recordings, and 10-K disclosures with deterministic cross-reference offsets.
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-6">
            {/* Artifact 1 */}
            <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow">
               <div className="flex justify-between items-start mb-4 border-b border-slate-100 pb-4">
                 <div className="text-[10px] font-mono font-bold text-slate-900">AAPL 10-K // FY2025</div>
                 <Badge className="bg-indigo-50 text-indigo-700 hover:bg-indigo-50 border border-indigo-100 text-[8px] rounded uppercase">Item 7 MD&A</Badge>
               </div>
               <p className="text-xs font-serif text-slate-600 leading-relaxed mb-6 h-16">
                 "...Net sales of Services were $96,170 million in 2025, compared to $85,200 million in 2024, an increase of 13% or $10,970 million..."
               </p>
               <div className="flex justify-between items-center text-[9px] font-mono text-slate-400 pt-4 border-t border-slate-100">
                 <div>CIK: 0000320193</div>
                 <div>Offset: 11842 → 11864</div>
               </div>
            </div>
            {/* Artifact 2 */}
            <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow">
               <div className="flex justify-between items-start mb-4 border-b border-slate-100 pb-4">
                 <div className="text-[10px] font-mono font-bold text-slate-900">NVDA 10-Q // Q2 FY2025</div>
                 <Badge className="bg-indigo-50 text-indigo-700 hover:bg-indigo-50 border border-indigo-100 text-[8px] rounded uppercase">Data Center Rev</Badge>
               </div>
               <p className="text-xs font-serif text-slate-600 leading-relaxed mb-6 h-16">
                 "...Compute revenue increased 152% sequentially, driven by Hopper architecture ramp and hyperscale cloud demand for AI training clusters..."
               </p>
               <div className="flex justify-between items-center text-[9px] font-mono text-slate-400 pt-4 border-t border-slate-100">
                 <div>CIK: 0001045810</div>
                 <div>Section 2.1</div>
               </div>
            </div>
            {/* Artifact 3 */}
            <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow">
               <div className="flex justify-between items-start mb-4 border-b border-slate-100 pb-4">
                 <div className="text-[10px] font-mono font-bold text-slate-900">TSLA 10-K // FY2024</div>
                 <Badge className="bg-indigo-50 text-indigo-700 hover:bg-indigo-50 border border-indigo-100 text-[8px] rounded uppercase">Treasury Reserves</Badge>
               </div>
               <p className="text-xs font-serif text-slate-600 leading-relaxed mb-6 h-16">
                 "...Cash, cash equivalents and U.S. Treasury Bills totaled $29.1 billion at December 31, reflecting prudent liquidity management amidst yield volatility..."
               </p>
               <div className="flex justify-between items-center text-[9px] font-mono text-slate-400 pt-4 border-t border-slate-100">
                 <div>CIK: 0001318605</div>
                 <div>Balance Sheet Note 4</div>
               </div>
            </div>
          </div>
        </div>
      </div>

      {/* Feature Sections: How VERIFIN Works Pipeline */}
      <div id="how-it-works" className="bg-white py-24 border-b border-slate-200">
        <div className="max-w-[1400px] mx-auto px-6">
          <div className="mb-16">
            <div className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest mb-2 font-mono">Verification Lifecycle</div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">How VERIFIN Works</h2>
            <p className="text-sm text-slate-500 mt-3 max-w-2xl font-serif">From raw generative language to cryptographically grounded financial facts in under 2 seconds.</p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Stage 1 */}
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-6 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity"><FileText className="w-24 h-24" /></div>
              <div className="relative z-10">
                <div className="text-[10px] font-mono font-bold text-slate-500 bg-white border border-slate-200 px-2 py-1 rounded inline-block mb-4">STAGE 01</div>
                <h3 className="text-sm font-bold text-slate-900 mb-2">LLM Answer Ingestion</h3>
                <p className="text-xs text-slate-600 leading-relaxed mb-6">Deserializes raw generative text from proprietary analyst models, internal chatbots, or external API responses without requiring fine-tuning access.</p>
                <div className="text-[9px] font-mono font-bold text-indigo-600 flex items-center"><span className="w-1.5 h-1.5 bg-indigo-500 rounded-full mr-1.5"></span> Unstructured Text Parsing</div>
              </div>
            </div>
            {/* Stage 2 */}
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-6 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity"><Database className="w-24 h-24" /></div>
              <div className="relative z-10">
                <div className="text-[10px] font-mono font-bold text-slate-500 bg-white border border-slate-200 px-2 py-1 rounded inline-block mb-4">STAGE 02</div>
                <h3 className="text-sm font-bold text-slate-900 mb-2">Syntactic Claim Decomposition</h3>
                <p className="text-xs text-slate-600 leading-relaxed mb-6">Splits compound sentences into discrete, falsifiable atomic propositions with extracted monetary entities, fiscal periods, and percentage bounds.</p>
                <div className="text-[9px] font-mono font-bold text-indigo-600 flex items-center"><span className="w-1.5 h-1.5 bg-indigo-500 rounded-full mr-1.5"></span> Entity & Timeframe Anchoring</div>
              </div>
            </div>
            {/* Stage 3 */}
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-6 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity"><Search className="w-24 h-24" /></div>
              <div className="relative z-10">
                <div className="text-[10px] font-mono font-bold text-slate-500 bg-white border border-slate-200 px-2 py-1 rounded inline-block mb-4">STAGE 03</div>
                <h3 className="text-sm font-bold text-slate-900 mb-2">Dense Passage Retrieval</h3>
                <p className="text-xs text-slate-600 leading-relaxed mb-6">ColBERT-v2 multi-vector token scoring pinpoints authoritative reference chunks directly from real-time SEC EDGAR filings and text-blob filings cache.</p>
                <div className="text-[9px] font-mono font-bold text-indigo-600 flex items-center"><span className="w-1.5 h-1.5 bg-indigo-500 rounded-full mr-1.5"></span> Sub-Millisecond Index Search</div>
              </div>
            </div>
            {/* Stage 4 */}
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-6 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity"><Cpu className="w-24 h-24" /></div>
              <div className="relative z-10">
                <div className="text-[10px] font-mono font-bold text-slate-500 bg-white border border-slate-200 px-2 py-1 rounded inline-block mb-4">STAGE 04</div>
                <h3 className="text-sm font-bold text-slate-900 mb-2">Cross-Encoder NLI Engine</h3>
                <p className="text-xs text-slate-600 leading-relaxed mb-6">Fine-tuned RoBERTa-v3 evaluates pairs for Entailment, Contradiction, or Neutral hypotheses under strict probability boundaries.</p>
                <div className="text-[9px] font-mono font-bold text-indigo-600 flex items-center"><span className="w-1.5 h-1.5 bg-indigo-500 rounded-full mr-1.5"></span> Tri-State Classification</div>
              </div>
            </div>
            {/* Stage 5 */}
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-6 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity"><Activity className="w-24 h-24" /></div>
              <div className="relative z-10">
                <div className="text-[10px] font-mono font-bold text-slate-500 bg-white border border-slate-200 px-2 py-1 rounded inline-block mb-4">STAGE 05</div>
                <h3 className="text-sm font-bold text-slate-900 mb-2">Symbolic Math & Variance</h3>
                <p className="text-xs text-slate-600 leading-relaxed mb-6">Executes exact floating-point parity checks on billions, basis points, and currency exchanges, flagging delta thresholds and rev-rec drifts.</p>
                <div className="text-[9px] font-mono font-bold text-indigo-600 flex items-center"><span className="w-1.5 h-1.5 bg-indigo-500 rounded-full mr-1.5"></span> Deterministic Arithmetic Solver</div>
              </div>
            </div>
            {/* Stage 6 */}
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-6 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity"><Lock className="w-24 h-24" /></div>
              <div className="relative z-10">
                <div className="text-[10px] font-mono font-bold text-slate-500 bg-white border border-slate-200 px-2 py-1 rounded inline-block mb-4">STAGE 06</div>
                <h3 className="text-sm font-bold text-slate-900 mb-2">Explainable Audit Dossier</h3>
                <p className="text-xs text-slate-600 leading-relaxed mb-6">Publishes immutable, SHA-256 cryptographically stamped audit records compliant with SEC 17a-4 and FINRA Rule 3110 automated review archives.</p>
                <div className="text-[9px] font-mono font-bold text-indigo-600 flex items-center"><span className="w-1.5 h-1.5 bg-indigo-500 rounded-full mr-1.5"></span> WORM Compliance Storage Ready</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Feature Sections: Dual-Channel Inference */}
      <div className="bg-indigo-50/30 py-24 border-b border-slate-200">
        <div className="max-w-[1400px] mx-auto px-6">
          <div className="mb-16 max-w-3xl">
            <div className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest mb-2 font-mono">Inspection Architecture</div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">Dual-Channel Inference & Verification</h2>
            <p className="text-sm text-slate-600 mt-3 font-serif">VERIFIN separates Ground-Truth Document NLI (the sole decision authority) from Auxiliary Transformer Attention Analysis (secondary early-warning signals).</p>
          </div>
          
          <div className="grid lg:grid-cols-2 gap-8">
            {/* Primary Ground Truth Panel */}
            <div className="bg-white border border-slate-200 rounded-xl p-8 shadow-sm">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-base font-bold text-slate-900 flex items-center"><ShieldCheck className="h-4 w-4 mr-2 text-indigo-600" /> Primary Ground-Truth Verification</h3>
                <Badge className="bg-slate-900 text-white hover:bg-slate-800 border-none rounded text-[9px] px-2 py-0.5 uppercase tracking-widest">Sole Decision Maker</Badge>
              </div>
              <p className="text-xs text-slate-600 mb-8 leading-relaxed">
                Zero reliance on model self-reported certainty. The verification decision rests exclusively on bidirectional Natural Language Inference between extracted statements and regulatory filings.
              </p>
              
              <div className="border border-slate-200 rounded overflow-hidden mb-6">
                <table className="w-full text-xs font-mono text-left">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="py-2 px-4 font-bold text-slate-500 uppercase tracking-widest text-[9px]">NLI Hypothesis</th>
                      <th className="py-2 px-4 font-bold text-slate-500 uppercase tracking-widest text-[9px]">Threshold</th>
                      <th className="py-2 px-4 font-bold text-slate-500 uppercase tracking-widest text-[9px]">Risk Consequence</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-slate-100">
                      <td className="py-3 px-4 font-bold text-emerald-600">Entailment</td>
                      <td className="py-3 px-4 text-slate-600">≥ 0.85</td>
                      <td className="py-3 px-4 text-slate-600">Clearance Granted</td>
                    </tr>
                    <tr className="border-b border-slate-100 bg-rose-50/30">
                      <td className="py-3 px-4 font-bold text-rose-600">Contradiction</td>
                      <td className="py-3 px-4 text-slate-600">≥ 0.05</td>
                      <td className="py-3 px-4 font-bold text-rose-700">Hard Block & Alert</td>
                    </tr>
                    <tr>
                      <td className="py-3 px-4 font-bold text-amber-600">Neutral / Unfound</td>
                      <td className="py-3 px-4 text-slate-600">&lt; 0.85</td>
                      <td className="py-3 px-4 text-slate-600">Flag for Human Review</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              
              <div className="flex items-center text-[10px] font-mono text-slate-500 bg-slate-50 p-3 rounded">
                <CheckCircle2 className="h-3.5 w-3.5 mr-2 text-emerald-500" /> Deterministic mathematical audit trail generated on every run.
              </div>
            </div>

            {/* Auxiliary Telemetry Panel */}
            <div className="bg-white border border-slate-200 rounded-xl p-8 shadow-sm">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-base font-bold text-slate-900 flex items-center"><Activity className="h-4 w-4 mr-2 text-indigo-600" /> Auxiliary Telemetry</h3>
                <Badge className="bg-indigo-50 text-indigo-700 hover:bg-indigo-50 border border-indigo-200 rounded text-[9px] px-2 py-0.5 uppercase tracking-widest">Diagnostics Only</Badge>
              </div>
              <p className="text-xs text-slate-600 mb-8 leading-relaxed">
                Cross-attention dispersion scores and token entropy layers flag unstable generation patterns prior to output dissemination.
              </p>
              
              <div className="space-y-6 mb-8">
                <div className="bg-slate-50 border border-slate-200 p-4 rounded">
                  <div className="flex justify-between items-center mb-2">
                    <div className="text-[10px] font-mono font-bold text-slate-700">Attention Dispersion Index</div>
                    <div className="text-[10px] font-mono text-slate-500">0.142 (Nominal)</div>
                  </div>
                  <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden flex">
                    <div className="h-full bg-indigo-500 w-[14%]"></div>
                  </div>
                </div>
                
                <div className="bg-slate-50 border border-slate-200 p-4 rounded">
                  <div className="flex justify-between items-center mb-2">
                    <div className="text-[10px] font-mono font-bold text-slate-700">Self-Attention Entropy</div>
                    <div className="text-[10px] font-mono text-slate-500">3.81 nats</div>
                  </div>
                  <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden flex">
                    <div className="h-full bg-slate-700 w-[60%]"></div>
                  </div>
                </div>
              </div>
              
              <div className="text-[10px] font-mono text-slate-500 bg-slate-50 p-3 rounded leading-relaxed border-l-2 border-indigo-500">
                <span className="font-bold text-slate-700">Guardrail Policy:</span> Diagnostic telemetry infers confidence weighting but can never overrule Ground-Truth NLI Contradiction signals.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Benchmarks & API Section */}
      <div id="enterprise" className="bg-white py-24 border-b border-slate-200">
        <div className="max-w-[1400px] mx-auto px-6">
          <div className="text-center mb-16">
            <div className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest mb-2 font-mono">Quantitative Benchmarks</div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight mb-4">Engineered for Tier-1 Financial Latency & Precision</h2>
            <p className="text-sm text-slate-500 max-w-2xl mx-auto font-serif">Battle-tested in high-throughput production environments across quantitative hedge funds, investment banks, and compliance automation platforms.</p>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-24">
            <div className="bg-slate-50 border border-slate-100 p-6 rounded-lg text-center">
              <div className="text-4xl font-black text-slate-900 mb-2">&lt; 2.0s</div>
              <div className="text-xs font-bold text-slate-700 mb-2">Audit Latency SLA</div>
              <p className="text-[9px] text-slate-500 leading-relaxed">Full syntactic breakdown, EDGAR vector lookup, and NLI classification executed within streaming limits.</p>
            </div>
            <div className="bg-slate-50 border border-slate-100 p-6 rounded-lg text-center">
              <div className="text-4xl font-black text-slate-900 mb-2">99.4%</div>
              <div className="text-xs font-bold text-slate-700 mb-2">Numerical Accuracy</div>
              <p className="text-[9px] text-slate-500 leading-relaxed">Deterministic floating-point verification against authoritative XBRL filings eliminates math drift.</p>
            </div>
            <div className="bg-slate-50 border border-slate-100 p-6 rounded-lg text-center">
              <div className="text-4xl font-black text-slate-900 mb-2">100%</div>
              <div className="text-xs font-bold text-slate-700 mb-2">EDGAR & XBRL Coverage</div>
              <p className="text-[9px] text-slate-500 leading-relaxed">Direct access to 10-K, 10-Q, 8-K, Form 4, and earnings call transcripts dating back 15 years.</p>
            </div>
            <div className="bg-slate-50 border border-slate-100 p-6 rounded-lg text-center">
              <div className="text-4xl font-black text-slate-900 mb-2">$42.8M+</div>
              <div className="text-xs font-bold text-slate-700 mb-2">Capital Risk Mitigated</div>
              <p className="text-[9px] text-slate-500 leading-relaxed">Estimated exposure averted by catching hallucinated EPS, debt ratios, and non-existent covenants before portfolio trades.</p>
            </div>
          </div>
          
          {/* CLI/API Block */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl overflow-hidden p-8 shadow-sm">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
              <div>
                <div className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest mb-1 font-mono">CLI & REST Integration</div>
                <h3 className="text-xl font-bold text-slate-900">Single-Command Verification</h3>
              </div>
              <div className="mt-4 md:mt-0 bg-white border border-slate-200 px-3 py-1.5 rounded text-[10px] font-mono text-slate-600">
                v3-api-1 → POST api.verifin.ai/v3/audit
              </div>
            </div>
            
            <div className="bg-[#0d1117] rounded-lg p-5 overflow-x-auto text-xs font-mono leading-relaxed shadow-inner">
              <pre>
<span className="text-slate-500"># Ingest and audit generated financial text against AAPL FY2025</span>
<span className="text-emerald-400">curl</span> <span className="text-amber-300">-X POST</span> <span className="text-blue-300">"https://api.verifin.ai/v3/audit"</span> \
  <span className="text-amber-300">-H</span> <span className="text-blue-300">"Authorization: Bearer vfn_live_98x72ac4"</span> \
  <span className="text-amber-300">-H</span> <span className="text-blue-300">"Content-Type: application/json"</span> \
  <span className="text-amber-300">-d</span> <span className="text-amber-200">'{"{"}</span>
    <span className="text-sky-300">"claim_text"</span><span className="text-slate-300">: </span><span className="text-orange-300">"Apple Services segment gross margin expanded 70 bps to 74.2%"</span><span className="text-slate-300">,</span>
    <span className="text-sky-300">"target_ticker"</span><span className="text-slate-300">: </span><span className="text-orange-300">"AAPL"</span><span className="text-slate-300">,</span>
    <span className="text-sky-300">"filing_period"</span><span className="text-slate-300">: </span><span className="text-orange-300">"FY2025_10K"</span><span className="text-slate-300">,</span>
    <span className="text-sky-300">"strict_variance_bps"</span><span className="text-slate-300">: </span><span className="text-purple-400">10</span>
  <span className="text-amber-200">{"}"}'</span> <span className="text-emerald-400">|</span> jq .

<span className="text-slate-500"># Response</span>
<span className="text-slate-300">&gt;&gt; {"{"}"</span><span className="text-sky-300">status</span><span className="text-slate-300">": "</span><span className="text-emerald-400">SUPPORTED</span><span className="text-slate-300">", "</span><span className="text-sky-300">nli_confidence</span><span className="text-slate-300">": </span><span className="text-purple-400">0.994</span><span className="text-slate-300">, "</span><span className="text-sky-300">variance_bps</span><span className="text-slate-300">": </span><span className="text-purple-400">0</span><span className="text-slate-300">, "</span><span className="text-sky-300">provenance</span><span className="text-slate-300">": "</span><span className="text-orange-300">AAPL-10K-2025#sec7-p44</span><span className="text-slate-300">"{"}"}</span>
              </pre>
            </div>
            
            <div className="flex justify-between items-center mt-4 text-[10px] font-mono text-slate-500">
              <div>Python SDK: <span className="bg-slate-100 px-1 py-0.5 rounded text-slate-700">pip install verifin</span> • Node.js: <span className="bg-slate-100 px-1 py-0.5 rounded text-slate-700">npm i @verifin/sdk</span></div>
              <a href="#" className="font-bold text-indigo-600 hover:underline flex items-center">Read Full API Specification <ArrowRight className="h-3 w-3 ml-1" /></a>
            </div>
          </div>
        </div>
      </div>

      {/* 5. Final CTA */}
      <div id="pricing" className="bg-[#0a0f1c] py-24 text-center border-b border-white/10 relative overflow-hidden">
        {/* Glow effect */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-3xl h-full bg-indigo-500/10 blur-[100px] rounded-full pointer-events-none"></div>
        
        <div className="max-w-2xl mx-auto px-6 relative z-10">
          <div className="inline-flex items-center space-x-2 bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest mb-8">
            <Lock className="h-3.5 w-3.5" />
            <span>Deployment Ready • SOC 2 TYPE II CERTIFIED</span>
          </div>
          <h2 className="text-3xl md:text-4xl font-black text-white tracking-tight mb-6">Ready to eliminate financial AI hallucinations?</h2>
          <p className="text-sm text-slate-400 mb-10 leading-relaxed font-serif">
            Embed mathematical rigor and SEC filing traceability directly into your research workflows, internal portals, and automated market intelligence engines.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center space-y-4 sm:space-y-0 sm:space-x-4">
             <Link to="/verify">
               <Button className="h-12 px-8 text-sm font-bold bg-white text-slate-900 hover:bg-slate-200">
                 Launch Audit Workspace <ArrowRight className="ml-2 h-4 w-4" />
               </Button>
             </Link>
             <Link to="/verify">
               <Button variant="outline" className="h-12 px-8 text-sm font-bold border-white/20 text-white hover:bg-white/10">
                 <Cpu className="mr-2 h-4 w-4 text-indigo-400" /> Book Architecture Review
               </Button>
             </Link>
          </div>
          
          <div className="mt-10 flex justify-center items-center space-x-6 text-[9px] font-mono text-slate-500">
            <span>Instant API Sandbox Access</span>
            <span className="w-1 h-1 bg-slate-700 rounded-full"></span>
            <span>Custom Fine-Tuned Financial NLI Hosts</span>
            <span className="w-1 h-1 bg-slate-700 rounded-full"></span>
            <span>VPC Air-Gapped Installs</span>
          </div>
        </div>
      </div>

      {/* 6. Footer */}
      <footer className="bg-[#05080f] py-12 px-6">
        <div className="max-w-[1400px] mx-auto grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-8 mb-12">
          
          <div className="col-span-2 lg:col-span-2">
            <div className="flex items-center space-x-2 mb-4">
              <div className="w-6 h-6 bg-white flex items-center justify-center rounded-[4px]">
                <div className="w-3 h-3 bg-slate-900 rounded-sm transform rotate-45"></div>
              </div>
              <span className="text-lg font-black tracking-tighter text-white">VERIFIN</span>
              <span className="text-[10px] font-mono text-slate-500 ml-2">v3.4.1</span>
            </div>
            <p className="text-[10px] text-slate-400 leading-relaxed max-w-xs mb-6">
              Deterministic natural language inference and hallmarking for quantitative risk analysis, Tier-1 investment banks, and enterprise regulatory compliance.
            </p>
            <div className="text-[9px] font-mono text-slate-600 uppercase tracking-widest">
              SEC 17a-4 CERTIFIED • ISO 27001 ALIGNED
            </div>
          </div>
          
          <div>
            <h4 className="text-[10px] font-bold text-white uppercase tracking-widest mb-4">Compliance & Regs</h4>
            <ul className="space-y-3 text-[10px] text-slate-400 font-semibold">
              <li><a href="#" className="hover:text-white transition-colors">SEC 17a-4 Audit Vault</a></li>
              <li><a href="#" className="hover:text-white transition-colors">ISO 28022 Telemetry</a></li>
              <li><a href="#" className="hover:text-white transition-colors">FINRA Rule 2210 Claims</a></li>
              <li><a href="#" className="hover:text-white transition-colors">SR 11-7 Model Governance</a></li>
            </ul>
          </div>
          
          <div>
            <h4 className="text-[10px] font-bold text-white uppercase tracking-widest mb-4">Architecture & Data</h4>
            <ul className="space-y-3 text-[10px] text-slate-400 font-semibold">
              <li><a href="#" className="hover:text-white transition-colors">NLI Hallucination Bounds</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Vector Chunk Citations</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Research Whitepapers</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Institutional REST / WB API</a></li>
            </ul>
          </div>
          
          <div>
            <h4 className="text-[10px] font-bold text-white uppercase tracking-widest mb-4">Trust & Operations</h4>
            <ul className="space-y-3 text-[10px] text-slate-400 font-semibold">
              <li><a href="#" className="hover:text-white transition-colors">SOC 2 Type II Security</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Global System Status</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Lineage Hash Registry</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Privacy & Data Isolation</a></li>
            </ul>
          </div>
          
        </div>
        
        <div className="max-w-[1400px] mx-auto pt-8 border-t border-white/10 flex flex-col md:flex-row justify-between items-center text-[9px] font-mono text-slate-600">
          <div>© 2026 VERIFIN Algorithmic Labs Inc. All rights reserved.</div>
          <div className="mt-4 md:mt-0">OPERATIONAL ENGINE: CLUSTER-US-EAST UPTIME 99.998%</div>
        </div>
      </footer>
      
    </div>
  )
}
