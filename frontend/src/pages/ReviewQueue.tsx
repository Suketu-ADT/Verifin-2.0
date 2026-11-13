import { useEffect, useMemo, useState } from "react"
import { AlertTriangle, CheckCircle2, Edit3, FileText, History, RefreshCw, Search, ShieldCheck, XCircle } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardBody } from "@/components/ui/card"
import { Field, Input, Textarea } from "@/components/ui/input"
import { Modal } from "@/components/ui/modal"
import { Segmented } from "@/components/ui/tabs"
import { useToast } from "@/components/ui/toast"
import { PageHeading } from "@/components/shared/PageHeading"
import { MetricCard } from "@/components/shared/MetricCard"
import { EmptyState, ErrorState, Notice } from "@/components/shared/states"
import { cn } from "@/lib/utils"
import { formatDateTime, plural } from "@/lib/format"
import { errorMessage, getEngineConfig, getReviewQueue, submitReviewDecision, type ReviewItem } from "../lib/api"
import { useAuth } from "../lib/AuthContext"

type StatusTab = "all" | "pending" | "resolved"
type Action = "accept" | "correct" | "reject"

const ACTION_COPY: Record<Action, { title: string; cta: string; icon: typeof CheckCircle2; variant: "primary" | "danger" | "secondary" }> = {
  accept: { title: "Accept the original reading", cta: "Accept original", icon: CheckCircle2, variant: "primary" },
  correct: { title: "Correct the figure", cta: "Save correction", icon: Edit3, variant: "primary" },
  reject: { title: "Discard this figure", cta: "Discard figure", icon: XCircle, variant: "danger" },
}

/** Marks the characters OCR most often confuses with 0 or 1, so a reviewer knows where to look. */
function Glyphs({ text }: { text: string }) {
  return (
    <>
      {text.split("").map((char, index) =>
        /[oOlI|]/.test(char) ? (
          <span key={index} className="mx-px inline-block rounded-sm bg-unverifiable-tint px-1 font-semibold text-unverifiable-fg ring-1 ring-unverifiable-line" title={`Suspicious character “${char}”, often a misread 0 or 1`}>{char}</span>
        ) : (
          <span key={index}>{char}</span>
        ),
      )}
    </>
  )
}

function StatusChip({ status }: { status: ReviewItem["status"] }) {
  if (status === "accepted") return <Badge tone="success"><CheckCircle2 /> Original accepted</Badge>
  if (status === "corrected") return <Badge tone="brand"><Edit3 /> Corrected</Badge>
  if (status === "rejected") return <Badge tone="danger"><XCircle /> Discarded</Badge>
  return <Badge tone="warning">Awaiting review</Badge>
}

export default function ReviewQueue() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [items, setItems] = useState<ReviewItem[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [threshold, setThreshold] = useState<number | null>(null)

  const [selectedItem, setSelectedItem] = useState<ReviewItem | null>(null)
  const [actionType, setActionType] = useState<Action>("accept")
  const [reviewerId, setReviewerId] = useState(user?.email ?? "analyst")
  const [reason, setReason] = useState("")
  const [correctedValue, setCorrectedValue] = useState("")
  const [correctedText, setCorrectedText] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusTab, setStatusTab] = useState<StatusTab>("all")

  const fetchQueue = async () => {
    setLoading(true)
    setLoadError(null)
    try {
      setItems((await getReviewQueue()) ?? [])
    } catch (err: any) {
      setItems([])
      setLoadError(err?.message || "Could not load the review queue.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void fetchQueue()
    getEngineConfig().then((c) => setThreshold(c.ocr.confidence_threshold)).catch(() => {})
  }, [])

  const handleOpenAction = (item: ReviewItem, type: Action) => {
    setSelectedItem(item)
    setActionType(type)
    setReason(
      type === "accept" ? "Confirmed visual match against scanned source document."
      : type === "reject" ? "Figure is illegible or corrupted in scan; discarded from financial facts."
      : "",
    )
    setCorrectedValue(item.current_value !== null && item.current_value !== undefined ? String(item.current_value) : "")
    setCorrectedText(item.current_text)
    setFormError(null)
  }

  const handleSubmitDecision = async () => {
    if (!selectedItem) return
    if (!reason.trim()) {
      setFormError("Please provide an audit rationale for this decision.")
      return
    }
    setSubmitting(true)
    setFormError(null)
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
      toast({ title: "Decision recorded", description: `${ACTION_COPY[actionType].cta} was saved with your name, the time and your rationale.`, tone: "success" })
      setSelectedItem(null)
    } catch (err: any) {
      setFormError(errorMessage(err, err?.message || "Failed to submit review decision."))
    } finally {
      setSubmitting(false)
    }
  }

  const pendingCount = items.filter((i) => i.status === "pending").length
  const resolvedCount = items.length - pendingCount
  const decisionCount = items.reduce((n, i) => n + (i.audit_trail?.length ?? 0), 0)
  const avgConfidence = items.length > 0 ? items.reduce((acc, i) => acc + (i.ocr_confidence || 0), 0) / items.length : null

  const filteredItems = useMemo(() => {
    const q = searchQuery.toLowerCase()
    return items.filter((item) => {
      if (q && !(item.line_item_name.toLowerCase().includes(q) || item.document_id.toLowerCase().includes(q) || item.original_text.toLowerCase().includes(q))) return false
      if (statusTab === "pending") return item.status === "pending"
      if (statusTab === "resolved") return item.status !== "pending"
      return true
    })
  }, [items, searchQuery, statusTab])

  const below = (c: number) => threshold !== null && c < threshold
  const Act = ACTION_COPY[actionType]

  return (
    <div className="space-y-6">
      <PageHeading
        title="Review queue"
        subtitle="Figures read from scanned pages with low OCR confidence wait here for a person to check them, so a misread number can't quietly change a verdict."
        actions={
          <>
            <Badge tone="warning" className="px-3 py-1.5 text-[13px]">{plural(pendingCount, "item")} pending</Badge>
            <Button size="sm" onClick={() => void fetchQueue()} loading={loading}>{!loading && <RefreshCw />} Refresh</Button>
          </>
        }
      />

      {loadError ? (
        <ErrorState title="The review queue could not be loaded" message={loadError} onRetry={() => void fetchQueue()} />
      ) : (
        <>
          <div className="stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard label="Awaiting review" icon={AlertTriangle} value={pendingCount} loading={loading} hint="Needs an analyst's decision" />
            <MetricCard label="Resolved" icon={CheckCircle2} value={resolvedCount} loading={loading} hint="Decided by a reviewer" />
            <MetricCard label="Mean OCR confidence" icon={ShieldCheck} value={avgConfidence !== null ? `${avgConfidence.toFixed(1)}%` : "Unavailable"} loading={loading} hint={threshold !== null ? `Flag threshold: below ${threshold}%` : "Flag threshold unavailable"} />
            <MetricCard label="Decisions logged" icon={History} value={decisionCount} loading={loading} hint="Who, when and why, per figure" />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Segmented<StatusTab>
              label="Filter by status"
              value={statusTab}
              onChange={setStatusTab}
              options={[
                { value: "all", label: "All", count: items.length },
                { value: "pending", label: "Pending", count: pendingCount },
                { value: "resolved", label: "Audited", count: resolvedCount },
              ]}
            />
            <div className="relative min-w-56 flex-1 sm:max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
              <Input aria-label="Search the review queue" placeholder="Search line items, documents, tokens" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="h-9 pl-9" />
            </div>
          </div>

          {filteredItems.length === 0 && !loading ? (
            <EmptyState
              icon={ShieldCheck}
              title={items.length === 0 ? "Nothing is waiting for review" : "No items match this view"}
              message={items.length === 0 ? "A figure lands here when scanned-document OCR reads it with low confidence. Text-based PDFs, like the sample report, never need it." : "Try another tab or clear the search."}
            />
          ) : (
            <div className="space-y-4">
              {filteredItems.map((item) => {
                const isPending = item.status === "pending"
                const low = below(item.ocr_confidence)
                return (
                  <Card key={item.id} className="overflow-hidden">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-canvas px-5 py-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="grid size-8 shrink-0 place-items-center rounded-md border border-line bg-surface text-muted"><FileText className="size-4" aria-hidden="true" /></span>
                        <div className="min-w-0">
                          <div className="truncate text-[14px] font-semibold text-ink">{item.line_item_name}</div>
                          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
                            <span className="num break-all">Document {item.document_id}</span>
                            <Badge tone="outline">Page {item.page_number}</Badge>
                            {item.cell_row_idx !== undefined && <span className="num">Cell [{item.cell_row_idx}, {item.cell_col_idx}]</span>}
                          </div>
                        </div>
                      </div>
                      <StatusChip status={item.status} />
                    </div>

                    <CardBody className="space-y-4">
                      <div className="grid gap-3 sm:grid-cols-3">
                        <div className="rounded-lg border border-line p-3.5">
                          <div className="text-xs font-medium text-muted">Raw OCR reading</div>
                          <div className="mt-1 font-mono text-lg tracking-wide text-ink"><Glyphs text={item.original_text} /></div>
                          <div className="num mt-1 text-xs text-muted">Parsed value: {item.original_value != null ? item.original_value.toLocaleString() : "None"}</div>
                        </div>
                        <div className="rounded-lg border border-line p-3.5">
                          <div className="text-xs font-medium text-muted">Current working value</div>
                          <div className="mt-1 font-mono text-lg tracking-wide text-ink">{item.current_text}</div>
                          <div className="num mt-1 text-xs text-muted">Normalised: {item.current_value != null ? item.current_value.toLocaleString() : "None"}</div>
                        </div>
                        <div className="rounded-lg border border-line p-3.5">
                          <div className="text-xs font-medium text-muted">OCR confidence</div>
                          <div className="mt-1 flex flex-wrap items-center gap-2">
                            <span className="num text-lg font-semibold text-ink">{item.ocr_confidence.toFixed(1)}%</span>
                            {threshold !== null && <Badge tone={low ? "warning" : "neutral"}>{low ? `Below ${threshold}% floor` : "Above the floor"}</Badge>}
                          </div>
                          {item.bbox && <div className="num mt-1 text-xs text-muted">Box: [{Math.round(item.bbox.x0)}, {Math.round(item.bbox.top)}, {Math.round(item.bbox.x1)}, {Math.round(item.bbox.bottom)}]</div>}
                        </div>
                      </div>

                      <Notice tone="warning" title="Why this was flagged">{item.reason_for_review}</Notice>

                      {item.audit_trail && item.audit_trail.length > 0 && (
                        <div className="border-t border-line pt-4">
                          <div className="mb-2 flex items-center gap-1.5 text-[13px] font-medium text-ink"><History className="size-4 text-muted" aria-hidden="true" /> Audit history ({plural(item.audit_trail.length, "signed entry", "signed entries")})</div>
                          <ul className="space-y-2">
                            {item.audit_trail.map((entry, idx) => (
                              <li key={idx} className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-canvas px-3 py-2 text-[13px]">
                                <span className="min-w-0">
                                  <span className="font-medium text-ink">{entry.reviewer_id}</span>
                                  <Badge tone="outline" className="mx-2 uppercase">{entry.action}</Badge>
                                  <span className="font-mono text-xs text-muted">{entry.previous_text} → <span className="font-semibold text-ink">{entry.new_text}</span></span>
                                </span>
                                <span className="text-xs text-muted">{formatDateTime(entry.timestamp)} · “{entry.reason}”</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {isPending && (
                        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line pt-4">
                          <Button size="sm" onClick={() => handleOpenAction(item, "accept")}><CheckCircle2 /> Accept original</Button>
                          <Button size="sm" onClick={() => handleOpenAction(item, "correct")}><Edit3 /> Correct value</Button>
                          <Button size="sm" variant="danger" onClick={() => handleOpenAction(item, "reject")}><XCircle /> Reject and discard</Button>
                        </div>
                      )}
                    </CardBody>
                  </Card>
                )
              })}
            </div>
          )}
        </>
      )}

      <Modal
        open={selectedItem !== null}
        onClose={() => !submitting && setSelectedItem(null)}
        title={Act.title}
        description={selectedItem ? `${selectedItem.line_item_name} · page ${selectedItem.page_number}` : undefined}
        footer={
          <>
            <Button onClick={() => setSelectedItem(null)} disabled={submitting}>Cancel</Button>
            <Button variant={Act.variant} loading={submitting} onClick={() => void handleSubmitDecision()}>{Act.cta}</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Reviewer" htmlFor="reviewer-id" hint="Recorded with the decision.">
            <Input id="reviewer-id" value={reviewerId} onChange={(e) => setReviewerId(e.target.value)} placeholder="analyst_id" />
          </Field>
          {actionType === "correct" && (
            <>
              <Field label="Corrected display text" htmlFor="corrected-text">
                <Input id="corrected-text" value={correctedText} onChange={(e) => setCorrectedText(e.target.value)} className="font-mono" placeholder="e.g. 31,370" />
              </Field>
              <Field label="Corrected normalised number" htmlFor="corrected-value">
                <Input id="corrected-value" type="number" value={correctedValue} onChange={(e) => setCorrectedValue(e.target.value)} className="font-mono" placeholder="31370" />
              </Field>
            </>
          )}
          <Field label="Rationale (required)" htmlFor="reason" error={formError}>
            <Textarea id="reason" value={reason} onChange={(e) => setReason(e.target.value)} rows={3} placeholder="Explain why this figure was confirmed, corrected or discarded, based on the scanned page." aria-invalid={!!formError} className={cn(formError && "border-contradicted")} />
          </Field>
        </div>
      </Modal>
    </div>
  )
}
