import { motion } from "framer-motion"
import { useParams, Link } from "react-router-dom"
import { useState, useEffect } from "react"
import { Button } from "../components/ui/button"
import { Badge } from "../components/ui/badge"
import {
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  FileText,
  Calculator,
  Calendar,
  ExternalLink,
  Loader2,
  Maximize2,
  Eye,
  EyeOff,
} from "lucide-react"
import { demoSessions } from "../lib/demoData"
import {
  getVerificationResults,
  getDocument,
  getDocumentFileUrl,
  type VerificationResultResponse,
  type ClaimResponse,
  type DocumentResponse,
} from "../lib/api"
import { PdfEvidenceViewer } from "../components/PdfEvidenceViewer"

export default function ClaimDetail() {
  const { id, claimId } = useParams()

  // 1. Check demo sessions first
  const demoSession = demoSessions.find((s) => s.id === id)
  const demoClaim = demoSession?.claims.find((c) => c.id === claimId)

  // 2. Live session state
  const [liveSession, setLiveSession] = useState<VerificationResultResponse | null>(null)
  const [liveClaim, setLiveClaim] = useState<ClaimResponse | null>(null)
  const [docMeta, setDocMeta] = useState<DocumentResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [showPdfViewer, setShowPdfViewer] = useState(false)
  const [pdfLoadError, setPdfLoadError] = useState(false)

  useEffect(() => {
    if (demoSession || !id) return
    setLoading(true)
    setLoadError(null)

    getVerificationResults(id)
      .then((res) => {
        setLiveSession(res)
        const match = res.claims.find((c) => c.id === claimId)
        if (match) {
          setLiveClaim(match)
        } else {
          setLoadError(`Claim "${claimId}" not found in session "${id}".`)
        }
        setLoading(false)

        if (res.document_id) {
          getDocument(res.document_id)
            .then(setDocMeta)
            .catch(() => {})
        }
      })
      .catch((err) => {
        const detail = err?.response?.data?.detail || err?.message || "Failed to load claim details."
        setLoadError(typeof detail === "string" ? detail : JSON.stringify(detail))
        setLoading(false)
      })
  }, [id, claimId, demoSession])

  // Handle loading state
  if (loading) {
    return (
      <div className="max-w-2xl mx-auto text-center py-24 space-y-4">
        <Loader2 className="h-8 w-8 text-amber-400 animate-spin mx-auto" />
        <h1 className="text-lg font-semibold text-white">Loading Claim Verification...</h1>
        <p className="text-xs text-slate-400 font-mono">Fetching evidence and reasoning details</p>
      </div>
    )
  }

  // Active claim & document title
  const activeClaim = demoClaim || liveClaim
  const activeSessionId = demoSession?.id || liveSession?.id || id
  const docTitle = demoSession?.document || docMeta?.filename || (liveSession ? `Document ${liveSession.document_id.slice(0, 8)}` : "Source Document")

  if (!activeClaim) {
    return (
      <div className="max-w-2xl mx-auto text-center py-20 space-y-4">
        <h1 className="text-xl font-bold text-white mb-2">Claim not found</h1>
        <p className="text-xs text-slate-400">
          {loadError || `The claim "${claimId}" does not exist in session "${id}".`}
        </p>
        <Link to={id ? `/verify/results/${id}` : "/verify"}>
          <Button variant="outline" size="sm">Back to Results</Button>
        </Link>
      </div>
    )
  }

  const rawStatus = (activeClaim.nli?.label || activeClaim.status || "").toUpperCase()
  const meta =
    rawStatus === "SUPPORTED" || rawStatus === "ENTAILMENT"
      ? { icon: CheckCircle2, color: "text-emerald-300", border: "border-emerald-400/30", bg: "bg-emerald-500/10", text: "Supported" }
      : rawStatus === "CONTRADICTED" || rawStatus === "CONTRADICTION"
      ? { icon: AlertTriangle, color: "text-rose-300", border: "border-rose-400/30", bg: "bg-rose-500/10", text: "Contradicted" }
      : { icon: HelpCircle, color: "text-amber-300", border: "border-amber-400/30", bg: "bg-amber-500/10", text: "Unverifiable" }

  const pageNumber = activeClaim.evidence?.page_number || 1
  const pdfUrl = liveSession?.document_id ? getDocumentFileUrl(liveSession.document_id) : null

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: "easeOut" }} className="max-w-3xl mx-auto space-y-6">
      <Link to={`/verify/results/${activeSessionId}`} className="inline-flex items-center text-xs font-semibold text-slate-400 hover:text-white">
        <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Back to Verification Overview
      </Link>

      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <meta.icon className={`h-5 w-5 ${meta.color}`} />
          <span className={`text-sm font-bold uppercase tracking-wide ${meta.color}`}>{meta.text}</span>
          {demoSession && (
            <Badge variant="outline" className="text-amber-300 border-amber-400/30 bg-amber-500/10 text-[10px]">
              Demo
            </Badge>
          )}
        </div>
        <h1 className="text-xl font-semibold text-white leading-snug">"{activeClaim.claim_text}"</h1>
        <div className="text-xs text-slate-400 mt-2 font-mono uppercase tracking-wide">
          Claim Type: {activeClaim.claim_type}
        </div>
      </div>

      {/* NLI Card */}
      {activeClaim.nli && (
        <div className={`glass-subtle border rounded-lg p-5 ${meta.border} ${meta.bg}`}>
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">
            Natural Language Inference (DeBERTa-v3)
          </div>
          <div className="h-2.5 w-full bg-white/10 rounded-full overflow-hidden flex mb-2">
            <motion.div initial={{ width: 0 }} animate={{ width: `${activeClaim.nli.entailment * 100}%` }} transition={{ duration: 0.6, ease: "easeOut", delay: 0.1 }} className="h-full bg-emerald-500" />
            <motion.div initial={{ width: 0 }} animate={{ width: `${activeClaim.nli.neutral * 100}%` }} transition={{ duration: 0.6, ease: "easeOut", delay: 0.15 }} className="h-full bg-slate-400" />
            <motion.div initial={{ width: 0 }} animate={{ width: `${activeClaim.nli.contradiction * 100}%` }} transition={{ duration: 0.6, ease: "easeOut", delay: 0.2 }} className="h-full bg-rose-500" />
          </div>
          <div className="flex justify-between text-[11px] font-mono text-slate-400">
            <span>Entailment {(activeClaim.nli.entailment * 100).toFixed(1)}%</span>
            <span>Neutral {(activeClaim.nli.neutral * 100).toFixed(1)}%</span>
            <span>Contradiction {(activeClaim.nli.contradiction * 100).toFixed(1)}%</span>
          </div>
        </div>
      )}

      {/* Numerical Reasoning Audit Card */}
      {activeClaim.numerical_finding && activeClaim.numerical_finding.comparison_outcome !== "NO_CALCULATION" && (
        <div className="glass-subtle border border-white/10 rounded-lg p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calculator className="h-4 w-4 text-amber-400" />
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                Deterministic Numerical Audit
              </div>
            </div>
            <Badge
              variant="outline"
              className={
                activeClaim.numerical_finding.comparison_outcome === "VALIDATED"
                  ? "text-emerald-300 border-emerald-400/30 bg-emerald-500/10 font-mono text-[10px]"
                  : "text-rose-300 border-rose-400/30 bg-rose-500/10 font-mono text-[10px]"
              }
            >
              {activeClaim.numerical_finding.comparison_outcome}
            </Badge>
          </div>

          {activeClaim.numerical_finding.formula && (
            <div className="p-2.5 rounded bg-black/30 border border-white/5 font-mono text-xs text-slate-300">
              <span className="text-slate-500 mr-2">Formula:</span>
              <span className="text-amber-200">{activeClaim.numerical_finding.formula}</span>
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1 text-xs font-mono">
            {activeClaim.numerical_finding.computed_result !== null && (
              <div className="p-2 rounded bg-white/[0.02] border border-white/5">
                <span className="text-slate-500 block text-[10px]">Computed Result</span>
                <span className="text-white font-semibold">{activeClaim.numerical_finding.computed_result}%</span>
              </div>
            )}
            {activeClaim.numerical_finding.reported_result !== null && (
              <div className="p-2 rounded bg-white/[0.02] border border-white/5">
                <span className="text-slate-500 block text-[10px]">Reported Result</span>
                <span className="text-white font-semibold">{activeClaim.numerical_finding.reported_result}%</span>
              </div>
            )}
            {activeClaim.numerical_finding.tolerance !== null && (
              <div className="p-2 rounded bg-white/[0.02] border border-white/5">
                <span className="text-slate-500 block text-[10px]">Rounding Tolerance</span>
                <span className="text-slate-400">±{activeClaim.numerical_finding.tolerance}%</span>
              </div>
            )}
          </div>

          <p className="text-xs text-slate-300 font-sans leading-relaxed pt-1">
            {activeClaim.numerical_finding.explanation}
          </p>
        </div>
      )}

      {/* Temporal Anchoring Card */}
      {activeClaim.temporal_anchor && activeClaim.temporal_anchor.period_match !== "UNSPECIFIED" && (
        <div className="glass-subtle border border-white/10 rounded-lg p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-cyan-400" />
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                Temporal Anchor & Grounding
              </div>
            </div>
            <Badge
              variant="outline"
              className={
                activeClaim.temporal_anchor.period_match === "ALIGNED"
                  ? "text-emerald-300 border-emerald-400/30 bg-emerald-500/10 font-mono text-[10px]"
                  : activeClaim.temporal_anchor.period_match === "MISALIGNED"
                  ? "text-rose-300 border-rose-400/30 bg-rose-500/10 font-mono text-[10px]"
                  : "text-amber-300 border-amber-400/30 bg-amber-500/10 font-mono text-[10px]"
              }
            >
              {activeClaim.temporal_anchor.period_match}
            </Badge>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs font-mono">
            <div className="p-2 rounded bg-white/[0.02] border border-white/5">
              <span className="text-slate-500 block text-[10px]">Claim Period</span>
              <span className="text-white">{activeClaim.temporal_anchor.claim_period || "None"}</span>
            </div>
            <div className="p-2 rounded bg-white/[0.02] border border-white/5">
              <span className="text-slate-500 block text-[10px]">Evidence Period</span>
              <span className="text-white">{activeClaim.temporal_anchor.evidence_period || "None"}</span>
            </div>
            {activeClaim.temporal_anchor.document_period && (
              <div className="p-2 rounded bg-white/[0.02] border border-white/5">
                <span className="text-slate-500 block text-[10px]">Document Context</span>
                <span className="text-slate-300">{activeClaim.temporal_anchor.document_period}</span>
              </div>
            )}
          </div>

          <p className="text-xs text-slate-300 font-sans leading-relaxed">
            {activeClaim.temporal_anchor.explanation}
          </p>
        </div>
      )}

      {/* Retrieved Evidence Card */}
      <div className="glass-subtle border border-white/10 rounded-lg p-5 space-y-3">
        <div className="flex items-center justify-between mb-1">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Retrieved Evidence</div>
          {activeClaim.evidence && activeClaim.evidence.page_number > 0 && (
            <div className="flex items-center gap-1.5 text-xs font-mono text-slate-400">
              <FileText className="h-3.5 w-3.5" /> {docTitle}, p. {activeClaim.evidence.page_number}
            </div>
          )}
        </div>

        {activeClaim.evidence && activeClaim.evidence.page_number > 0 ? (
          <>
            <p className="text-sm font-serif italic text-slate-300 leading-relaxed bg-white/[0.03] border border-white/10 rounded p-4">
              "{activeClaim.evidence.text}"
            </p>
            <div className="flex items-center justify-between text-xs font-mono text-slate-400">
              <span>Similarity score: {(activeClaim.evidence.similarity_score * 100).toFixed(1)}%</span>
              {pdfUrl && (
                <button
                  onClick={() => setShowPdfViewer(!showPdfViewer)}
                  className="inline-flex items-center gap-1.5 text-amber-300 hover:text-amber-200 transition-colors text-xs font-sans font-medium"
                >
                  {showPdfViewer ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  {showPdfViewer ? "Hide Source PDF" : `View Page ${pageNumber} in Source PDF`}
                </button>
              )}
            </div>
          </>
        ) : (
          <p className="text-sm text-slate-500 italic">
            No supporting or contradicting passage was found in the source document for this claim —
            that's why it's classified as unverifiable rather than false.
          </p>
        )}
      </div>

      {/* PDF.js Evidence Viewer Section (Phase 5 & 6) */}
      {showPdfViewer && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          transition={{ duration: 0.3 }}
          className="overflow-hidden"
        >
          <PdfEvidenceViewer
            documentId={liveSession?.document_id || activeSessionId || ""}
            initialPage={pageNumber}
            boundingBox={activeClaim.evidence?.bounding_box}
            evidenceText={activeClaim.evidence?.text}
            documentTitle={docTitle}
            ocrWords={activeClaim.evidence?.words}
            isOcr={activeClaim.evidence?.is_ocr}
            ocrConfidence={activeClaim.evidence?.ocr_confidence}
          />
        </motion.div>
      )}

      {/* Footer Badges */}
      <div className="flex items-center gap-3 pt-2">
        {activeClaim.risk_level && (
          <Badge variant="outline" className="text-slate-400 border-white/10 bg-white/5">
            Risk: {activeClaim.risk_level}
          </Badge>
        )}
        {activeClaim.confidence !== null && activeClaim.confidence !== undefined && (
          <Badge variant="outline" className="text-slate-400 border-white/10 bg-white/5">
            Confidence: {Math.round(activeClaim.confidence * 100)}%
          </Badge>
        )}
      </div>
    </motion.div>
  )
}
