import { useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { ArrowRight, CheckCircle2, Cpu, FileText, FileUp, Info, Scale, Search, Sparkles, Upload, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardBody, CardHeader } from "@/components/ui/card"
import { Textarea } from "@/components/ui/input"
import { Notice } from "@/components/shared/states"
import { PageHeading } from "@/components/shared/PageHeading"
import { cn } from "@/lib/utils"
import { useStoredState } from "@/lib/hooks"
import { plural } from "@/lib/format"
import { uploadDocument, startVerification, extractFactsFromDocument, errorMessage, formatBytes, type DocumentResponse } from "../lib/api"

const SAMPLE_STATEMENT =
  "Revenue grew 22.5% year over year to USD 486.75 million in FY2025. Operating income for FY2025 was USD 74.25 million. " +
  "Interest expense for FY2025 amounted to USD 9,450 million. Total assets reached USD 470.0 million at 31 March 2025. " +
  "Cash and cash equivalents increased by USD 11.5 million during FY2025. " +
  "Net profit decreased from USD 51.0 million in FY2024 to USD 46.35 million in FY2025. " +
  "Northstar completed the acquisition of Helios Data Systems in FY2025."

const MAX_BYTES = 25 * 1024 * 1024

const PIPELINE = [
  { icon: FileText, label: "Split the answer into claims", note: "Each sentence becomes one checkable claim." },
  { icon: Search, label: "Find evidence in the document", note: "Passages and tables most relevant to each claim." },
  { icon: Cpu, label: "Compare claim with evidence", note: "A language-inference model judges whether the text supports it." },
  { icon: Scale, label: "Apply consistency rules", note: "Figures, dates, entities and multi-step reasoning are cross-checked." },
]

const MODES = [
  { id: "hybrid", label: "Hybrid", desc: "Meaning and exact wording combined", tag: "Recommended" },
  { id: "dense", label: "Semantic", desc: "Matches by meaning (embeddings)" },
  { id: "bm25", label: "Keyword", desc: "Matches exact terms (BM25)" },
]

const GOOD_CLAIMS = [
  "Revenue grew 22.5% year over year to USD 486.75 million in FY2025.",
  "Net profit decreased from USD 51.0 million in FY2024 to USD 46.35 million in FY2025.",
  "The company completed the acquisition of a named business in FY2025.",
]

export default function VerificationFlow() {
  const navigate = useNavigate()
  const fileInput = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [answer, setAnswer] = useState("")
  const [retrievalMode, setRetrievalMode] = useStoredState("verifin.retrieval", "hybrid")
  const [dragging, setDragging] = useState(false)

  const [uploadedDoc, setUploadedDoc] = useState<DocumentResponse | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

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
    } catch (err: any) {
      const detail = err?.response?.data?.detail || err?.message || "Failed to extract facts with LLM."
      setExtractError(typeof detail === "string" ? detail : JSON.stringify(detail))
    } finally {
      setIsExtracting(false)
    }
  }

  const handleFileSelect = async (file: File | undefined, example?: string) => {
    if (!file) return
    setUploadError(null)
    setSubmitError(null)
    setExtractError(null)
    setExtractedCount(null)

    if (!file.name.toLowerCase().endsWith(".pdf")) {
      setUploadError("Only PDF documents are supported.")
      return
    }
    if (file.size === 0) {
      setUploadError("The selected PDF file is empty (0 bytes).")
      return
    }
    if (file.size > MAX_BYTES) {
      setUploadError("File exceeds the 25 MB size limit.")
      return
    }

    setFileName(file.name)
    setIsUploading(true)
    setUploadProgress(0)

    try {
      const doc = await uploadDocument(file, (percent) => setUploadProgress(percent))
      setUploadedDoc(doc)
      setIsUploading(false)
      if (example) setAnswer(example)
      else void handleExtractFacts(doc.id) // pulls candidate claims out of the document straight after upload
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
    setExtractedCount(null)
    setExtractError(null)
    if (fileInput.current) fileInput.current.value = ""
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
      setSubmitError(typeof detail === "string" ? detail : errorMessage(err, JSON.stringify(detail)))
    }
  }

  const canSubmit = Boolean(uploadedDoc) && answer.trim().length > 0 && !isUploading && !isSubmitting && !isExtracting

  return (
    <div className="space-y-6">
      <PageHeading
        title="New verification"
        subtitle="Check an AI-written financial answer against the source document. VERIFIN splits it into claims and tests each one against the evidence."
      />

      <ol className="grid gap-3 sm:grid-cols-3" aria-label="How it works">
        {[
          ["1", "Add the source document", "The filing or report the answer should be based on (PDF)."],
          ["2", "Provide the statements", "Paste an AI answer, or let VERIFIN draft claims from the document."],
          ["3", "Review the verdicts", "Every claim is labelled with its evidence and the reason for the verdict."],
        ].map(([n, t, d]) => (
          <li key={n} className="flex gap-3 rounded-lg border border-line bg-surface p-3.5 shadow-xs">
            <span className="num grid size-6 shrink-0 place-items-center rounded-full bg-brand-tint text-xs font-semibold text-brand">{n}</span>
            <div>
              <div className="text-[13px] font-medium text-ink">{t}</div>
              <div className="mt-0.5 text-xs leading-relaxed text-muted">{d}</div>
            </div>
          </li>
        ))}
      </ol>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Step 1: document */}
        <Card className="flex flex-col">
          <CardHeader title="1 · Source document" description="The text every claim will be checked against." />
          <CardBody className="flex-1 space-y-4">
            {isUploading ? (
              <div className="rounded-lg border border-line bg-canvas p-6 text-center" role="status">
                <div className="text-sm font-medium text-ink">Uploading and indexing {fileName}…</div>
                <div className="mx-auto mt-3 h-2 max-w-xs overflow-hidden rounded-full bg-line" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={uploadProgress} aria-label="Upload progress">
                  <div className="h-full rounded-full bg-brand-2 transition-[width] duration-200" style={{ width: `${uploadProgress}%` }} />
                </div>
                <div className="num mt-2 text-xs text-muted">{uploadProgress}%</div>
              </div>
            ) : !fileName ? (
              <label
                className={cn(
                  "flex cursor-pointer flex-col items-center rounded-lg border-2 border-dashed p-8 text-center transition-colors focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-focus",
                  dragging ? "border-brand-2 bg-brand-tint" : "border-line-strong bg-canvas hover:border-faint hover:bg-subtle",
                )}
                onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => { e.preventDefault(); setDragging(false); void handleFileSelect(e.dataTransfer.files?.[0]) }}
              >
                <span className="mb-3 grid size-11 place-items-center rounded-lg border border-line bg-surface text-brand-2"><Upload className="size-5" aria-hidden="true" /></span>
                <span className="text-sm font-medium text-ink">Drop a PDF here, or <span className="text-brand-2 underline underline-offset-2">browse</span></span>
                <span className="mt-1 text-xs text-muted">PDF only · up to 25 MB · text-based filings such as 10-K, 10-Q, 8-K or annual reports</span>
                <input ref={fileInput} type="file" accept="application/pdf" className="sr-only" onChange={(e) => void handleFileSelect(e.target.files?.[0])} />
              </label>
            ) : (
              <div className="flex items-center justify-between gap-3 rounded-lg border border-line bg-canvas p-3.5">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-md border border-line bg-surface text-brand-2"><FileText className="size-5" aria-hidden="true" /></span>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-ink">{fileName}</div>
                    {uploadedDoc && (
                      <div className="num mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted">
                        <span className="inline-flex items-center gap-1 text-supported-fg"><CheckCircle2 className="size-3.5" aria-hidden="true" /> Ready</span>
                        <span>{formatBytes(uploadedDoc.size)}</span>
                        <span>{plural(uploadedDoc.page_count, "page")}</span>
                      </div>
                    )}
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={handleRemove}><X /> Change</Button>
              </div>
            )}

            {uploadError && (
              <Notice tone="error" title="Upload failed" action={<Button size="sm" onClick={handleRemove}>Try again</Button>}>{uploadError}</Notice>
            )}

            <div className="rounded-lg border border-line p-3.5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-1.5 text-[13px] font-medium text-ink"><Sparkles className="size-3.5 text-brand-2" aria-hidden="true" /> No report to hand?</div>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted">Try the Northstar sample report. It comes with seven statements, some of them deliberately wrong, so you can see every verdict type.</p>
                </div>
                <Button size="sm" onClick={() => void loadSampleReport()} disabled={isUploading}>Use sample</Button>
              </div>
            </div>
          </CardBody>
        </Card>

        {/* Step 2: statements */}
        <Card className="flex flex-col">
          <CardHeader
            title="2 · Statements to check"
            description="The AI-written answer, or any financial statements you want tested."
            action={uploadedDoc && (
              <Button size="sm" onClick={() => void handleExtractFacts()} loading={isExtracting} disabled={isUploading}>
                {!isExtracting && <Sparkles />} {answer ? "Re-extract" : "Draft from document"}
              </Button>
            )}
          />
          <CardBody className="flex-1 space-y-3">
            {isExtracting && <Notice tone="info" title="Reading the document and drafting claims…">This can take a little while for long filings.</Notice>}
            {extractError && (
              <Notice tone="error" title="Could not draft claims" action={<Button size="sm" onClick={() => void handleExtractFacts()}>Retry</Button>}>{extractError}</Notice>
            )}
            {extractedCount !== null && !isExtracting && (
              <Notice tone="success" title={`Drafted ${plural(extractedCount, "statement")} from the document`}>Review and edit the text below before verifying.</Notice>
            )}

            <label htmlFor="statements" className="sr-only">Statements to verify</label>
            <Textarea
              id="statements"
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="Paste the AI-generated answer here, or draft claims from the document…"
              className="min-h-44"
            />
            <div className="flex items-center justify-between text-xs text-muted">
              <span className="num">{answer.length.toLocaleString()} characters · no fixed length limit</span>
              {answer && <button type="button" className="text-brand-2 hover:underline" onClick={() => setAnswer("")}>Clear</button>}
            </div>

            <details className="group rounded-lg border border-line bg-canvas p-3 text-[13px]">
              <summary className="flex cursor-pointer list-none items-center gap-2 font-medium text-ink">
                <Info className="size-4 text-brand-2" aria-hidden="true" /> What makes a good statement?
              </summary>
              <div className="mt-2 space-y-2 text-xs leading-relaxed text-muted">
                <p>One factual claim per sentence works best, with the figure, period and entity stated, for example:</p>
                <ul className="list-disc space-y-1 pl-5">{GOOD_CLAIMS.map((c) => <li key={c}>{c}</li>)}</ul>
                <p>Opinions, forecasts and general commentary can't be confirmed by a filing and are usually returned as unverifiable.</p>
              </div>
            </details>
          </CardBody>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Evidence search" description="How VERIFIN finds passages in the document. Your default is set in Settings." />
          <CardBody>
            <div role="radiogroup" aria-label="Evidence search method" className="grid gap-2 sm:grid-cols-3">
              {MODES.map((m) => {
                const on = retrievalMode === m.id
                return (
                  <button
                    key={m.id}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => setRetrievalMode(m.id)}
                    className={cn("rounded-lg border p-3 text-left transition-colors", on ? "border-brand bg-brand-tint" : "border-line bg-surface hover:border-line-strong hover:bg-subtle")}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[13px] font-medium text-ink">{m.label}</span>
                      {on && <CheckCircle2 className="size-4 text-brand" aria-hidden="true" />}
                    </div>
                    <div className="mt-0.5 text-xs text-muted">{m.desc}</div>
                    {m.tag && <div className="mt-1.5 text-[11px] font-medium text-brand-2">{m.tag}</div>}
                  </button>
                )
              })}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="What happens next" description="The steps the engine runs on every verification." />
          <CardBody>
            <ol className="space-y-3">
              {PIPELINE.map((s) => (
                <li key={s.label} className="flex gap-3">
                  <span className="grid size-7 shrink-0 place-items-center rounded-md bg-brand-tint text-brand"><s.icon className="size-3.5" aria-hidden="true" /></span>
                  <div>
                    <div className="text-[13px] font-medium text-ink">{s.label}</div>
                    <div className="text-xs text-muted">{s.note}</div>
                  </div>
                </li>
              ))}
            </ol>
          </CardBody>
        </Card>
      </div>

      {submitError && <Notice tone="error" title="Verification could not start">{submitError}</Notice>}

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-surface p-4 shadow-xs">
        <p className="text-[13px] text-muted" aria-live="polite">
          {isSubmitting
            ? "Verifying. The engine is checking every claim against the document, which can take a minute…"
            : canSubmit
              ? "Ready. Results open as soon as the check finishes."
              : "Add a PDF and some statements to continue."}
        </p>
        <Button variant="primary" size="lg" disabled={!canSubmit} loading={isSubmitting} onClick={handleSubmit}>
          {isSubmitting ? "Verifying…" : <><FileUp /> Verify claims <ArrowRight /></>}
        </Button>
      </div>
    </div>
  )
}
