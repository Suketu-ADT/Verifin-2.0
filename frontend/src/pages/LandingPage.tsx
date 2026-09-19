import { motion } from "framer-motion"
import { useNavigate } from "react-router-dom"
import { Button } from "../components/ui/button"
import { Badge } from "../components/ui/badge"
import {
  Shield, ArrowRight, Database, FileText, Search, Cpu,
  Calculator, ShieldCheck, CheckCircle2, ExternalLink,
} from "lucide-react"

export default function LandingPage() {
  const navigate = useNavigate()

  return (
    <div className="app-shell-bg min-h-screen font-sans text-white selection:bg-amber-500/30">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: "easeOut" }}>
      
      {/* ─── Nav ─── */}
      <nav className="sticky top-0 z-50 bg-black/20 border-b border-white/10 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Shield className="h-5 w-5 text-white" />
            <span className="text-lg font-black tracking-tight">VERIFIN</span>
          </div>
          <div className="hidden md:flex items-center space-x-6 text-sm font-medium text-slate-300">
            <a href="#how-it-works" className="hover:text-white transition-colors">How it works</a>
            <a href="#about" className="hover:text-white transition-colors">About</a>
          </div>
          <div className="flex items-center space-x-4">
            <a href="/login" onClick={(e) => { e.preventDefault(); navigate("/login"); }} className="text-sm font-medium text-slate-300 hover:text-white transition-colors">
              Sign In
            </a>
            <Button
              className="text-sm font-semibold h-9 px-4"
              onClick={() => navigate("/signup")}
            >
              Get Started <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      </nav>

      {/* ─── Hero ─── */}
      <section className="relative pt-24 pb-32 overflow-hidden border-b border-white/10">
        {/* Subtle grid background */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />
        
        <div className="relative max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          {/* Left Column */}
          <motion.div variants={{ hidden: {}, show: { transition: { staggerChildren: 0.1 } } }} initial="hidden" animate="show" className="max-w-xl">
            <motion.h1 variants={{ hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } }} className="text-5xl md:text-6xl font-black tracking-tight leading-[1.1] mb-6 text-white mt-12">
              Don't trust an LLM's<br />financial claim. <span className="text-amber-400">Verify it.</span>
            </motion.h1>
            
            <motion.p variants={{ hidden: { opacity: 0, y: 15 }, show: { opacity: 1, y: 0 } }} className="text-base text-slate-300 leading-relaxed mb-8">
              VERIFIN decomposes LLM-generated financial answers into individual claims, retrieves supporting evidence from the source filing, and uses Natural Language Inference — not a second LLM's opinion — to show exactly why each claim is supported, contradicted, or unverifiable.
            </motion.p>
            
            <motion.div variants={{ hidden: { opacity: 0, y: 15 }, show: { opacity: 1, y: 0 } }} className="flex flex-wrap items-center gap-4 mb-8">
              <Button
                className="h-11 px-6 text-sm font-bold"
                onClick={() => navigate("/verify")}
              >
                Start a Verification <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </motion.div>
            
            <motion.div variants={{ hidden: { opacity: 0, opacity: 0 }, show: { opacity: 1 } }} className="flex items-center text-xs text-slate-500 font-medium">
              <Database className="h-3.5 w-3.5 mr-2 text-slate-400" />
              Ships with a demo dataset based on an Apple FY2025 annual report excerpt for testing.
            </motion.div>
          </motion.div>

          {/* Right Column (UI Mockup) */}
          <div className="relative">
            <div className="absolute inset-0 bg-amber-500/20 blur-2xl rounded-2xl transform translate-x-4 translate-y-4 -z-10" />
            <div className="glass border border-white/10 rounded-xl shadow-2xl overflow-hidden flex flex-col">
              {/* Mockup Header */}
              <div className="glass-subtle border-b border-white/10 px-4 py-3 flex justify-between items-center text-[10px] font-mono text-slate-400">
                <span className="font-bold text-white">demo_verification.json</span>
                <span>Apple_Annual_Report_2025.pdf</span>
              </div>
              
              {/* Mockup Body */}
              <motion.div variants={{ hidden: {}, show: { transition: { staggerChildren: 0.1 } } }} initial="hidden" animate="show" className="p-6 space-y-6">
                {/* Claim Box */}
                <div className="glass-subtle border border-white/10 rounded-lg p-4">
                  <div className="text-[9px] font-bold text-amber-400 uppercase tracking-widest mb-2">LLM-Generated Claim Under Review</div>
                  <div className="text-sm font-serif italic text-white">"iPhone revenue increased significantly due to strong demand."</div>
                </div>

                {/* Contradicted Example */}
                <motion.div variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } }} className="border border-rose-400/30 bg-rose-500/10 rounded-lg p-4">
                  <div className="flex justify-between items-center mb-2">
                    <div className="text-xs font-bold text-rose-400">Contradicted</div>
                    <div className="text-[10px] font-mono text-rose-400 font-bold">entailment 0.15</div>
                  </div>
                  <p className="text-xs text-slate-300 mb-3 leading-relaxed">
                    Source (p. 45): "iPhone demand remained strong... Operating margin improved slightly compared to the prior fiscal year." — no revenue figure is stated.
                  </p>
                  <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden flex">
                    <div className="h-full bg-rose-500 w-[75%]" />
                    <div className="h-full bg-emerald-500 w-[15%]" />
                    <div className="h-full bg-amber-400 w-[10%]" />
                  </div>
                </motion.div>

                {/* Supported Example */}
                <motion.div variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } }} className="border border-emerald-400/30 bg-emerald-500/10 rounded-lg p-4">
                  <div className="flex justify-between items-center mb-2">
                    <div className="text-xs font-bold text-emerald-400">Supported</div>
                    <div className="text-[10px] font-mono text-emerald-400 font-bold">entailment 0.96</div>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    "Revenue increased by 12% in fiscal year 2025, driven by strong demand." — p. 43
                  </p>
                </motion.div>
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── How It Works ─── */}
      <section id="how-it-works" className="py-24 glass-strong border-b border-white/10">
        <div className="max-w-7xl mx-auto px-6">
          <div className="mb-12">
            <div className="text-[10px] font-bold text-amber-400 uppercase tracking-widest mb-3">Pipeline</div>
            <h2 className="text-3xl font-bold tracking-tight text-white mb-4">How VERIFIN Works</h2>
            <p className="text-slate-300 text-sm max-w-2xl">
              Five stages, each one auditable on its own — nothing is a black box.
            </p>
          </div>

          <motion.div 
            initial="hidden" 
            whileInView="show" 
            viewport={{ once: true, margin: "-100px" }}
            variants={{ hidden: {}, show: { transition: { staggerChildren: 0.1 } } }}
            className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4"
          >
            {[
              {
                icon: FileText,
                step: "01",
                title: "Claim Decomposition",
                desc: "The LLM-generated answer is split into atomic, independently checkable factual statements rather than judged as one block.",
              },
              {
                icon: Search,
                step: "02",
                title: "Hybrid Evidence Retrieval",
                desc: "Each claim is matched against the source document with a combination of keyword (BM25) and dense semantic search, keeping page and section provenance.",
              },
              {
                icon: Cpu,
                step: "03",
                title: "NLI Verification",
                desc: "A DeBERTa-v3 cross-encoder classifies claim vs. evidence as Supported, Contradicted, or Unverifiable — the sole decision signal, no self-reported LLM confidence.",
              },
              {
                icon: Calculator,
                step: "04",
                title: "Numerical & Temporal Checks",
                desc: "Figures, percentages, and fiscal periods stated in the claim are compared directly against the source document's values.",
              },
              {
                icon: ShieldCheck,
                step: "05",
                title: "Interpretable Output",
                desc: "Every verdict ships with its evidence passage, page number, and NLI scores — never a bare risk percentage with no explanation.",
              },
            ].map((item) => (
              <motion.div key={item.step} variants={{ hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } }} className="glass border border-white/10 rounded-xl p-5 hover:bg-white/[0.04] transition-colors flex flex-col">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-8 h-8 rounded-md glass-strong text-white flex items-center justify-center">
                    <item.icon className="h-4 w-4 text-white" />
                  </div>
                  <span className="text-[10px] font-mono font-bold text-slate-400">{item.step}</span>
                </div>
                <h3 className="text-sm font-bold text-white mb-2">{item.title}</h3>
                <p className="text-xs text-slate-400 leading-relaxed flex-1">{item.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ─── About This Project ─── */}
      <section id="about" className="py-24 border-b border-white/10">
        <motion.div 
          initial="hidden" 
          whileInView="show" 
          viewport={{ once: true, margin: "-100px" }}
          variants={{ hidden: {}, show: { transition: { staggerChildren: 0.15 } } }}
          className="max-w-7xl mx-auto px-6"
        >
          <motion.div variants={{ hidden: { opacity: 0, y: 15 }, show: { opacity: 1, y: 0 } }} className="mb-12">
            <div className="text-[10px] font-bold text-amber-400 uppercase tracking-widest mb-3">Background</div>
            <h2 className="text-3xl font-bold tracking-tight text-white mb-4">About This Project</h2>
            <p className="text-slate-300 text-sm max-w-2xl leading-relaxed">
              VERIFIN is a research-oriented tool for detecting hallucinations in LLM-generated financial summaries, using Natural Language Inference and retrieval-based verification against source documents.
            </p>
          </motion.div>
          
          <motion.div variants={{ hidden: { opacity: 0, scale: 0.98 }, show: { opacity: 1, scale: 1 } }} className="glass border border-white/10 rounded-xl p-6 md:p-8">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">Team & Credits</div>
            <div className="flex flex-wrap gap-2 mb-8">
              <Badge variant="outline" className="text-slate-300 border-white/20 py-1.5 px-3">Vedant Chaudhari</Badge>
              <Badge variant="outline" className="text-slate-300 border-white/20 py-1.5 px-3">Rakshit Girase</Badge>
              <Badge variant="outline" className="text-slate-300 border-white/20 py-1.5 px-3">Suketu Mishra</Badge>
              <Badge variant="outline" className="text-slate-300 border-white/20 py-1.5 px-3">Rachayita Sharma</Badge>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-6 sm:gap-12 text-xs text-slate-400">
              <div>
                <span className="font-semibold text-slate-300 block mb-1">Faculty Guide</span>
                Dr. Sheetal Aher
              </div>
              <div>
                <span className="font-semibold text-slate-300 block mb-1">Institution</span>
                MIT ADT University — Class LYAIA08, Group ID BCAIAA89
              </div>
            </div>
          </motion.div>
        </motion.div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="py-8 bg-black/40 border-t border-white/10 text-slate-400">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center text-[10px] space-y-4 md:space-y-0">
          <div className="flex items-center space-x-3">
            <Shield className="h-4 w-4 text-white" />
            <span className="font-bold text-white">VERIFIN</span>
            <span className="text-slate-500">— MIT School of Computing, Class LYAIA0B</span>
          </div>
          <a href="https://github.com/Suketu-ADT/Verifin-2.0" target="_blank" rel="noreferrer" className="flex items-center hover:text-white transition-colors">
            <ExternalLink className="h-3 w-3 mr-1.5" /> Source on GitHub
          </a>
        </div>
      </footer>
      </motion.div>
    </div>
  )
}
