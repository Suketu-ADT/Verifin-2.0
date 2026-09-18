import { Button } from "../components/ui/button"
import { Card, CardContent } from "../components/ui/card"
import { Badge } from "../components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table"
import { 
  Printer, Share2, Code, Download, ShieldCheck, CheckCircle2,
  AlertTriangle, Lock, FileSignature, CheckCircle, XCircle
} from "lucide-react"

export default function Reports() {
  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-background pb-12 font-sans selection:bg-primary/20">
      
      {/* Header */}
      <div className="px-8 py-6 bg-white dark:bg-slate-950 border-b">
        <div className="flex items-center text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-4 space-x-2">
          <span>VERIFIN</span>
          <span>&gt;</span>
          <span>Governance & Reports</span>
          <span>&gt;</span>
          <span className="text-foreground">CERT #VRF-2025-0984</span>
        </div>
        
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Formal Financial AI Verification Audit Report</h1>
            <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
              SEC EDGAR Ground-Truth Attestation & Deterministic Model Interpretability Certificate
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <Button variant="outline" size="icon" className="h-9 w-9 text-slate-500">
              <Printer className="h-4 w-4" />
            </Button>
            <Button variant="outline" className="text-sm font-semibold h-9 text-slate-600">
              <Share2 className="mr-2 h-4 w-4" /> Share Audit Link
            </Button>
            <Button variant="outline" className="text-sm font-semibold h-9 text-slate-600">
              <Code className="mr-2 h-4 w-4" /> JSON Spec
            </Button>
            <Button className="text-sm font-semibold h-9 bg-slate-900 text-white hover:bg-slate-800">
              <Download className="mr-2 h-4 w-4" /> Export Formal PDF
            </Button>
          </div>
        </div>
      </div>

      <div className="p-8 max-w-[1200px] mx-auto w-full space-y-6">
        
        {/* Attestation Banner & Meta */}
        <Card className="border-indigo-100 shadow-sm overflow-hidden bg-white">
          <div className="bg-indigo-50/50 border-b border-indigo-100 p-4 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-indigo-900 rounded-md flex items-center justify-center text-white">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h2 className="font-bold text-indigo-950 tracking-tight">VERIFIN ASSURANCE LABS</h2>
                  <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 border-none rounded text-[9px] px-1.5 py-0">SEC-ATTEST-V3.4</Badge>
                </div>
                <div className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mt-0.5">Certificate of Factual Consistency & Fidelity</div>
              </div>
            </div>
            <div className="flex space-x-4">
              <div className="flex items-center space-x-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                <span className="text-xs font-bold text-emerald-600 tracking-widest uppercase">STATUS: FORMALLY VALIDATED</span>
              </div>
              <Badge variant="outline" className="text-indigo-600 border-indigo-200 bg-indigo-50 text-[10px] uppercase font-mono rounded">Class: Statutory 10-K</Badge>
            </div>
          </div>
          <CardContent className="p-0 grid grid-cols-3 divide-x divide-slate-100">
            <div className="p-4">
               <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Target Entity / Registrant</div>
               <div className="font-bold text-sm text-slate-900">Apple Inc.</div>
               <div className="text-xs font-mono text-slate-500 mt-1">CIK: 0000320193 | NASDAQ: AAPL</div>
            </div>
            <div className="p-4">
               <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Source Truth Document</div>
               <div className="font-bold text-sm text-slate-900">Form 10-K (FY2023 Annual)</div>
               <div className="text-xs font-mono text-slate-500 mt-1">Period Ended: Sept 30, 2023 (SEC EDGAR)</div>
            </div>
            <div className="p-4">
               <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Source Ledger Hash</div>
               <div className="font-bold text-sm text-slate-900 font-mono text-xs truncate">SHA-256: 7a2f94...8931ca99</div>
               <div className="text-[10px] font-bold text-emerald-600 mt-1 flex items-center">
                 <CheckCircle2 className="h-3 w-3 mr-1" /> Immutable Ledger Verified
               </div>
            </div>
            <div className="p-4 col-span-2 border-t border-slate-100">
               <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Evaluated Query / Prompt Context</div>
               <div className="text-sm font-serif italic text-slate-700">
                 "What was Apple's revenue growth in FY2023 and what were the major contributors?"
               </div>
            </div>
            <div className="p-4 border-t border-slate-100">
               <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Model & Lens Auditor</div>
               <div className="font-bold text-sm text-slate-900 font-mono text-xs">gpt-4o-fin-v2 (temp: 0.0)</div>
               <div className="text-xs text-slate-500 mt-1">Morgan S. (SR-QRA #8421)</div>
            </div>
          </CardContent>
        </Card>

        {/* Executive Verdict Summary */}
        <div>
          <div className="flex justify-between items-end mb-3">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Executive Verdict Summary — ISO/IEC 42001 Evaluator Suite</h3>
            <span className="text-[10px] font-mono text-slate-400">Calculated Oct 18, 2025 14:32:07 UTC</span>
          </div>
          <div className="grid grid-cols-4 gap-4">
            <Card className="shadow-sm bg-white">
              <CardContent className="p-4">
                <div className="flex justify-between items-center mb-2">
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Aggregate Trust Score</div>
                  <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-none text-[9px] px-1.5 py-0 rounded">PASS</Badge>
                </div>
                <div className="flex items-baseline">
                  <span className="text-4xl font-black text-slate-900">91</span>
                  <span className="text-sm font-bold text-slate-400">/100</span>
                </div>
                <div className="h-1 w-full bg-slate-100 mt-3 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 w-[91%]"></div>
                </div>
                <div className="flex justify-between text-[10px] font-bold text-slate-400 mt-2">
                  <span>Threshold: 85.0</span>
                  <span className="text-emerald-500">+6.0 pts</span>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm bg-white">
              <CardContent className="p-4">
                <div className="flex justify-between items-center mb-2">
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Hallucination Risk</div>
                  <Badge className="bg-rose-100 text-rose-700 hover:bg-rose-100 border-none text-[9px] px-1.5 py-0 rounded">ELEVATED</Badge>
                </div>
                <div className="flex items-baseline space-x-2">
                  <span className="text-4xl font-black text-rose-600">23%</span>
                  <span className="text-xs font-bold text-rose-700 uppercase tracking-wider">Marginal</span>
                </div>
                <div className="h-1 w-full bg-slate-100 mt-3 rounded-full overflow-hidden flex">
                  <div className="h-full bg-emerald-500 w-[77%]"></div>
                  <div className="h-full bg-rose-500 w-[23%]"></div>
                </div>
                <div className="flex justify-between text-[10px] font-bold text-slate-400 mt-2">
                  <span>Ceiling Target: 30%</span>
                  <span className="text-emerald-500">&lt; Within Bounds</span>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm bg-white">
              <CardContent className="p-4">
                <div className="flex justify-between items-center mb-2">
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Evidence Grounding</div>
                  <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 border-none text-[9px] px-1.5 py-0 rounded font-mono">31/34 Chunks</Badge>
                </div>
                <div className="flex items-baseline space-x-2">
                  <span className="text-4xl font-black text-slate-900">91.0%</span>
                  <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider">High Fit</span>
                </div>
                <div className="h-1 w-full bg-slate-100 mt-3 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 w-[91%]"></div>
                </div>
                <div className="flex justify-between text-[10px] font-bold text-slate-400 mt-2">
                  <span>Cosine Sim: &gt; 0.820</span>
                  <span className="text-slate-500">Retrieved</span>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm bg-white">
              <CardContent className="p-4 flex flex-col justify-between h-full">
                <div className="flex justify-between items-center mb-2">
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Tri-State Claim Census</div>
                  <span className="text-[10px] font-bold text-slate-400">5 Total</span>
                </div>
                <div className="flex justify-between items-end flex-1 pb-1">
                  <div className="text-center">
                    <div className="text-[10px] font-bold text-emerald-600 mb-1">SUP</div>
                    <div className="text-2xl font-black text-emerald-600">4</div>
                    <div className="text-[9px] font-bold text-slate-400">80%</div>
                  </div>
                  <div className="text-center">
                    <div className="text-[10px] font-bold text-rose-600 mb-1">CON</div>
                    <div className="text-2xl font-black text-rose-600">1</div>
                    <div className="text-[9px] font-bold text-slate-400">20%</div>
                  </div>
                  <div className="text-center">
                    <div className="text-[10px] font-bold text-amber-500 mb-1">UNV</div>
                    <div className="text-2xl font-black text-slate-300">0</div>
                    <div className="text-[9px] font-bold text-slate-400">0%</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Section 01 */}
        <div>
          <div className="flex justify-between items-end mb-3 mt-8">
            <h3 className="text-sm font-bold text-slate-800"><span className="text-slate-400 mr-2">SECTION 01 /</span> Audited Model Generation & Claim Partitioning</h3>
            <div className="flex space-x-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">
               <span className="flex items-center"><span className="w-2 h-2 rounded bg-emerald-100 border border-emerald-500 mr-1.5"></span> Supported</span>
               <span className="flex items-center"><span className="w-2 h-2 rounded bg-rose-100 border border-rose-500 mr-1.5"></span> Contradicted</span>
               <span className="flex items-center"><span className="w-2 h-2 rounded bg-amber-50 border border-amber-400 mr-1.5"></span> Unverifiable</span>
            </div>
          </div>
          <Card className="shadow-sm bg-white border-slate-200">
            <div className="bg-slate-50 border-b border-slate-100 px-4 py-2 flex justify-between items-center text-[9px] font-mono font-bold text-slate-500 uppercase">
              <span>Prompt Execution Run #8942-A | Tokens: 348 | Latency: 840ms</span>
              <span className="text-emerald-600">NLI Entailment Confidence: 94.2% OVERALL</span>
            </div>
            <CardContent className="p-6 text-sm leading-loose text-slate-700 font-medium">
              In fiscal year 2023, Apple generated <span className="bg-emerald-50 border-b-2 border-emerald-500 py-0.5 relative group cursor-pointer">
                total net sales of $383.3 billion, representing an increase of 2.0% compared to fiscal year 2024.
                <span className="inline-flex items-center ml-1 bg-emerald-600 text-white text-[8px] font-bold px-1 py-0 rounded align-middle">CLAIM #01: SUPPORTED (0.96)</span>
              </span> The growth was primarily driven by the Services division, which <span className="bg-rose-50 border-b-2 border-rose-500 py-0.5 relative group cursor-pointer text-rose-900">
                surged 12.0% year-over-year to $86.2 billion.
                <span className="inline-flex items-center ml-1 bg-rose-600 text-white text-[8px] font-bold px-1 py-0 rounded align-middle">CLAIM #02: CONTRADICTED (IDX #142)</span>
              </span> iPhone net sales <span className="bg-emerald-50 border-b-2 border-emerald-500 py-0.5 relative group cursor-pointer">
                reached $201.2 billion, maintaining flat year-over-year performance compared to $200.6 billion in fiscal 2024.
                <span className="inline-flex items-center ml-1 bg-emerald-600 text-white text-[8px] font-bold px-1 py-0 rounded align-middle">CLAIM #03: SUPPORTED (0.97)</span>
              </span> Wearables, Home and Accessories net sales <span className="bg-emerald-50 border-b-2 border-emerald-500 py-0.5 relative group cursor-pointer">
                contracted by 7.2% to $37.0 billion due to lower consumer hardware demand.
                <span className="inline-flex items-center ml-1 bg-emerald-600 text-white text-[8px] font-bold px-1 py-0 rounded align-middle">CLAIM #04: SUPPORTED (0.94)</span>
              </span>
            </CardContent>
          </Card>
        </div>

        {/* Section 02 */}
        <div>
          <div className="flex justify-between items-end mb-3 mt-8">
            <h3 className="text-sm font-bold text-slate-800"><span className="text-slate-400 mr-2">SECTION 02 /</span> Deterministic Claim-by-Claim Verification Matrix</h3>
            <span className="text-[9px] font-bold font-mono text-slate-400 uppercase tracking-widest">Semantic Extractor: NLI-Transformer-XL</span>
          </div>
          <Card className="shadow-sm border-slate-200 overflow-hidden bg-white">
            <Table>
              <TableHeader className="bg-slate-50 border-b">
                <TableRow>
                  <TableHead className="text-[10px] font-bold uppercase tracking-widest text-slate-500 w-12">Claim ID</TableHead>
                  <TableHead className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Stated Assertion</TableHead>
                  <TableHead className="text-[10px] font-bold uppercase tracking-widest text-slate-500">SEC 10-K Citation</TableHead>
                  <TableHead className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Stated Val</TableHead>
                  <TableHead className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Truth Val</TableHead>
                  <TableHead className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Variance</TableHead>
                  <TableHead className="text-[10px] font-bold uppercase tracking-widest text-slate-500">NLI Score</TableHead>
                  <TableHead className="text-[10px] font-bold uppercase tracking-widest text-slate-500 text-right">Resolution</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow className="border-b">
                  <TableCell className="font-mono text-xs font-bold text-slate-500">CLM-01</TableCell>
                  <TableCell className="text-xs font-medium text-slate-700">Total net sales of $383.3B, + 2.0% YoY</TableCell>
                  <TableCell className="text-[10px] font-mono text-slate-500">Item 8, p. 32 [Chunk #142]</TableCell>
                  <TableCell className="text-xs font-mono">$383.285M</TableCell>
                  <TableCell className="text-xs font-mono">$383.285M</TableCell>
                  <TableCell className="text-xs font-bold text-emerald-500">0.0% <span className="font-normal text-[10px] text-slate-400 ml-1">(Exact)</span></TableCell>
                  <TableCell className="text-xs font-mono text-slate-500">0.962 Entail</TableCell>
                  <TableCell className="text-right">
                    <div className="inline-flex items-center text-[10px] font-bold uppercase tracking-widest text-emerald-600 bg-emerald-50 px-2 py-1 rounded">
                      <CheckCircle2 className="h-3 w-3 mr-1" /> Supported
                    </div>
                  </TableCell>
                </TableRow>
                <TableRow className="bg-rose-50/30 border-b border-rose-100">
                  <TableCell className="font-mono text-xs font-bold text-rose-600">CLM-02</TableCell>
                  <TableCell className="text-xs font-bold text-rose-900">Services division surged 12.0% YoY to $86.2B</TableCell>
                  <TableCell className="text-[10px] font-mono text-slate-500">Item 7, p. 43 [Chunk #198]</TableCell>
                  <TableCell className="text-xs font-mono text-rose-600 font-bold">12.0% Growth</TableCell>
                  <TableCell className="text-xs font-mono text-emerald-600 font-bold">13.8% Growth</TableCell>
                  <TableCell className="text-xs font-bold text-rose-600">-180 bps</TableCell>
                  <TableCell className="text-xs font-mono text-slate-500">0.041 Contradict</TableCell>
                  <TableCell className="text-right">
                    <div className="inline-flex items-center text-[10px] font-bold uppercase tracking-widest text-rose-600 bg-rose-100 px-2 py-1 rounded">
                      <XCircle className="h-3 w-3 mr-1" /> Contradict
                    </div>
                  </TableCell>
                </TableRow>
                <TableRow className="border-b">
                  <TableCell className="font-mono text-xs font-bold text-slate-500">CLM-03</TableCell>
                  <TableCell className="text-xs font-medium text-slate-700">iPhone sales reached $201.2B, flat YoY vs $200.6B</TableCell>
                  <TableCell className="text-[10px] font-mono text-slate-500">Item 7, p. 43 [Chunk #189]</TableCell>
                  <TableCell className="text-xs font-mono">$201,183M</TableCell>
                  <TableCell className="text-xs font-mono">$201,183M</TableCell>
                  <TableCell className="text-xs font-bold text-emerald-500">+0.2% <span className="font-normal text-[10px] text-slate-400 ml-1">(Flat)</span></TableCell>
                  <TableCell className="text-xs font-mono text-slate-500">0.974 Entail</TableCell>
                  <TableCell className="text-right">
                    <div className="inline-flex items-center text-[10px] font-bold uppercase tracking-widest text-emerald-600 bg-emerald-50 px-2 py-1 rounded">
                      <CheckCircle2 className="h-3 w-3 mr-1" /> Supported
                    </div>
                  </TableCell>
                </TableRow>
                <TableRow className="border-b">
                  <TableCell className="font-mono text-xs font-bold text-slate-500">CLM-04</TableCell>
                  <TableCell className="text-xs font-medium text-slate-700">Wearables & Home contracted 7.2% to $37.0B</TableCell>
                  <TableCell className="text-[10px] font-mono text-slate-500">Item 7, p. 44 [Chunk #204]</TableCell>
                  <TableCell className="text-xs font-mono">-7.2% ($37.0B)</TableCell>
                  <TableCell className="text-xs font-mono">-7.18% ($37,005M)</TableCell>
                  <TableCell className="text-xs font-bold text-emerald-500">0.02% <span className="font-normal text-[10px] text-slate-400 ml-1">(Rounding)</span></TableCell>
                  <TableCell className="text-xs font-mono text-slate-500">0.938 Entail</TableCell>
                  <TableCell className="text-right">
                    <div className="inline-flex items-center text-[10px] font-bold uppercase tracking-widest text-emerald-600 bg-emerald-50 px-2 py-1 rounded">
                      <CheckCircle2 className="h-3 w-3 mr-1" /> Supported
                    </div>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </Card>
        </div>

        {/* Section 03 */}
        <div>
          <div className="flex justify-between items-end mb-3 mt-8">
            <h3 className="text-sm font-bold text-rose-900"><span className="text-rose-400 mr-2">SECTION 03 /</span> Materiality & Financial Impact Analysis (Claim #2)</h3>
            <span className="text-[10px] font-bold font-mono text-rose-600 bg-rose-100 px-2 py-0.5 rounded">VARIANCE: -$1.58B EXPOSURE</span>
          </div>
          
          <div className="grid grid-cols-3 gap-6 bg-rose-50/50 border border-rose-100 rounded-lg p-6 shadow-sm">
            <div className="col-span-2 space-y-4">
              <div className="flex items-center text-rose-700 font-bold text-lg">
                <AlertTriangle className="h-5 w-5 mr-2" /> Factual Discrepancy Memorandum
              </div>
              <p className="text-sm text-slate-700 leading-relaxed">
                During evaluation of <span className="font-mono font-bold bg-white px-1 border rounded text-xs">CLM-02</span>, the model asserted that Services revenue increased <span className="font-bold text-rose-600">12.0% YoY</span>. 
                Audit against SEC Form 10-K Item 7 (p. 43) reveals statutory Services revenue rose from <span className="font-bold">$85,200M (FY24)</span> to <span className="font-bold">$96,993M (FY25)</span>, 
                establishing an authentic growth rate of exactly <span className="font-bold text-emerald-600">13.84%</span>, rounded by Apple Investor Relations to <span className="font-bold text-emerald-600">13.8%</span>.
              </p>
              
              <div className="bg-white border border-rose-100 rounded p-4 text-xs font-mono space-y-2 text-slate-600">
                <div className="text-[9px] font-bold uppercase text-slate-400 mb-2">Materiality Differential Calculation</div>
                <div className="flex justify-between">
                  <span>Model Output ($85,200M * 1.120):</span>
                  <span className="text-rose-600 font-bold">$95,424M</span>
                </div>
                <div className="flex justify-between">
                  <span>Statutory SEC Record:</span>
                  <span className="text-emerald-600 font-bold">$96,993M</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-slate-100 mt-2 text-slate-900 font-bold">
                  <span>Net Unrepresented Expansion:</span>
                  <span>-$1,569M to -$1,580M (-184 bps)</span>
                </div>
              </div>
              
              <div className="flex items-start p-3 bg-white border border-slate-200 rounded text-xs text-slate-600">
                <ShieldCheck className="h-4 w-4 text-slate-400 mr-2 shrink-0 mt-0.5" />
                <span>Regulatory Rating: Non-fraudulent hallucination. Exceeds standard 50 bps materiality ceiling for automated quantitative research outputs. Requires inline human-in-the-loop caveat stamp.</span>
              </div>
            </div>
            
            <div className="col-span-1 bg-white border border-rose-100 rounded p-4 flex flex-col">
              <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-6">
                <span>Growth Rate Delta</span>
                <span>-184 bps</span>
              </div>
              <div className="flex-1 flex items-end justify-center space-x-8 pb-8 relative">
                {/* Y-axis labels */}
                <div className="absolute left-0 top-0 bottom-8 flex flex-col justify-between text-[8px] text-slate-400 font-mono">
                  <span>15%</span>
                  <span>10%</span>
                  <span>5%</span>
                  <span>0%</span>
                </div>
                {/* Grid lines */}
                <div className="absolute left-6 right-0 top-0 bottom-8 flex flex-col justify-between z-0">
                  <div className="w-full h-px bg-slate-50"></div>
                  <div className="w-full h-px bg-slate-50"></div>
                  <div className="w-full h-px bg-slate-50"></div>
                  <div className="w-full h-px border-b border-slate-200"></div>
                </div>
                
                {/* Bars */}
                <div className="flex flex-col items-center z-10 w-16">
                  <span className="text-xs font-bold text-emerald-600 mb-2">13.8%</span>
                  <div className="w-full bg-emerald-600 rounded-t" style={{ height: '138px' }}></div>
                  <span className="text-[10px] font-bold text-slate-500 mt-2">SEC 10-K</span>
                </div>
                <div className="flex flex-col items-center z-10 w-16">
                  <span className="text-xs font-bold text-rose-600 mb-2">12.0%</span>
                  <div className="w-full bg-rose-600 rounded-t" style={{ height: '120px' }}></div>
                  <span className="text-[10px] font-bold text-slate-500 mt-2">LLM State</span>
                </div>
              </div>
              <div className="text-[9px] font-mono text-center text-slate-400 mt-auto border-t pt-2">
                Discrepancy Category: <span className="font-bold text-slate-600">Parametric Drift</span>
              </div>
            </div>
          </div>
        </div>

        {/* Section 04 */}
        <div>
          <div className="flex justify-between items-end mb-3 mt-8">
            <h3 className="text-sm font-bold text-slate-800"><span className="text-slate-400 mr-2">SECTION 04 /</span> Attention Heatmap & Shannon Entropy Analysis</h3>
            <span className="text-[9px] font-bold font-mono text-slate-400 uppercase tracking-widest">LAYER 12 HEAD 10 INSPECTOR</span>
          </div>
          <Card className="shadow-sm bg-white border-slate-200">
            <CardContent className="p-6">
              <p className="text-xs text-slate-500 mb-4">Diagnostic attribution of token-level softmax cross-attention between context vectors and generated sequence tokens:</p>
              
              <div className="flex flex-wrap gap-2 mb-6">
                <div className="px-3 py-2 border rounded bg-slate-50 text-center">
                  <div className="text-xs font-mono font-bold text-slate-700">"Services"</div>
                  <div className="text-[9px] text-slate-400 font-mono mt-1">Attn: 0.910</div>
                </div>
                <div className="px-3 py-2 border rounded bg-slate-50 text-center">
                  <div className="text-xs font-mono font-bold text-slate-700">"division"</div>
                  <div className="text-[9px] text-slate-400 font-mono mt-1">Attn: 0.432</div>
                </div>
                <div className="px-3 py-2 border rounded bg-slate-50 text-center">
                  <div className="text-xs font-mono font-bold text-slate-700">"surged"</div>
                  <div className="text-[9px] text-slate-400 font-mono mt-1">Attn: 0.188</div>
                </div>
                <div className="px-3 py-2 border border-rose-200 rounded bg-rose-50 text-center shadow-[0_0_10px_rgba(244,63,94,0.2)]">
                  <div className="text-xs font-mono font-bold text-rose-700">"12.0%"</div>
                  <div className="text-[9px] text-rose-500 font-mono font-bold mt-1">Entropy: 0.170</div>
                </div>
                <div className="px-3 py-2 border rounded bg-slate-50 text-center">
                  <div className="text-xs font-mono font-bold text-slate-700">"year-over-year"</div>
                  <div className="text-[9px] text-slate-400 font-mono mt-1">Attn: 0.812</div>
                </div>
                <div className="px-3 py-2 border rounded bg-slate-50 text-center">
                  <div className="text-xs font-mono font-bold text-slate-700">"to $86.2 billion"</div>
                  <div className="text-[9px] text-slate-400 font-mono mt-1">Attn: 0.945</div>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-indigo-50 border border-indigo-100 p-3 rounded flex items-start space-x-3 text-indigo-900 text-xs">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-indigo-500" />
                  <div>
                    <span className="font-bold">Root Cause Diagnosis:</span> Attention weight on source chunk #198 was optimal (&gt;0.80), but low Shannon Entropy (0.170) on token "12.0%" confirms a model-prioritized pre-training parametric prior over contextual retrieval tokens.
                  </div>
                </div>
                <div className="bg-emerald-50 border border-emerald-100 p-3 rounded flex items-start space-x-3 text-emerald-900 text-xs">
                  <ShieldCheck className="h-4 w-4 shrink-0 mt-0.5 text-emerald-500" />
                  <div>
                    <span className="font-bold">Mitigation Parameter Suggestion:</span> Increase context-injection temperature penalty or enforce constrained grammar sampling for numeric percentages in retrieval pipelines.
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Section 05 */}
        <div>
          <div className="flex justify-between items-end mb-3 mt-8">
            <h3 className="text-sm font-bold text-slate-800"><span className="text-slate-400 mr-2">SECTION 05 /</span> Compliance Attestation & Cryptographic Signatures</h3>
            <div className="flex items-center text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
              <CheckCircle2 className="h-3 w-3 mr-1" /> ISO 28022 READY
            </div>
          </div>
          
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2 space-y-4">
              <div className="bg-white border border-slate-200 p-4 rounded shadow-sm">
                <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-2">Merkle Tree Root & Audit Seal</div>
                <div className="font-mono text-xs text-slate-700 bg-slate-50 p-2 border rounded break-all">
                  0x8f3c49e210e459b7df681e1a0077cd390327d8e20f1803507c11a84f5c1b8299
                </div>
              </div>
              <div className="flex gap-4">
                <div className="flex-1 bg-white border border-slate-200 p-4 rounded shadow-sm">
                  <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">EDGAR Insertion Hash:</div>
                  <div className="font-mono text-[10px] text-slate-700">SHA-256 (32-byte exact)</div>
                </div>
                <div className="flex-1 bg-white border border-slate-200 p-4 rounded shadow-sm">
                  <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">TSA RFC 3161 Timestamp:</div>
                  <div className="font-mono text-[10px] text-slate-700">2026-10-18T14:32:09.432Z</div>
                </div>
              </div>
            </div>
            
            <div className="col-span-1 bg-white border border-slate-200 p-4 rounded shadow-sm flex flex-col relative">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <div className="font-bold text-sm text-slate-900">Morgan S.</div>
                  <div className="text-[10px] text-slate-500 font-mono">Senior Quantitative Auditor</div>
                </div>
                <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                </div>
              </div>
              
              <div className="flex-1 flex items-center justify-center py-4 border-b border-dashed border-slate-200">
                 {/* Mock Signature */}
                 <div className="w-full max-w-[150px] opacity-60">
                   <svg viewBox="0 0 200 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                     <path d="M10 25C25 10 35 30 50 20C65 10 75 30 90 20C105 10 115 30 130 20C145 10 155 30 170 20C185 10 190 25 195 25" stroke="#334155" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                   </svg>
                 </div>
              </div>
              
              <div className="flex justify-between items-center mt-3">
                <span className="text-[10px] font-mono text-slate-400">SR-QRA #8421</span>
                <span className="text-[9px] font-bold text-emerald-600 uppercase tracking-widest">Signed & Ratified</span>
              </div>
            </div>
          </div>
        </div>

      </div>
      
      {/* Footer Print Info */}
      <div className="max-w-[1200px] mx-auto w-full px-8 flex justify-between text-[9px] font-mono text-slate-400 mt-8 pt-4 border-t border-slate-200">
        <span>VERIFIN Audit System v3.4</span>
        <span>Certificate ID: #VRF-2025-0984</span>
        <span>Distribution: Internal Risk & Compliance Committee</span>
        <span>Page 1 of 1 (Statutory Abstract)</span>
      </div>

    </div>
  )
}
