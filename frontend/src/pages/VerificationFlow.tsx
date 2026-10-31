import { motion } from "framer-motion"
import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { Button } from "../components/ui/button"
import { Card, CardContent } from "../components/ui/card"
import { Badge } from "../components/ui/badge"
import { Textarea } from "../components/ui/textarea"
import {
  FileUp, ShieldCheck, FileText, CheckCircle2, ArrowRight,
  FileSearch, Search, Cpu, Scale, Sparkles, Loader2, AlertCircle,
} from "lucide-react"
import { uploadDocument, startVerification, extractFactsFromDocument, formatBytes, type DocumentResponse } from "../lib/api"

const SAMPLE_STATEMENT =
  "Revenue grew 22.5% year over year to USD 486.75 million in FY2025. Operating income for FY2025 was USD 74.25 million. " +
  "Interest expense for FY2025 amounted to USD 9,450 million. Total assets reached USD 470.0 million at 31 March 2025. " +
  "Cash and cash equivalents increased by USD 11.5 million during FY2025. " +
  "Net profit decreased from USD 51.0 million in FY2024 to USD 46.35 million in FY2025. " +
  "Northstar completed the acquisition of Helios Data Systems in FY2025."

const stages = [
  { icon: FileText, label: "Claim Decomposition" },
  { icon: Search, label: "BM25 Hybrid Retrieval" },
  { icon: Cpu, label: "DeBERTa-v3 NLI Verification" },
  { icon: Scale, label: "Consistency & Multi-Hop Checks" },
]

export default function VerificationFlow() {
  const navigate = useNavigate()
  const [fileName, setFileName] = useState<string | null>(null)
  const [answer, setAnswer] = useState("")
  const [retrievalMode, setRetrievalMode] = useState<string>("hybrid")
  
  // Real backend upload & verification state
  const [uploadedDoc, setUploadedDoc] = useState<DocumentResponse | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<number>(0)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // LLM Fact extraction state
  const [isExtracting, setIsExtracting] = useState(false)
  const [extractError, setExtractError] = useState<string | null>(null)
  const [extractedCount, setExtractedCount] = useState<number | null>(null)

  const handleExtractFacts = async (docId?: string) => {
    const targetId = docId || uploadedDoc?.id
    if (!targetId) return
    setIsExtracting(true)
    setExtractError(null)
    setSubmitError(null)
    try {
      const res = await extractFactsFromDocument(targetId)
      setAnswer(res.summary_text)
      setExtractedCount(res.total_facts)
      setIsExtracting(false)
    } catch (err: any) {
      setIsExtracting(false)
      const detail = err?.response?.data?.detail || err?.message || "Failed to extract facts with LLM."
      setExtractError(typeof detail === "string" ? detail : JSON.stringify(detail))
    }
  }

  const handleFileSelect = async (file: File | undefined, example?: string) => {
    if (!file) return
    setUploadError(null)
    setSubmitError(null)
    setExtractError(null)
    setExtractedCount(null)

    // Client-side pre-validation
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      setUploadError("Only PDF documents are supported.")
      return
    }
    if (file.size === 0) {
      setUploadError("The selected PDF file is empty (0 bytes).")
      return
    }
    if (file.size > 25 * 1024 * 1024) {
      setUploadError("File exceeds the 25 MB size limit.")
      return
    }

    setFileName(file.name)
    setIsUploading(true)
    setUploadProgress(0)

    try {
      const doc = await uploadDocument(file, (percent) => {
        setUploadProgress(percent)
      })
      setUploadedDoc(doc)
      setIsUploading(false)
      if (example) {
        setAnswer(example)
      } else {
        // Automatically extract key facts using LLM right after upload
        handleExtractFacts(doc.id)
      }
    } catch (err: any) {
      setIsUploading(false)
      const detail = err?.response?.data?.detail || err?.message || "Failed to upload document."
      setUploadError(typeof detail === "string" ? detail : JSON.stringify(detail))
      setUploadedDoc(null)
    }
  }

  // The sample report ships with the app, so it is uploaded and verified like any other document.
  const loadSampleReport = async () => {
    setUploadError(null)
    try {
      const base = ((import.meta as any).env?.BASE_URL as string | undefined) ?? "/"
      const res = await fetch(`${base}samples/northstar-sample-report.pdf`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const file = new File([await res.blob()], "northstar-sample-report.pdf", { type: "application/pdf" })
      await handleFileSelect(file, SAMPLE_STATEMENT)
    } catch {
      setUploadError("Could not load the sample report.")
    }
  }

  const handleRemove = () => {
    setFileName(null)
    setUploadedDoc(null)
    setUploadError(null)
    setSubmitError(null)
    setUploadProgress(0)
  }

  const handleSubmit = async () => {
    setSubmitError(null)
    
    if (!uploadedDoc) {
      setSubmitError("Please upload a document or use the sample report.")
      return
    }

    setIsSubmitting(true)
    try {
      const session = await startVerification(uploadedDoc.id, answer, retrievalMode)
      setIsSubmitting(false)
      navigate(`/verify/results/${session.id}`)
    } catch (err: any) {
      setIsSubmitting(false)
      const detail = err?.response?.data?.detail || err?.message || "Failed to start verification session."
      setSubmitError(typeof detail === "string" ? detail : JSON.stringify(detail))
    }
  }

  const canSubmit = Boolean(uploadedDoc) && answer.trim().length > 0 && !isUploading && !isSubmitting

  return (
    <motion.div initial="hidden" animate="show" variants={{ hidden: {}, show: { transition: { staggerChildren: 0.1 } } }} className="max-w-5xl mx-auto space-y-6">
      <motion.div variants={{ hidden: { opacity: 0, y: 15 }, show: { opacity: 1, y: 0 } }}>
        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">
          <Badge className="bg-white/10 text-slate-300 border-none rounded font-mono text-[9px]">New Verification</Badge>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-white mb-2">Verify a Financial Claim</h1>
        <p className="text-sm text-slate-500 max-w-2xl">
          Upload the source financial document, paste the LLM-generated answer you want checked, and VERIFIN
          will decompose it into claims and verify each one against the document.
        </p>
      </motion.div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Left: document */}
        <motion.div variants={{ hidden: { opacity: 0, x: -20 }, show: { opacity: 1, x: 0 } }}>
        <div className="glass-card rounded-2xl border border-white/10 h-full flex flex-col justify-between overflow-hidden">
          <div className="p-5 border-b border-white/8 flex items-center gap-3 bg-black/20">
            <div className="h-8 w-8 rounded-lg bg-amber-500/15 border border-amber-400/30 flex items-center justify-center text-amber-300">
              <FileUp className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">Step 1 · Source Filing Document</h2>
              <div className="text-[11px] text-slate-400">Target PDF for fact verification & NLI premise</div>
            </div>
          </div>
          <div className="p-6 space-y-4 flex-1">
            {isUploading ? (
              <div className="border border-white/10 rounded-2xl glass-subtle p-8 flex flex-col items-center justify-center text-center space-y-3">
                <Loader2 className="h-8 w-8 text-amber-400 animate-spin" />
                <div className="text-sm font-bold text-white">Uploading & Indexing {fileName}...</div>
                <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden max-w-xs border border-white/5">
                  <div className="bg-gradient-to-r from-amber-400 to-amber-500 h-full transition-all duration-200" style={{ width: `${uploadProgress}%` }} />
                </div>
                <div className="text-xs font-mono text-slate-400">{uploadProgress}% complete</div>
              </div>
            ) : uploadError ? (
              <div className="border border-rose-500/30 rounded-2xl bg-rose-500/10 p-5 space-y-3">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-rose-400 shrink-0 mt-0.5" />
                  <div>
                    <div className="text-sm font-bold text-rose-300">Upload Failed</div>
                    <div className="text-xs text-rose-300/80 mt-1">{uploadError}</div>
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={handleRemove} className="text-xs border-rose-400/30 text-rose-300 hover:bg-rose-500/20">
                  Try Again
                </Button>
              </div>
            ) : !fileName ? (
              <label className="border-2 border-dashed border-white/15 rounded-2xl glass-subtle p-8 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-white/[0.04] hover:border-amber-400/40 transition-all group">
                <div className="w-12 h-12 rounded-2xl bg-white/5 group-hover:bg-amber-500/10 border border-white/10 group-hover:border-amber-400/30 flex items-center justify-center mb-3 transition-all">
                  <ShieldCheck className="h-6 w-6 text-slate-400 group-hover:text-amber-300 transition-colors" />
                </div>
                <p className="text-sm font-bold text-white mb-1">Upload SEC Filing PDF or Transcript</p>
                <p className="text-xs text-slate-400 max-w-xs">Drag and drop or browse files (10-K, 10-Q, 8-K, up to 25 MB)</p>
                <span className="mt-3 text-[11px] font-mono text-amber-400 bg-amber-400/10 px-2.5 py-1 rounded-full border border-amber-400/20">
                  Dual Indexing: Dense + BM25 Sparse
                </span>
                <input
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  onChange={(e) => handleFileSelect(e.target.files?.[0])}
                />
              </label>
            ) : (
              <div className="flex items-center justify-between glass-subtle border border-white/10 rounded-xl p-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-400/20 text-amber-300 flex items-center justify-center shrink-0">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-white truncate">{fileName}</div>
                    {uploadedDoc ? (
                      <div className="text-[11px] text-emerald-400 flex items-center gap-1.5 flex-wrap font-mono mt-0.5">
                        <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Ready</span>
                        <span className="text-slate-500">·</span>
                        <span className="text-slate-300">{formatBytes(uploadedDoc.size)}</span>
                        <span className="text-slate-500">·</span>
                        <span className="text-slate-300">{uploadedDoc.page_count} page{uploadedDoc.page_count !== 1 ? 's' : ''}</span>
                      </div>
                    ) : (
                      <div className="text-[11px] text-amber-300 flex items-center gap-1 mt-0.5 font-mono">
                        <Sparkles className="h-3 w-3" /> Not uploaded
                      </div>
                    )}
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={handleRemove} className="text-xs text-slate-400 hover:text-white hover:bg-white/5">
                  Change
                </Button>
              </div>
            )}

            <div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">No report to hand?</div>
              <button
                onClick={() => void loadSampleReport()}
                disabled={isUploading}
                className="w-full text-left text-xs font-semibold px-3.5 py-2.5 rounded-xl border border-white/8 text-slate-300 hover:bg-white/5 hover:border-white/15 transition-all disabled:opacity-50"
              >
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Sparkles className="h-3 w-3 text-amber-400" /> Try the Northstar sample report
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">7 claims, some wrong</span>
                </div>
              </button>
            </div>
          </div>
        </div>
        </motion.div>

        {/* Right: LLM answer */}
        <motion.div variants={{ hidden: { opacity: 0, x: 20 }, show: { opacity: 1, x: 0 } }}>
        <div className="glass-card rounded-2xl border border-white/10 h-full flex flex-col justify-between overflow-hidden">
          <div className="p-5 border-b border-white/8 flex items-center justify-between bg-black/20">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-indigo-500/15 border border-indigo-400/30 flex items-center justify-center text-indigo-300">
                <Sparkles className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-white uppercase tracking-wider">Step 2 · LLM Claims & Statements</h2>
                <div className="text-[11px] text-slate-400">Financial propositions to verify for hallucinations</div>
              </div>
            </div>
            {uploadedDoc && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExtractFacts()}
                disabled={isExtracting || isUploading}
                className="text-xs border-amber-400/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 shrink-0 font-semibold"
              >
                {isExtracting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Extracting...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-3.5 w-3.5 mr-1.5 text-amber-400" /> {answer ? "Re-Extract" : "Extract with LLM"}
                  </>
                )}
              </Button>
            )}
          </div>
          <div className="p-6 space-y-4 flex-1">
            {isExtracting && (
              <div className="border border-amber-500/30 rounded-xl bg-amber-500/10 p-4 flex items-center gap-3 text-xs text-amber-300 animate-pulse">
                <Loader2 className="h-5 w-5 animate-spin text-amber-400 shrink-0" />
                <div>
                  <div className="font-bold text-amber-200">LLM is parsing document and decomposing facts...</div>
                  <div className="text-[11px] text-slate-300 mt-0.5">Synthesizing revenue, income, margins, and key financial propositions</div>
                </div>
              </div>
            )}

            {extractError && (
              <div className="border border-rose-500/30 rounded-xl bg-rose-500/10 p-3 flex items-center justify-between text-xs text-rose-300">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />
                  <span>{extractError}</span>
                </div>
                <Button variant="ghost" size="sm" onClick={() => handleExtractFacts()} className="text-xs text-rose-300 hover:bg-rose-500/20">
                  Retry
                </Button>
              </div>
            )}

            {extractedCount !== null && !isExtracting && (
              <div className="flex items-center justify-between text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-3.5 py-2.5">
                <span className="flex items-center gap-1.5 font-bold">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" /> Extracted {extractedCount} financial propositions
                </span>
                <span className="text-[10px] text-slate-400 font-mono">Ready to verify</span>
              </div>
            )}

            <Textarea
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="Paste the financial LLM answer here, or click above to auto-extract from document..."
              className="min-h-[160px] text-sm font-sans leading-relaxed bg-black/30 border-white/10 focus-visible:ring-amber-500 rounded-xl"
            />
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span className="font-mono">{answer.length} characters</span>
              {uploadedDoc && !answer && !isExtracting && (
                <button type="button" className="text-amber-400 hover:underline cursor-pointer font-semibold flex items-center gap-1" onClick={() => handleExtractFacts()}>
                  <Sparkles className="h-3 w-3" /> Auto-extract financial claims with LLM
                </button>
              )}
            </div>

            {/* Retrieval Mode Selector */}
            <div className="glass-subtle border border-white/10 rounded-xl p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Retrieval Engine Architecture</span>
                <span className="text-[10px] font-mono font-bold text-indigo-300 uppercase">{retrievalMode} RAG</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: "hybrid", label: "BM25 Hybrid", desc: "Dense + Sparse Fusion", badge: "Recommended" },
                  { id: "dense", label: "Dense Semantic", desc: "MiniLM Embeddings", badge: "Vector" },
                  { id: "bm25", label: "BM25 Sparse", desc: "Exact Term Overlap", badge: "Lexical" },
                ].map((mode) => (
                  <button
                    key={mode.id}
                    type="button"
                    onClick={() => setRetrievalMode(mode.id)}
                    className={`p-2.5 rounded-xl text-left border transition-all ${
                      retrievalMode === mode.id
                        ? "border-indigo-400/50 bg-indigo-500/20 text-white shadow-[0_0_12px_rgba(99,102,241,0.25)]"
                        : "border-white/5 bg-white/[0.02] text-slate-400 hover:border-white/10"
                    }`}
                  >
                    <div className="text-xs font-bold text-white">{mode.label}</div>
                    <div className="text-[10px] text-slate-400 font-mono mt-0.5">{mode.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="glass-subtle border border-white/10 rounded-xl p-3.5">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2.5">Verification Pipeline Flow</div>
              <div className="grid grid-cols-2 gap-2.5">
                {stages.map((s) => (
                  <div key={s.label} className="flex items-center gap-2 text-xs font-semibold text-slate-300">
                    <s.icon className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                    <span>{s.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        </motion.div>
      </div>

      {submitError && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="p-4 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-300 text-xs flex items-start gap-2.5">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-400" />
          <span>{submitError}</span>
        </motion.div>
      )}

      <motion.div variants={{ hidden: { opacity: 0, y: 15 }, show: { opacity: 1, y: 0 } }} className="flex justify-end">
        <Button
          disabled={!canSubmit}
          onClick={handleSubmit}
          className="h-11 px-7 font-semibold"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Verifying Credibility...
            </>
          ) : (
            <>
              Check Credibility & Grounding <ArrowRight className="h-4 w-4 ml-1.5" />
            </>
          )}
        </Button>
      </motion.div>
    </motion.div>
  )
}
