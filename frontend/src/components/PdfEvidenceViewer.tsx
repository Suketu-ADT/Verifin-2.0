import { useState, useEffect, useRef } from "react"
import * as pdfjsLib from "pdfjs-dist"
import "pdfjs-dist/web/pdf_viewer.css"
import { Button } from "./ui/button"
import { Badge } from "./ui/badge"
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  RotateCw,
  ExternalLink,
  Loader2,
  FileText,
  AlertCircle,
  Sparkles,
  MousePointerClick,
  Layers,
  CheckCircle2,
} from "lucide-react"
import { fetchDocumentFile, type BoundingBox } from "../lib/api"

// Configure PDF.js worker
if (typeof window !== "undefined" && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
      "pdfjs-dist/build/pdf.worker.mjs",
      import.meta.url
    ).toString()
  } catch {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`
  }
}

export interface OCRWordCoordinate {
  text: string
  confidence: number
  bbox: {
    x0: number
    top: number
    x1: number
    bottom: number
    width: number
    height: number
    rel_x0?: number
    rel_top?: number
    rel_width?: number
    rel_height?: number
  }
  page_number?: number
  block_num?: number
  line_num?: number
  word_num?: number
}

export interface PdfEvidenceViewerProps {
  documentId: string
  initialPage?: number
  boundingBox?: BoundingBox | null
  evidenceText?: string
  documentTitle?: string
  ocrWords?: OCRWordCoordinate[] | null
  isOcr?: boolean
  ocrConfidence?: number | null
  onClose?: () => void
}

export function PdfEvidenceViewer({
  documentId,
  initialPage = 1,
  boundingBox,
  evidenceText,
  documentTitle = "Source Document",
  ocrWords,
  isOcr = false,
  ocrConfidence,
}: PdfEvidenceViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const textLayerRef = useRef<HTMLDivElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)

  const [pdfDoc, setPdfDoc] = useState<any>(null)
  const [currentPage, setCurrentPage] = useState<number>(initialPage)
  const [totalPages, setTotalPages] = useState<number>(1)
  const [scale, setScale] = useState<number>(1.25)
  const [rotation, setRotation] = useState<number>(0)
  const [loading, setLoading] = useState<boolean>(true)
  const [rendering, setRendering] = useState<boolean>(false)
  const [hasTextLayer, setHasTextLayer] = useState<boolean>(true)
  const [showOcrOverlay, setShowOcrOverlay] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [canvasDimensions, setCanvasDimensions] = useState<{ width: number; height: number }>({
    width: 0,
    height: 0,
  })

  // 1. Load PDF document
  useEffect(() => {
    let isCancelled = false
    setLoading(true)
    setError(null)

    // the file is fetched with the user's token, then handed to PDF.js as bytes
    let task: ReturnType<typeof pdfjsLib.getDocument> | null = null
    void fetchDocumentFile(documentId)
      .then((data) => {
        if (isCancelled) throw new Error("cancelled")
        task = pdfjsLib.getDocument({ data })
        return task.promise
      })
      .then((doc) => {
        if (!isCancelled) {
          setPdfDoc(doc)
          setTotalPages(doc.numPages)
          setCurrentPage(Math.min(Math.max(1, initialPage), doc.numPages))
          setLoading(false)
        }
      })
      .catch((err) => {
        if (!isCancelled) {
          console.error("PDF.js load error:", err)
          setError(
            err?.message?.includes("Missing PDF")
              ? "The source PDF file was not found on the server."
              : "Unable to load PDF document. Please check network connection or open directly."
          )
          setLoading(false)
        }
      })

    return () => {
      isCancelled = true
      try {
        void task?.destroy()
      } catch {}
    }
  }, [documentId])

  // The raw file needs the user's token, so "open in a new tab" fetches it first and opens a temporary local URL.
  const openRawPdf = async (page?: number) => {
    try {
      const data = await fetchDocumentFile(documentId)
      const url = URL.createObjectURL(new Blob([data as BlobPart], { type: "application/pdf" }))
      window.open(page ? `${url}#page=${page}` : url, "_blank", "noopener")
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch {
      setError("The source PDF could not be opened.")
    }
  }

  // Sync initialPage when prop updates
  useEffect(() => {
    if (initialPage && initialPage !== currentPage && totalPages >= initialPage) {
      setCurrentPage(initialPage)
    }
  }, [initialPage, totalPages])

  // 2. Render Page to Canvas and Interactive Text Layer
  useEffect(() => {
    if (!pdfDoc || !canvasRef.current) return

    let isCancelled = false
    setRendering(true)

    pdfDoc
      .getPage(currentPage)
      .then((page: any) => {
        if (isCancelled) return

        const viewport = page.getViewport({ scale, rotation })
        const canvas = canvasRef.current
        if (!canvas) return

        const context = canvas.getContext("2d")
        if (!context) return

        canvas.width = viewport.width
        canvas.height = viewport.height
        setCanvasDimensions({ width: viewport.width, height: viewport.height })

        const renderContext = {
          canvasContext: context,
          viewport: viewport,
        }

        const renderTask = page.render(renderContext)
        renderTask.promise
          .then(async () => {
            if (isCancelled) return

            // Render interactive PDF.js text layer (Requirement B.1 & B.3)
            if (textLayerRef.current) {
              textLayerRef.current.innerHTML = ""
              try {
                const textContent = await page.getTextContent()
                if (isCancelled) return

                if (!textContent || !textContent.items || textContent.items.length === 0) {
                  setHasTextLayer(false)
                } else {
                  setHasTextLayer(true)
                  const textLayer = new (pdfjsLib as any).TextLayer({
                    textContentSource: textContent,
                    container: textLayerRef.current,
                    viewport: viewport,
                  })
                  await textLayer.render()
                }
              } catch (err: any) {
                if (!isCancelled && err?.name !== "RenderingCancelledException") {
                  console.warn("Text layer render skipped or cancelled:", err)
                  setHasTextLayer(false)
                }
              }
            }

            if (!isCancelled) {
              setRendering(false)
            }
          })
          .catch((err: any) => {
            if (!isCancelled && err?.name !== "RenderingCancelledException") {
              console.error("Page render error:", err)
              setRendering(false)
            }
          })
      })
      .catch((err: any) => {
        if (!isCancelled) {
          console.error("Get page error:", err)
          setRendering(false)
        }
      })

    return () => {
      isCancelled = true
    }
  }, [pdfDoc, currentPage, scale, rotation])

  // 3. Coordinate System & Evidence Highlight Box Calculation
  const renderHighlightBox = () => {
    if (!boundingBox || canvasDimensions.width === 0) return null

    // If bounding box page differs from current page, don't render on wrong page
    if (boundingBox.page_number && boundingBox.page_number !== currentPage) {
      return null
    }

    let left = 0
    let top = 0
    let width = 0
    let height = 0

    if (boundingBox.x <= 1 && boundingBox.width <= 1) {
      // 0.0 - 1.0 relative fractions
      left = boundingBox.x * canvasDimensions.width
      top = boundingBox.y * canvasDimensions.height
      width = boundingBox.width * canvasDimensions.width
      height = boundingBox.height * canvasDimensions.height
    } else if (boundingBox.x <= 100 && boundingBox.width <= 100 && boundingBox.x + boundingBox.width <= 105) {
      // Percentages (0 - 100)
      left = (boundingBox.x / 100) * canvasDimensions.width
      top = (boundingBox.y / 100) * canvasDimensions.height
      width = (boundingBox.width / 100) * canvasDimensions.width
      height = (boundingBox.height / 100) * canvasDimensions.height
    } else {
      // PDF points (72 DPI points scaled by viewport factor)
      left = boundingBox.x * scale
      top = boundingBox.y * scale
      width = boundingBox.width * scale
      height = boundingBox.height * scale
    }

    return (
      <div
        className="pointer-events-none absolute z-10 rounded-sm border-2 border-unverifiable bg-unverifiable/15"
        style={{ left: `${left}px`, top: `${top}px`, width: `${width}px`, height: `${height}px` }}
      >
        <span className="absolute -top-5 left-0 rounded-sm bg-navy px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
          Evidence match
        </span>
      </div>
    )
  }

  // 4. OCR Word Coordinates & Confidence Overlay (Requirement B.6)
  const renderOcrConfidenceOverlay = () => {
    if (!showOcrOverlay || !ocrWords || ocrWords.length === 0 || canvasDimensions.width === 0) {
      return null
    }

    const pageWords = ocrWords.filter(
      (w) => !w.page_number || w.page_number === currentPage
    )
    if (pageWords.length === 0) return null

    return (
      <div className="absolute inset-0 pointer-events-none z-20">
        {pageWords.map((word, idx) => {
          let left = 0
          let top = 0
          let width = 0
          let height = 0

          if (
            word.bbox.rel_x0 !== undefined &&
            word.bbox.rel_top !== undefined &&
            word.bbox.rel_width !== undefined &&
            word.bbox.rel_height !== undefined
          ) {
            left = word.bbox.rel_x0 * canvasDimensions.width
            top = word.bbox.rel_top * canvasDimensions.height
            width = word.bbox.rel_width * canvasDimensions.width
            height = word.bbox.rel_height * canvasDimensions.height
          } else {
            left = word.bbox.x0 * scale
            top = word.bbox.top * scale
            width = word.bbox.width * scale
            height = word.bbox.height * scale
          }

          const isLowConf = word.confidence < 60
          const isMedConf = word.confidence >= 60 && word.confidence < 80

          const borderBgClass = isLowConf
            ? "border-contradicted bg-contradicted/20"
            : isMedConf
            ? "border-unverifiable bg-unverifiable/20"
            : "border-supported/70 bg-supported/10"

          return (
            <div
              key={idx}
              className={`group pointer-events-auto absolute cursor-pointer rounded-sm border ${borderBgClass}`}
              style={{
                left: `${left}px`,
                top: `${top}px`,
                width: `${Math.max(8, width)}px`,
                height: `${Math.max(8, height)}px`,
              }}
              title={`OCR: "${word.text}" | Confidence: ${word.confidence}%${isLowConf ? " [Needs Review]" : ""}`}
            >
              <div className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-navy px-2 py-1 text-[11px] text-white shadow-md group-hover:block">
                {word.text} ({word.confidence}%)
                {isLowConf && <span className="ml-1 font-semibold">Needs review</span>}
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  // Navigation handlers
  const handlePrevPage = () => setCurrentPage((p) => Math.max(1, p - 1))
  const handleNextPage = () => setCurrentPage((p) => Math.min(totalPages, p + 1))
  const handleZoomIn = () => setScale((s) => Math.min(2.5, s + 0.25))
  const handleZoomOut = () => setScale((s) => Math.max(0.75, s - 0.25))
  const handleRotate = () => setRotation((r) => (r + 90) % 360)

  const tool = "size-8 p-0"
  return (
    <div className="flex flex-col gap-3 overflow-hidden rounded-lg border border-line bg-surface p-4">
      {/* Header and controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <FileText className="size-4 shrink-0 text-muted" aria-hidden="true" />
          <span className="max-w-[12rem] truncate text-[13px] font-semibold text-ink sm:max-w-xs">{documentTitle}</span>
          <Badge tone="outline" className="num">Page {currentPage} of {totalPages}</Badge>
          {hasTextLayer ? (
            <Badge tone="neutral"><MousePointerClick aria-hidden="true" /> Selectable text</Badge>
          ) : (
            <Badge tone="warning"><Layers aria-hidden="true" /> Scanned page</Badge>
          )}
          {isOcr && <Badge tone="brand"><CheckCircle2 aria-hidden="true" /> OCR indexed{ocrConfidence ? ` (${ocrConfidence}%)` : ""}</Badge>}
        </div>

        <div className="flex flex-wrap items-center gap-1" role="toolbar" aria-label="Document controls">
          <Button size="sm" onClick={handlePrevPage} disabled={currentPage <= 1 || loading} className={tool} aria-label="Previous page"><ChevronLeft /></Button>
          <span className="num px-1 text-xs text-muted" aria-live="polite">{currentPage}/{totalPages}</span>
          <Button size="sm" onClick={handleNextPage} disabled={currentPage >= totalPages || loading} className={tool} aria-label="Next page"><ChevronRight /></Button>

          <span className="mx-1 h-4 w-px bg-line" aria-hidden="true" />

          <Button size="sm" onClick={handleZoomOut} disabled={scale <= 0.75 || loading} className={tool} aria-label="Zoom out"><ZoomOut /></Button>
          <span className="num px-1 text-xs text-muted">{Math.round(scale * 100)}%</span>
          <Button size="sm" onClick={handleZoomIn} disabled={scale >= 2.5 || loading} className={tool} aria-label="Zoom in"><ZoomIn /></Button>
          <Button size="sm" onClick={handleRotate} disabled={loading} className={tool} aria-label="Rotate 90 degrees"><RotateCw /></Button>

          {ocrWords && ocrWords.length > 0 && (
            <>
              <span className="mx-1 h-4 w-px bg-line" aria-hidden="true" />
              <Button size="sm" variant={showOcrOverlay ? "primary" : "secondary"} aria-pressed={showOcrOverlay} onClick={() => setShowOcrOverlay(!showOcrOverlay)}>
                <Layers /> {showOcrOverlay ? "Hide OCR" : "OCR overlay"}
              </Button>
            </>
          )}

          <span className="mx-1 h-4 w-px bg-line" aria-hidden="true" />
          <Button size="sm" onClick={() => void openRawPdf(currentPage)}>Open <ExternalLink /></Button>
        </div>
      </div>

      {/* Grounding status */}
      {boundingBox ? (
        <div className="flex items-center gap-2 rounded-md border border-unverifiable-line bg-unverifiable-tint px-3 py-2 text-xs text-ink">
          <Sparkles className="size-3.5 shrink-0 text-unverifiable" aria-hidden="true" />
          <span>The extracted passage is outlined on page {currentPage}. The text layer is selectable.</span>
        </div>
      ) : (
        <div className="rounded-md border border-line bg-canvas px-3 py-2 text-xs leading-relaxed text-muted">
          <span className="mr-1.5 font-medium text-ink">Page-level grounding.</span>
          Exact coordinates are not embedded in this document's text stream, so the excerpt is grounded to page {currentPage}.
        </div>
      )}

      {evidenceText && (
        <figure className="rounded-md border border-line bg-canvas p-3">
          <figcaption className="mb-1 text-xs font-medium text-muted">Grounded passage (page {currentPage})</figcaption>
          <blockquote className="excerpt text-[13px] italic leading-relaxed text-ink">“{evidenceText}”</blockquote>
        </figure>
      )}

      {/* Canvas, text layer and overlays */}
      <div ref={containerRef} className="relative flex h-[520px] w-full items-start justify-center overflow-auto rounded-md border border-line bg-subtle p-4">
        {loading && (
          <div role="status" className="m-auto space-y-2 text-center">
            <Loader2 className="mx-auto size-7 animate-spin text-muted" aria-hidden="true" />
            <p className="text-xs text-muted">Loading document…</p>
          </div>
        )}

        {rendering && !loading && (
          <div role="status" className="absolute right-4 top-4 z-20 flex items-center gap-1.5 rounded-md border border-line bg-surface px-2 py-1 text-xs text-muted shadow-sm">
            <Loader2 className="size-3 animate-spin" aria-hidden="true" /> Rendering…
          </div>
        )}

        {error && (
          <div role="alert" className="m-auto max-w-sm space-y-3 p-6 text-center">
            <AlertCircle className="mx-auto size-7 text-contradicted" aria-hidden="true" />
            <p className="text-[13px] text-ink">{error}</p>
            <button type="button" onClick={() => void openRawPdf()} className="inline-flex items-center gap-1 text-[13px] font-medium text-brand-2 hover:underline">
              Open the PDF directly <ExternalLink className="size-3.5" aria-hidden="true" />
            </button>
          </div>
        )}

        <div
          className={`relative inline-block ${loading || error ? "hidden" : ""}`}
          style={{
            width: canvasDimensions.width > 0 ? `${canvasDimensions.width}px` : undefined,
            height: canvasDimensions.height > 0 ? `${canvasDimensions.height}px` : undefined,
          }}
        >
          <canvas ref={canvasRef} className="block max-w-none rounded-sm bg-white shadow-md" />
          <div
            ref={textLayerRef}
            className="textLayer pointer-events-auto absolute inset-0 select-text overflow-hidden"
            style={{ width: `${canvasDimensions.width}px`, height: `${canvasDimensions.height}px` }}
          />
          {renderHighlightBox()}
          {renderOcrConfidenceOverlay()}
        </div>
      </div>
    </div>
  )
}
