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
import { demoSessions } from "../lib/demoData"
import { uploadDocument, startVerification, extractFactsFromDocument, formatBytes, type DocumentResponse } from "../lib/api"

const stages = [
  { icon: FileText, label: "Claim Decomposition" },
  { icon: Search, label: "Evidence Retrieval" },
  { icon: Cpu, label: "NLI Verification" },
  { icon: Scale, label: "Consistency Checks" },
]

export default function VerificationFlow() {
  const navigate = useNavigate()
  const [fileName, setFileName] = useState<string | null>(null)
  const [answer, setAnswer] = useState("")
  const [selectedSample, setSelectedSample] = useState<string | null>(null)
  
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

  const handleFileSelect = async (file: File | undefined) => {
    if (!file) return
    setSelectedSample(null)
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
      // Automatically extract key facts using LLM right after upload
      handleExtractFacts(doc.id)
    } catch (err: any) {
      setIsUploading(false)
      const detail = err?.response?.data?.detail || err?.message || "Failed to upload document."
      setUploadError(typeof detail === "string" ? detail : JSON.stringify(detail))
      setUploadedDoc(null)
    }
  }

  const loadSample = (sessionId: string) => {
    const session = demoSessions.find((s) => s.id === sessionId)
    if (!session) return
    setUploadedDoc(null)
    setUploadError(null)
    setSubmitError(null)
    setFileName(session.document)
    setAnswer(session.llm_output)
    setSelectedSample(sessionId)
  }

  const handleRemove = () => {
    setFileName(null)
    setUploadedDoc(null)
    setSelectedSample(null)
    setUploadError(null)
    setSubmitError(null)
    setUploadProgress(0)
  }

  const handleSubmit = async () => {
    setSubmitError(null)
    
    // Demo mode: route directly to canned demo results
    if (selectedSample) {
      navigate(`/verify/results/${selectedSample}`)
      return
    }

    if (!uploadedDoc) {
      setSubmitError("Please upload a document or choose a sample.")
      return
    }

    setIsSubmitting(true)
    try {
      const session = await startVerification(uploadedDoc.id, answer)
      setIsSubmitting(false)
      navigate(`/verify/results/${session.id}`)
    } catch (err: any) {
      setIsSubmitting(false)
      const detail = err?.response?.data?.detail || err?.message || "Failed to start verification session."
      setSubmitError(typeof detail === "string" ? detail : JSON.stringify(detail))
    }
  }

  const canSubmit = (Boolean(uploadedDoc) || Boolean(selectedSample)) && answer.trim().length > 0 && !isUploading && !isSubmitting

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
        <Card className="border-white/10 h-full">
          <div className="p-5 border-b border-white/10 flex items-center gap-3 bg-white/[0.02] rounded-t-2xl">
            <FileUp className="h-5 w-5 text-slate-700" />
            <h2 className="text-base font-bold text-white">Step 1 · Source Document</h2>
          </div>
          <CardContent className="p-6 space-y-4">
            {isUploading ? (
              <div className="border border-white/10 rounded-xl glass-subtle p-8 flex flex-col items-center justify-center text-center space-y-3">
                <Loader2 className="h-6 w-6 text-amber-400 animate-spin" />
                <div className="text-sm font-semibold text-white">Uploading & verifying {fileName}...</div>
                <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden max-w-xs">
                  <div className="bg-amber-400 h-full transition-all duration-200" style={{ width: `${uploadProgress}%` }} />
                </div>
                <div className="text-xs text-slate-400">{uploadProgress}% complete</div>
              </div>
            ) : uploadError ? (
              <div className="border border-rose-500/30 rounded-xl bg-rose-500/5 p-5 space-y-3">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-rose-400 shrink-0 mt-0.5" />
                  <div>
                    <div className="text-sm font-semibold text-rose-300">Upload Failed</div>
                    <div className="text-xs text-rose-300/80 mt-1">{uploadError}</div>
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={handleRemove} className="text-xs">
                  Try Again
                </Button>
              </div>
            ) : !fileName ? (
              <label className="border-2 border-dashed border-white/15 rounded-xl glass-subtle p-8 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-white/[0.05] transition-colors">
                <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center mb-3">
                  <ShieldCheck className="h-5 w-5 text-slate-400" />
                </div>
                <p className="text-sm font-semibold text-slate-300 mb-1">Drop a financial document, or browse files</p>
                <p className="text-[11px] text-slate-400">PDF · 10-K, 10-Q, earnings transcripts (max 25 MB)</p>
                <input
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  onChange={(e) => handleFileSelect(e.target.files?.[0])}
                />
              </label>
            ) : (
              <div className="flex items-center justify-between glass-subtle border border-white/10 rounded-lg p-3.5">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded glass-strong text-white flex items-center justify-center shrink-0">
                    <FileText className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-white truncate">{fileName}</div>
                    {uploadedDoc ? (
                      <div className="text-[11px] text-emerald-400 flex items-center gap-1.5 flex-wrap">
                        <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Ready ({uploadedDoc.status})</span>
                        <span className="text-slate-500">·</span>
                        <span className="text-slate-400">{formatBytes(uploadedDoc.size)}</span>
                        <span className="text-slate-500">·</span>
                        <span className="text-slate-400">{uploadedDoc.page_count} page{uploadedDoc.page_count !== 1 ? 's' : ''}</span>
                        <span className="font-mono text-[9px] bg-white/5 text-slate-300 px-1.5 py-0.5 rounded">ID: {uploadedDoc.id.slice(0, 8)}...</span>
                      </div>
                    ) : (
                      <div className="text-[11px] text-amber-400 flex items-center gap-1">
                        <Sparkles className="h-3 w-3" /> Sample Dataset
                      </div>
                    )}
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={handleRemove}>Remove</Button>
              </div>
            )}

            <div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Or try a sample</div>
              <motion.div variants={{ hidden: {}, show: { transition: { staggerChildren: 0.05 } } }} initial="hidden" animate="show" className="flex flex-col gap-2">
                {demoSessions.map((s) => (
                  <motion.button
                    variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } }}
                    key={s.id}
                    onClick={() => loadSample(s.id)}
                    className={`text-left text-xs font-medium px-3 py-2 rounded border transition-colors ${
                      selectedSample === s.id
                        ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
                        : "border-white/10 text-slate-400 hover:bg-white/[0.04]"
                    }`}
                  >
                    <Sparkles className="h-3 w-3 inline mr-1.5 -mt-0.5" /> {s.title}
                  </motion.button>
                ))}
              </motion.div>
            </div>
          </CardContent>
        </Card>
        </motion.div>

        {/* Right: LLM answer */}
        <motion.div variants={{ hidden: { opacity: 0, x: 20 }, show: { opacity: 1, x: 0 } }}>
        <Card className="border-white/10 h-full">
          <div className="p-5 border-b border-white/10 flex items-center justify-between bg-white/[0.02] rounded-t-2xl">
            <div className="flex items-center gap-3">
              <Sparkles className="h-5 w-5 text-amber-400" />
              <div>
                <h2 className="text-base font-bold text-white">Step 2 · LLM Facts & Statements</h2>
                <div className="text-[11px] text-slate-400">Extract propositions to test for hallucinations</div>
              </div>
            </div>
            {uploadedDoc && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExtractFacts()}
                disabled={isExtracting || isUploading}
                className="text-xs border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 shrink-0"
              >
                {isExtracting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Extracting...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-3.5 w-3.5 mr-1.5 text-amber-400" /> {answer ? "Re-Extract with LLM" : "Extract Facts with LLM"}
                  </>
                )}
              </Button>
            )}
          </div>
          <CardContent className="p-6 space-y-4">
            {isExtracting && (
              <div className="border border-amber-500/30 rounded-xl bg-amber-500/10 p-4 flex items-center gap-3 text-xs text-amber-300 animate-pulse">
                <Loader2 className="h-5 w-5 animate-spin text-amber-400 shrink-0" />
                <div>
                  <div className="font-semibold text-amber-200">LLM is reading document and extracting facts...</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">Synthesizing revenue, income, margins, and key financial propositions</div>
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
              <div className="flex items-center justify-between text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3.5 py-2">
                <span className="flex items-center gap-1.5 font-medium">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> Extracted {extractedCount} statements from document
                </span>
                <span className="text-[10px] text-slate-400">Review or customize statements below</span>
              </div>
            )}

            <Textarea
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="Your LLM will generate financial statements here, or you can paste claims directly..."
              className="min-h-[170px] text-sm font-sans leading-relaxed bg-transparent border-white/10 focus-visible:ring-amber-500"
            />
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span>{answer.length} characters</span>
              {uploadedDoc && !answer && !isExtracting && (
                <span className="text-amber-400 cursor-pointer hover:underline" onClick={() => handleExtractFacts()}>
                  ✨ Click here to auto-generate facts from document
                </span>
              )}
            </div>

            <div className="glass-subtle border border-white/10 rounded-lg p-4">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Verification Pipeline Stages</div>
              <div className="grid grid-cols-2 gap-3">
                {stages.map((s) => (
                  <div key={s.label} className="flex items-center gap-2 text-xs font-medium text-slate-300">
                    <s.icon className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                    {s.label}
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
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
