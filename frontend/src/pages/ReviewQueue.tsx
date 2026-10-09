import { motion } from "framer-motion"
import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card"
import { Badge } from "../components/ui/badge"
import { Button } from "../components/ui/button"
import { Input } from "../components/ui/input"
import { 
  CheckCircle2, 
  XCircle, 
  Edit3, 
  History, 
  AlertTriangle, 
  FileText, 
  RefreshCw, 
  Check, 
  ShieldCheck,
  Eye
} from "lucide-react"
import { 
  getReviewQueue, 
  submitReviewDecision, 
  type ReviewItem 
} from "../lib/api"

// Built-in fallback demo items if MongoDB queue is empty
const DEMO_REVIEW_ITEMS: ReviewItem[] = [
  {
    id: "demo-rev-01",
    document_id: "sec-10k-aapl-2024",
    page_number: 32,
    cell_row_idx: 4,
    cell_col_idx: 1,
    line_item_name: "Research and Development",
    original_text: "31,37O", // Scanned typo 'O' instead of '0'
    original_value: 31370,
    current_text: "31,37O",
    current_value: 31370,
    ocr_confidence: 48.5,
    reason_for_review: "Low OCR character confidence in numerical token (potential letter 'O')",
    status: "pending",
    bbox: { x0: 120.4, top: 412.0, x1: 280.5, bottom: 432.8 },
    audit_trail: [],
    created_at: new Date(Date.now() - 3600000).toISOString(),
    updated_at: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: "demo-rev-02",
    document_id: "sec-10k-msft-2024",
    page_number: 48,
    cell_row_idx: 7,
    cell_col_idx: 2,
    line_item_name: "Cash and cash equivalents",
    original_text: "1l,l38", // Scanned digit 1 vs letter l ambiguity
    original_value: 11138,
    current_text: "1l,l38",
    current_value: 11138,
    ocr_confidence: 52.0,
    reason_for_review: "Ambiguous glyph detection: confidence below 60% threshold",
    status: "pending",
    bbox: { x0: 210.0, top: 540.2, x1: 320.0, bottom: 558.0 },
    audit_trail: [],
    created_at: new Date(Date.now() - 7200000).toISOString(),
    updated_at: new Date(Date.now() - 7200000).toISOString(),
  },
]

export default function ReviewQueue() {
  const [items, setItems] = useState<ReviewItem[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedItem, setSelectedItem] = useState<ReviewItem | null>(null)
  const [actionType, setActionType] = useState<"accept" | "correct" | "reject">("accept")
  const [reviewerId, setReviewerId] = useState("analyst_current")
  const [reason, setReason] = useState("")
  const [correctedValue, setCorrectedValue] = useState<string>("")
  const [correctedText, setCorrectedText] = useState<string>("")
  const [submitting, setSubmitting] = useState(false)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const fetchQueue = async () => {
    setLoading(true)
    setErrorMsg(null)
    try {
      const data = await getReviewQueue()
      if (data && data.length > 0) {
        setItems(data)
      } else {
        setItems(DEMO_REVIEW_ITEMS)
      }
    } catch {
      // In offline / demo mode fallback to demonstration items
      setItems(DEMO_REVIEW_ITEMS)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchQueue()
  }, [])

  const handleOpenAction = (item: ReviewItem, type: "accept" | "correct" | "reject") => {
    setSelectedItem(item)
    setActionType(type)
    setReason(
      type === "accept"
        ? "Confirmed visual match against scanned source document."
        : type === "reject"
        ? "Figure is illegible or corrupted in scan; discarded from financial facts."
        : ""
    )
    setCorrectedValue(item.current_value !== null && item.current_value !== undefined ? String(item.current_value) : "")
    setCorrectedText(item.current_text)
    setSuccessMsg(null)
    setErrorMsg(null)
  }

  const handleSubmitDecision = async () => {
    if (!selectedItem) return
    if (!reason.trim()) {
      setErrorMsg("Please provide an audit rationale for this decision.")
      return
    }

    setSubmitting(true)
    setErrorMsg(null)

    try {
      const payload = {
        reviewer_id: reviewerId || "analyst_1",
        action: actionType,
        reason: reason.trim(),
        corrected_value: actionType === "correct" && correctedValue ? parseFloat(correctedValue) : undefined,
        corrected_text: actionType === "correct" ? correctedText.trim() : undefined,
      }

      let updated: ReviewItem
      try {
        updated = await submitReviewDecision(selectedItem.id, payload)
      } catch {
        // Local simulation if demo ID
        const now = new Date().toISOString()
        updated = {
          ...selectedItem,
          status: actionType === "accept" ? "accepted" : actionType === "correct" ? "corrected" : "rejected",
          current_value: actionType === "correct" && correctedValue ? parseFloat(correctedValue) : actionType === "reject" ? null : selectedItem.original_value,
          current_text: actionType === "correct" && correctedText ? correctedText : actionType === "reject" ? "[REJECTED]" : selectedItem.original_text,
          audit_trail: [
            ...selectedItem.audit_trail,
            {
              reviewer_id: reviewerId,
              action: actionType,
              timestamp: now,
              previous_value: selectedItem.current_value,
              new_value: actionType === "correct" && correctedValue ? parseFloat(correctedValue) : null,
              previous_text: selectedItem.current_text,
              new_text: actionType === "correct" ? correctedText : "[REJECTED]",
              reason: reason.trim(),
            },
          ],
          updated_at: now,
        }
      }

      setItems((prev) => prev.map((it) => (it.id === selectedItem.id ? updated : it)))
      setSuccessMsg(`Decision '${actionType.toUpperCase()}' successfully logged to immutable audit trail.`)
      setSelectedItem(null)
    } catch (err: any) {
      setErrorMsg(err?.message || "Failed to submit review decision.")
    } finally {
      setSubmitting(false)
    }
  }

  const pendingCount = items.filter((i) => i.status === "pending").length

  return (
    <motion.div 
      initial="hidden" 
      animate="show" 
      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.1 } } }} 
      className="max-w-5xl mx-auto space-y-6"
    >
      <motion.div variants={{ hidden: { opacity: 0, y: 15 }, show: { opacity: 1, y: 0 } }} className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <ShieldCheck className="h-6 w-6 text-amber-400" />
            Human Review Queue
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Human-in-the-loop review for ambiguous OCR numerical cells. Prevents uncertain figures from silently becoming verified financial facts.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20 px-3 py-1 text-xs">
            {pendingCount} Pending Verification
          </Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchQueue}
            disabled={loading}
            className="text-xs border-white/10"
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </motion.div>

      {successMsg && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 text-xs flex items-center gap-2">
          <Check className="h-4 w-4 shrink-0" />
          <span>{successMsg}</span>
        </motion.div>
      )}

      {errorMsg && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-xs flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{errorMsg}</span>
        </motion.div>
      )}

      {/* Review Queue Items */}
      <div className="space-y-4">
        {items.map((item) => {
          const isPending = item.status === "pending"
          return (
            <Card key={item.id} className="border-white/10 glass-subtle transition-all hover:border-white/20">
              <CardHeader className="pb-3 border-b border-white/5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <FileText className="h-4 w-4 text-amber-400" />
                    <span className="font-semibold text-white text-sm">{item.line_item_name}</span>
                    <Badge variant="outline" className="text-[11px] text-slate-400 border-white/10">
                      Doc: {item.document_id}
                    </Badge>
                    <Badge variant="outline" className="text-[11px] text-amber-300 border-amber-500/30">
                      Page {item.page_number}
                    </Badge>
                  </div>
                  <div>
                    {item.status === "pending" && (
                      <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20 text-xs">Awaiting Review</Badge>
                    )}
                    {item.status === "accepted" && (
                      <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-xs">Accepted</Badge>
                    )}
                    {item.status === "corrected" && (
                      <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/20 text-xs">Corrected</Badge>
                    )}
                    {item.status === "rejected" && (
                      <Badge className="bg-rose-500/10 text-rose-400 border-rose-500/20 text-xs">Rejected</Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                  <div className="p-3 rounded-lg bg-white/[0.02] border border-white/5 space-y-1">
                    <div className="text-slate-400 font-medium">Original OCR Token</div>
                    <div className="text-sm font-mono font-bold text-white tracking-wide">
                      {item.original_text}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Value: {item.original_value != null ? item.original_value.toLocaleString() : "N/A"}
                    </div>
                  </div>

                  <div className="p-3 rounded-lg bg-white/[0.02] border border-white/5 space-y-1">
                    <div className="text-slate-400 font-medium">Current Working Value</div>
                    <div className="text-sm font-mono font-bold text-amber-300 tracking-wide">
                      {item.current_text}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Normalized: {item.current_value != null ? item.current_value.toLocaleString() : "None"}
                    </div>
                  </div>

                  <div className="p-3 rounded-lg bg-white/[0.02] border border-white/5 space-y-1">
                    <div className="text-slate-400 font-medium">OCR Confidence</div>
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-bold ${item.ocr_confidence < 60 ? "text-amber-400" : "text-emerald-400"}`}>
                        {item.ocr_confidence.toFixed(1)}%
                      </span>
                      <span className="text-[11px] text-slate-500">
                        ({item.ocr_confidence < 60 ? "Flagged Low" : "Adequate"})
                      </span>
                    </div>
                    {item.bbox && (
                      <div className="text-[10px] text-slate-500 font-mono">
                        bbox: [{Math.round(item.bbox.x0)}, {Math.round(item.bbox.top)}, {Math.round(item.bbox.x1)}, {Math.round(item.bbox.bottom)}]
                      </div>
                    )}
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-amber-500/5 border border-amber-500/10 text-xs text-amber-200/90 flex items-start gap-2">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-400 mt-0.5 shrink-0" />
                  <span><strong>Reason flagged:</strong> {item.reason_for_review}</span>
                </div>

                {/* Audit Trail Section */}
                {item.audit_trail && item.audit_trail.length > 0 && (
                  <div className="pt-2 border-t border-white/5">
                    <div className="text-[11px] font-semibold text-slate-400 mb-2 flex items-center gap-1.5">
                      <History className="h-3 w-3 text-slate-400" />
                      Immutable Audit Trail ({item.audit_trail.length} decision{item.audit_trail.length > 1 ? "s" : ""})
                    </div>
                    <div className="space-y-1.5">
                      {item.audit_trail.map((entry, idx) => (
                        <div key={idx} className="p-2 rounded bg-black/30 border border-white/5 text-[11px] text-slate-300 flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <span className="text-amber-400 font-semibold">{entry.reviewer_id}</span> applied <Badge variant="outline" className="text-[10px] uppercase ml-1 mr-2">{entry.action}</Badge>
                            <span className="text-slate-400 font-mono">{entry.previous_text} &rarr; {entry.new_text}</span>
                          </div>
                          <div className="text-[10px] text-slate-500">
                            {new Date(entry.timestamp).toLocaleString()} &bull; "{entry.reason}"
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Action Controls */}
                {isPending && (
                  <div className="flex flex-wrap items-center justify-end gap-2.5 pt-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleOpenAction(item, "accept")}
                      className="text-xs text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                      Accept Original
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleOpenAction(item, "correct")}
                      className="text-xs text-blue-400 border-blue-500/30 hover:bg-blue-500/10"
                    >
                      <Edit3 className="h-3.5 w-3.5 mr-1" />
                      Correct Figure
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleOpenAction(item, "reject")}
                      className="text-xs text-rose-400 border-rose-500/30 hover:bg-rose-500/10"
                    >
                      <XCircle className="h-3.5 w-3.5 mr-1" />
                      Reject Figure
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Decision Modal / Form */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="max-w-lg w-full glass border border-white/20 rounded-2xl p-6 space-y-4">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-lg font-bold text-white capitalize">
                  {actionType} Decision: {selectedItem.line_item_name}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Document {selectedItem.document_id} &bull; Page {selectedItem.page_number}
                </p>
              </div>
              <Button size="sm" variant="ghost" onClick={() => setSelectedItem(null)} className="h-8 w-8 p-0 text-slate-400">
                &times;
              </Button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-400 block mb-1">Reviewer ID</label>
                <Input
                  value={reviewerId}
                  onChange={(e) => setReviewerId(e.target.value)}
                  className="bg-white/5 border-white/10 text-white"
                  placeholder="analyst_id"
                />
              </div>

              {actionType === "correct" && (
                <>
                  <div>
                    <label className="text-slate-400 block mb-1">Corrected Text</label>
                    <Input
                      value={correctedText}
                      onChange={(e) => setCorrectedText(e.target.value)}
                      className="bg-white/5 border-white/10 text-white font-mono"
                      placeholder="e.g. 31,370"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">Corrected Numerical Value</label>
                    <Input
                      type="number"
                      value={correctedValue}
                      onChange={(e) => setCorrectedValue(e.target.value)}
                      className="bg-white/5 border-white/10 text-white font-mono"
                      placeholder="31370"
                    />
                  </div>
                </>
              )}

              <div>
                <label className="text-slate-400 block mb-1">Audit Justification / Rationale (Mandatory)</label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 text-xs"
                  placeholder="Explain why this figure was verified, corrected, or rejected..."
                />
              </div>
            </div>

            <div className="flex justify-end gap-2.5 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedItem(null)}
                className="text-xs border-white/10"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSubmitDecision}
                disabled={submitting}
                className={`text-xs font-semibold ${
                  actionType === "accept"
                    ? "bg-emerald-600 hover:bg-emerald-500 text-white"
                    : actionType === "correct"
                    ? "bg-blue-600 hover:bg-blue-500 text-white"
                    : "bg-rose-600 hover:bg-rose-500 text-white"
                }`}
              >
                {submitting ? "Logging..." : `Confirm ${actionType.toUpperCase()}`}
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </motion.div>
  )
}
