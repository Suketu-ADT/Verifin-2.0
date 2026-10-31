import { motion, AnimatePresence } from "framer-motion"
import { useState, useEffect, useMemo } from "react"
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
  Search,
  ChevronRight,
  Filter,
  Sparkles,
  ArrowRight,
  Eye,
  Sliders
} from "lucide-react"
import { 
  getReviewQueue, 
  submitReviewDecision, 
  type ReviewItem 
} from "../lib/api"
import { useAuth } from "../lib/AuthContext"

type StatusTab = "all" | "pending" | "resolved"

export default function ReviewQueue() {
  const { user } = useAuth()
  const [items, setItems] = useState<ReviewItem[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedItem, setSelectedItem] = useState<ReviewItem | null>(null)
  const [actionType, setActionType] = useState<"accept" | "correct" | "reject">("accept")
  const [reviewerId, setReviewerId] = useState(user?.email ?? "analyst")
  const [reason, setReason] = useState("")
  const [correctedValue, setCorrectedValue] = useState<string>("")
  const [correctedText, setCorrectedText] = useState<string>("")
  const [submitting, setSubmitting] = useState(false)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusTab, setStatusTab] = useState<StatusTab>("all")

  const fetchQueue = async () => {
    setLoading(true)
    setErrorMsg(null)
    try {
      setItems((await getReviewQueue()) ?? [])
    } catch (err: any) {
      setItems([])
      setErrorMsg(err?.message || "Could not load the review queue.")
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

      const updated: ReviewItem = await submitReviewDecision(selectedItem.id, payload)

      setItems((prev) => prev.map((it) => (it.id === selectedItem.id ? updated : it)))
      setSuccessMsg(`Decision '${actionType.toUpperCase()}' recorded with your name, the time and your rationale.`)
      setSelectedItem(null)
    } catch (err: any) {
      setErrorMsg(err?.message || "Failed to submit review decision.")
    } finally {
      setSubmitting(false)
    }
  }

  const pendingCount = items.filter((i) => i.status === "pending").length
  const resolvedCount = items.filter((i) => i.status !== "pending").length
  const decisionCount = items.reduce((n, i) => n + (i.audit_trail?.length ?? 0), 0)
  const avgConfidence = items.length > 0 
    ? (items.reduce((acc, i) => acc + (i.ocr_confidence || 0), 0) / items.length).toFixed(1)
    : "0.0"

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchesSearch = 
        item.line_item_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.document_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.original_text.toLowerCase().includes(searchQuery.toLowerCase())
      
      if (!matchesSearch) return false

      if (statusTab === "pending") return item.status === "pending"
      if (statusTab === "resolved") return item.status !== "pending"
      return true
    })
  }, [items, searchQuery, statusTab])

  // Helper to highlight suspicious characters in scanned OCR tokens
  const renderGlyphDiff = (text: string) => {
    return text.split("").map((char, index) => {
      const isSuspicious = char.toLowerCase() === "o" || char.toLowerCase() === "l" || char === "I" || char === "|"
      if (isSuspicious) {
        return (
          <span 
            key={index} 
            className="text-amber-300 bg-amber-500/20 px-1 py-0.5 rounded font-mono font-black ring-1 ring-amber-400/50 inline-block mx-0.5"
            title={`Suspicious glyph: '${char}' (often confused with numerical 0 or 1)`}
          >
            {char}
          </span>
        )
      }
      return <span key={index}>{char}</span>
    })
  }

  return (
    <motion.div 
      initial="hidden" 
      animate="show" 
      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.08 } } }} 
      className="max-w-6xl mx-auto space-y-6"
    >
      {/* Breadcrumb & Header */}
      <motion.div variants={{ hidden: { opacity: 0, y: 15 }, show: { opacity: 1, y: 0 } }} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5 font-mono">
            <span>VERIFIN</span>
            <ChevronRight className="h-3 w-3 text-slate-600" />
            <span className="text-amber-400">OCR Guardrails</span>
            <ChevronRight className="h-3 w-3 text-slate-600" />
            <span className="text-slate-300">Human Review</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center glow-amber">
              <ShieldCheck className="h-4.5 w-4.5 text-amber-400" />
            </div>
            Human Review Queue
          </h1>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            Human-in-the-loop review for low-confidence OCR numerical tokens. Ambiguous glyphs are quarantined here to prevent erroneous figures from silently poisoning financial NLI verdicts.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <Badge className="bg-amber-500/10 text-amber-300 border-amber-400/30 px-3 py-1.5 text-xs font-mono flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            {pendingCount} Pending Verification
          </Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchQueue}
            disabled={loading}
            className="text-xs border-white/10 hover:bg-white/5 transition-colors"
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? "animate-spin text-amber-400" : ""}`} />
            Refresh
          </Button>
        </div>
      </motion.div>

      {/* Telemetry Metric KPI Cards */}
      <motion.div variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }} className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="glass-card p-4 space-y-1 relative overflow-hidden group">
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-amber-500" />
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Active Quarantine</div>
          <div className="text-2xl font-bold font-mono text-amber-300">{pendingCount} <span className="text-xs font-normal text-slate-500">items</span></div>
          <div className="text-[11px] text-slate-400 flex items-center gap-1">
            <AlertTriangle className="h-3 w-3 text-amber-400" /> Awaiting analyst action
          </div>
        </div>

        <div className="glass-card p-4 space-y-1 relative overflow-hidden group">
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-emerald-500" />
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Resolved Audits</div>
          <div className="text-2xl font-bold font-mono text-emerald-300">{resolvedCount} <span className="text-xs font-normal text-slate-500">records</span></div>
          <div className="text-[11px] text-slate-400 flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3 text-emerald-400" /> Decided by a reviewer
          </div>
        </div>

        <div className="glass-card p-4 space-y-1 relative overflow-hidden group">
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-indigo-500" />
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Mean OCR Confidence</div>
          <div className="text-2xl font-bold font-mono text-indigo-300">{items.length > 0 ? `${avgConfidence}%` : "—"}</div>
          <div className="text-[11px] text-slate-400 flex items-center gap-1">
            <Sliders className="h-3 w-3 text-indigo-400" /> Flag threshold: &lt; 60%
          </div>
        </div>

        <div className="glass-card p-4 space-y-1 relative overflow-hidden group">
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-cyan-500" />
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Decisions Logged</div>
          <div className="text-2xl font-bold font-mono text-cyan-300">{decisionCount}</div>
          <div className="text-[11px] text-slate-400 flex items-center gap-1">
            <Sparkles className="h-3 w-3 text-cyan-400" /> Who, when and why, per item
          </div>
        </div>
      </motion.div>

      {/* Feedback Messages */}
      <AnimatePresence>
        {successMsg && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }} 
            animate={{ opacity: 1, y: 0 }} 
            exit={{ opacity: 0, y: -10 }} 
            className="p-3.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-300 text-xs flex items-center justify-between gap-2 glow-emerald"
          >
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4 shrink-0 text-emerald-400" />
              <span>{successMsg}</span>
            </div>
            <button onClick={() => setSuccessMsg(null)} className="text-emerald-400 hover:text-white">&times;</button>
          </motion.div>
        )}

        {errorMsg && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }} 
            animate={{ opacity: 1, y: 0 }} 
            exit={{ opacity: 0, y: -10 }} 
            className="p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-300 text-xs flex items-center justify-between gap-2 glow-rose"
          >
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400" />
              <span>{errorMsg}</span>
            </div>
            <button onClick={() => setErrorMsg(null)} className="text-rose-400 hover:text-white">&times;</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Filter and Search Bar */}
      <motion.div variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }} className="flex flex-col sm:flex-row items-center justify-between gap-3 glass-card p-2.5">
        <div className="flex items-center gap-1 w-full sm:w-auto">
          {(["all", "pending", "resolved"] as StatusTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setStatusTab(tab)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg capitalize transition-all ${
                statusTab === tab
                  ? "bg-amber-500/15 text-amber-300 border border-amber-400/30 shadow-sm"
                  : "text-slate-400 hover:text-white hover:bg-white/5 border border-transparent"
              }`}
            >
              {tab === "all" ? `All Items (${items.length})` : tab === "pending" ? `Pending (${pendingCount})` : `Audited (${resolvedCount})`}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search line items, docs, tokens..."
            className="h-8 w-full rounded-lg border border-white/10 bg-black/30 pl-8 pr-3 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-400"
          />
        </div>
      </motion.div>

      {/* Review Queue Items */}
      <div className="space-y-4">
        {filteredItems.length === 0 ? (
          <div className="text-center py-16 glass-card p-8 border-white/10 space-y-2">
            <ShieldCheck className="h-8 w-8 text-slate-500 mx-auto" />
            <h3 className="text-sm font-semibold text-white">{items.length === 0 ? "Nothing is waiting for review" : "No items match this view"}</h3>
            <p className="text-xs text-slate-400">{items.length === 0 ? "A figure lands here when scanned-document OCR reads it with low confidence. Text-based PDFs, like the sample report, never need it." : "Try another tab or clear the search."}</p>
          </div>
        ) : (
          filteredItems.map((item) => {
            const isPending = item.status === "pending"
            return (
              <motion.div 
                key={item.id} 
                variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }}
                className="glass-card hover:border-white/20 transition-all overflow-hidden"
              >
                {/* Header Row */}
                <div className="p-4 border-b border-white/5 flex flex-wrap items-center justify-between gap-3 bg-white/[0.01]">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <div className="w-7 h-7 rounded-md bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                      <FileText className="h-3.5 w-3.5 text-amber-400" />
                    </div>
                    <div>
                      <span className="font-bold text-white text-sm">{item.line_item_name}</span>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] font-mono text-slate-400">Doc: {item.document_id}</span>
                        <span className="text-[10px] font-mono text-slate-600">&bull;</span>
                        <Badge variant="outline" className="text-[10px] text-amber-300 border-amber-500/30 bg-amber-500/5 px-1.5 py-0">
                          Page {item.page_number}
                        </Badge>
                        {item.cell_row_idx !== undefined && (
                          <span className="text-[10px] font-mono text-slate-500">
                            Table Cell [{item.cell_row_idx}, {item.cell_col_idx}]
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div>
                    {item.status === "pending" && (
                      <Badge className="bg-amber-500/10 text-amber-300 border-amber-500/30 text-xs px-2.5 py-1 font-mono">
                        Awaiting Human Review
                      </Badge>
                    )}
                    {item.status === "accepted" && (
                      <Badge className="bg-emerald-500/10 text-emerald-300 border-emerald-500/30 text-xs px-2.5 py-1 font-mono flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" /> Accepted Original
                      </Badge>
                    )}
                    {item.status === "corrected" && (
                      <Badge className="bg-blue-500/10 text-blue-300 border-blue-500/30 text-xs px-2.5 py-1 font-mono flex items-center gap-1">
                        <Edit3 className="h-3 w-3" /> Manually Corrected
                      </Badge>
                    )}
                    {item.status === "rejected" && (
                      <Badge className="bg-rose-500/10 text-rose-300 border-rose-500/30 text-xs px-2.5 py-1 font-mono flex items-center gap-1">
                        <XCircle className="h-3 w-3" /> Discarded Token
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Content Details */}
                <div className="p-5 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 text-xs">
                    {/* Raw OCR Glyph */}
                    <div className="p-3.5 rounded-xl bg-black/40 border border-white/5 space-y-1.5">
                      <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                        Raw OCR Token
                      </div>
                      <div className="text-base font-mono font-bold text-white tracking-wider">
                        {renderGlyphDiff(item.original_text)}
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono">
                        Parsed Value: {item.original_value != null ? item.original_value.toLocaleString() : "N/A"}
                      </div>
                    </div>

                    {/* Current Working Value */}
                    <div className="p-3.5 rounded-xl bg-black/40 border border-white/5 space-y-1.5">
                      <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                        Current Working Interpretation
                      </div>
                      <div className="text-base font-mono font-bold text-amber-300 tracking-wider">
                        {item.current_text}
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono">
                        Normalized: {item.current_value != null ? item.current_value.toLocaleString() : "None"}
                      </div>
                    </div>

                    {/* OCR Confidence */}
                    <div className="p-3.5 rounded-xl bg-black/40 border border-white/5 space-y-1.5">
                      <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                        OCR Confidence Score
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-base font-mono font-bold ${item.ocr_confidence < 60 ? "text-amber-400" : "text-emerald-400"}`}>
                          {item.ocr_confidence.toFixed(1)}%
                        </span>
                        <Badge variant="outline" className={`text-[10px] ${item.ocr_confidence < 60 ? "border-amber-400/30 text-amber-300" : "border-emerald-400/30 text-emerald-300"}`}>
                          {item.ocr_confidence < 60 ? "Below 60% Floor" : "Acceptable"}
                        </Badge>
                      </div>
                      {item.bbox && (
                        <div className="text-[10px] text-slate-500 font-mono">
                          bbox: [{Math.round(item.bbox.x0)}, {Math.round(item.bbox.top)}, {Math.round(item.bbox.x1)}, {Math.round(item.bbox.bottom)}]
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Flag Reason */}
                  <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/15 text-xs text-amber-200/90 flex items-start gap-2.5">
                    <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold text-amber-300">Quarantine Rationale:</span> {item.reason_for_review}
                    </div>
                  </div>

                  {/* Audit Trail Section */}
                  {item.audit_trail && item.audit_trail.length > 0 && (
                    <div className="pt-3 border-t border-white/5">
                      <div className="text-[11px] font-semibold text-slate-400 mb-2 flex items-center gap-1.5">
                        <History className="h-3.5 w-3.5 text-slate-400" />
                        Immutable Audit History ({item.audit_trail.length} signed entry{item.audit_trail.length > 1 ? "s" : ""})
                      </div>
                      <div className="space-y-2">
                        {item.audit_trail.map((entry, idx) => (
                          <div key={idx} className="p-2.5 rounded-lg bg-black/40 border border-white/5 text-[11px] text-slate-300 flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <span className="text-amber-300 font-semibold font-mono">{entry.reviewer_id}</span>
                              <Badge variant="outline" className="text-[10px] uppercase ml-1.5 mr-2 font-mono border-white/10">{entry.action}</Badge>
                              <span className="text-slate-400 font-mono">{entry.previous_text} &rarr; <span className="text-white font-bold">{entry.new_text}</span></span>
                            </div>
                            <div className="text-[10px] text-slate-500 font-mono">
                              {new Date(entry.timestamp).toLocaleString()} &bull; "{entry.reason}"
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Action Controls */}
                  {isPending && (
                    <div className="flex flex-wrap items-center justify-end gap-2.5 pt-3 border-t border-white/5">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleOpenAction(item, "accept")}
                        className="text-xs text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/10 font-semibold transition-all"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5 mr-1 text-emerald-400" />
                        Accept Original
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleOpenAction(item, "correct")}
                        className="text-xs text-blue-300 border-blue-500/30 hover:bg-blue-500/10 font-semibold transition-all"
                      >
                        <Edit3 className="h-3.5 w-3.5 mr-1 text-blue-400" />
                        Correct Glyph / Value
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleOpenAction(item, "reject")}
                        className="text-xs text-rose-300 border-rose-500/30 hover:bg-rose-500/10 font-semibold transition-all"
                      >
                        <XCircle className="h-3.5 w-3.5 mr-1 text-rose-400" />
                        Reject & Discard
                      </Button>
                    </div>
                  )}
                </div>
              </motion.div>
            )
          })
        )}
      </div>

      {/* Decision Modal / Form */}
      <AnimatePresence>
        {selectedItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }} 
              animate={{ scale: 1, opacity: 1 }} 
              exit={{ scale: 0.95, opacity: 0 }}
              className="max-w-lg w-full glass-card border border-white/20 rounded-2xl p-6 space-y-4 shadow-2xl relative"
            >
              <div className="flex justify-between items-start border-b border-white/10 pb-3">
                <div>
                  <h3 className="text-base font-bold text-white capitalize flex items-center gap-2">
                    {actionType === "accept" && <CheckCircle2 className="h-4 w-4 text-emerald-400" />}
                    {actionType === "correct" && <Edit3 className="h-4 w-4 text-blue-400" />}
                    {actionType === "reject" && <XCircle className="h-4 w-4 text-rose-400" />}
                    Log Audit Decision: {selectedItem.line_item_name}
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5 font-mono">
                    Document: {selectedItem.document_id} &bull; Page {selectedItem.page_number}
                  </p>
                </div>
                <button 
                  onClick={() => setSelectedItem(null)} 
                  className="text-slate-400 hover:text-white text-lg leading-none p-1"
                >
                  &times;
                </button>
              </div>

              <div className="space-y-3.5 text-xs">
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Reviewer Identity</label>
                  <Input
                    value={reviewerId}
                    onChange={(e) => setReviewerId(e.target.value)}
                    className="bg-black/30 border-white/10 text-white font-mono text-xs"
                    placeholder="analyst_id"
                  />
                </div>

                {actionType === "correct" && (
                  <>
                    <div>
                      <label className="text-slate-300 font-semibold block mb-1">Corrected Display Text</label>
                      <Input
                        value={correctedText}
                        onChange={(e) => setCorrectedText(e.target.value)}
                        className="bg-black/30 border-white/10 text-amber-300 font-mono text-xs font-bold"
                        placeholder="e.g. 31,370"
                      />
                    </div>
                    <div>
                      <label className="text-slate-300 font-semibold block mb-1">Corrected Normalized Number</label>
                      <Input
                        type="number"
                        value={correctedValue}
                        onChange={(e) => setCorrectedValue(e.target.value)}
                        className="bg-black/30 border-white/10 text-white font-mono text-xs"
                        placeholder="31370"
                      />
                    </div>
                  </>
                )}

                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Audit Justification & Rationale (Mandatory)</label>
                  <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    rows={3}
                    className="w-full bg-black/30 border border-white/10 rounded-xl p-3 text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 text-xs leading-relaxed"
                    placeholder="Explain why this figure was verified, corrected, or rejected based on visual inspection..."
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-white/10">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedItem(null)}
                  className="text-xs border-white/10 hover:bg-white/5"
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleSubmitDecision}
                  disabled={submitting}
                  className={`text-xs font-bold px-4 ${
                    actionType === "accept"
                      ? "bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/20"
                      : actionType === "correct"
                      ? "bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/20"
                      : "bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/20"
                  }`}
                >
                  {submitting ? "Signing Audit..." : `Confirm ${actionType.toUpperCase()}`}
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
