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
import { getDocumentFileUrl, type BoundingBox } from "../lib/api"

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

  const pdfUrl = getDocumentFileUrl(documentId)

  // 1. Load PDF document
  useEffect(() => {
    let isCancelled = false
    setLoading(true)
    setError(null)

    const loadingTask = pdfjsLib.getDocument({
      url: pdfUrl,
      withCredentials: false,
    })

    loadingTask.promise
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
        loadingTask.destroy()
      } catch {}
    }
  }, [pdfUrl, documentId])

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
        className="absolute pointer-events-none rounded transition-all duration-200 border-2 border-amber-400 bg-amber-400/20 shadow-[0_0_12px_rgba(251,191,36,0.6)] animate-pulse z-10"
        style={{
          left: `${left}px`,
          top: `${top}px`,
          width: `${width}px`,
          height: `${height}px`,
        }}
      >
        <span className="absolute -top-5 left-0 px-1 py-0.2 bg-amber-500 text-black text-[9px] font-bold rounded font-mono uppercase tracking-wider">
          Evidence Match
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
            ? "border-rose-500/80 bg-rose-500/20 text-rose-300"
            : isMedConf
            ? "border-amber-400/80 bg-amber-400/20 text-amber-300"
            : "border-emerald-400/60 bg-emerald-400/10 text-emerald-300"

          return (
            <div
              key={idx}
              className={`absolute pointer-events-auto border rounded text-[8px] font-mono transition-opacity group cursor-pointer ${borderBgClass}`}
              style={{
                left: `${left}px`,
                top: `${top}px`,
                width: `${Math.max(8, width)}px`,
                height: `${Math.max(8, height)}px`,
              }}
              title={`OCR: "${word.text}" | Confidence: ${word.confidence}%${isLowConf ? " [Needs Review]" : ""}`}
            >
              <div className="hidden group-hover:block absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-1.5 py-0.5 rounded bg-black/90 border border-white/20 text-[9px] text-white whitespace-nowrap shadow-xl z-30 pointer-events-none">
                {word.text} ({word.confidence}%)
                {isLowConf && <span className="text-rose-400 font-bold ml-1">[Review]</span>}
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

  return (
    <div className="glass-subtle border border-white/10 rounded-xl overflow-hidden space-y-3 p-4 flex flex-col">
      {/* Viewer Header & Controls */}
      <div className="flex items-center justify-between gap-3 flex-wrap border-b border-white/10 pb-3">
        <div className="flex items-center gap-2 min-w-0">
          <FileText className="h-4 w-4 text-amber-400 shrink-0" />
          <span className="text-xs font-semibold text-white truncate max-w-[160px] sm:max-w-xs">
            {documentTitle}
          </span>
          <Badge variant="outline" className="text-amber-300 border-amber-400/30 bg-amber-500/10 text-[10px] shrink-0 font-mono">
            Page {currentPage} of {totalPages}
          </Badge>

          {/* Text Layer Status Badge */}
          {hasTextLayer ? (
            <Badge variant="outline" className="text-cyan-300 border-cyan-400/30 bg-cyan-500/10 text-[10px] shrink-0 font-mono flex items-center gap-1">
              <MousePointerClick className="h-2.5 w-2.5" /> Selectable Text
            </Badge>
          ) : (
            <Badge variant="outline" className="text-amber-300 border-amber-400/30 bg-amber-500/10 text-[10px] shrink-0 font-mono flex items-center gap-1">
              <Layers className="h-2.5 w-2.5" /> Scanned Page
            </Badge>
          )}

          {/* OCR indicator badge */}
          {isOcr && (
            <Badge variant="outline" className="text-emerald-300 border-emerald-400/30 bg-emerald-500/10 text-[10px] shrink-0 font-mono flex items-center gap-1">
              <CheckCircle2 className="h-2.5 w-2.5" /> OCR Indexed {ocrConfidence ? `(${ocrConfidence}%)` : ""}
            </Badge>
          )}
        </div>

        {/* Toolbar Controls */}
        <div className="flex items-center gap-1 shrink-0 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrevPage}
            disabled={currentPage <= 1 || loading}
            className="h-7 w-7 p-0"
            title="Previous Page"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>

          <span className="text-[11px] font-mono text-slate-300 px-1">
            {currentPage}/{totalPages}
          </span>

          <Button
            variant="outline"
            size="sm"
            onClick={handleNextPage}
            disabled={currentPage >= totalPages || loading}
            className="h-7 w-7 p-0"
            title="Next Page"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>

          <div className="w-px h-4 bg-white/10 mx-1" />

          <Button
            variant="outline"
            size="sm"
            onClick={handleZoomOut}
            disabled={scale <= 0.75 || loading}
            className="h-7 w-7 p-0"
            title="Zoom Out"
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </Button>

          <span className="text-[10px] font-mono text-slate-400 px-1">
            {Math.round(scale * 100)}%
          </span>

          <Button
            variant="outline"
            size="sm"
            onClick={handleZoomIn}
            disabled={scale >= 2.5 || loading}
            className="h-7 w-7 p-0"
            title="Zoom In"
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleRotate}
            disabled={loading}
            className="h-7 w-7 p-0"
            title="Rotate 90°"
          >
            <RotateCw className="h-3.5 w-3.5" />
          </Button>

          {/* Toggle OCR Overlay Button (when OCR words exist) */}
          {(ocrWords && ocrWords.length > 0) && (
            <>
              <div className="w-px h-4 bg-white/10 mx-1" />
              <Button
                variant={showOcrOverlay ? "default" : "outline"}
                size="sm"
                onClick={() => setShowOcrOverlay(!showOcrOverlay)}
                className="h-7 px-2 text-[11px] gap-1 font-mono"
                title="Toggle OCR Word Confidence Highlights"
              >
                <Layers className="h-3 w-3" />
                {showOcrOverlay ? "Hide OCR" : "OCR Overlay"}
              </Button>
            </>
          )}

          <div className="w-px h-4 bg-white/10 mx-1" />

          <a
            href={`${pdfUrl}#page=${currentPage}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-white px-2 py-1 rounded border border-white/10 hover:border-white/20 transition-colors"
            title="Open raw PDF file in new browser window"
          >
            Tab <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>

      {/* Coordinate & Grounding Status Banner */}
      {boundingBox ? (
        <div className="flex items-center gap-2 p-2 rounded bg-emerald-500/10 border border-emerald-400/20 text-emerald-300 text-xs">
          <Sparkles className="h-3.5 w-3.5 shrink-0" />
          <span>
            Bounding-box overlay active on Page {currentPage}: highlighting extracted passage coordinates. Text layer is selectable.
          </span>
        </div>
      ) : (
        <div className="p-2.5 rounded bg-white/[0.02] border border-white/5 text-xs text-slate-400 leading-relaxed">
          <span className="font-semibold text-slate-300 mr-1.5">Page-Level Grounding:</span>
          Exact bounding box coordinates are not embedded in this document's text stream. Verbatim excerpt navigation is grounded to Page {currentPage}.
        </div>
      )}

      {/* Verbatim Evidence Snippet Callout */}
      {evidenceText && (
        <div className="p-3 rounded bg-black/40 border border-white/10 text-xs font-serif italic text-slate-300">
          <span className="text-[10px] font-sans font-bold uppercase tracking-widest text-slate-500 block not-italic mb-1">
            Grounded Passage Excerpt (Page {currentPage})
          </span>
          "{evidenceText}"
        </div>
      )}

      {/* Canvas + Text Layer Viewport Container */}
      <div
        ref={containerRef}
        className="relative w-full h-[520px] rounded-lg border border-white/10 bg-black/60 overflow-auto flex items-center justify-center p-4"
      >
        {loading && (
          <div className="text-center space-y-2">
            <Loader2 className="h-8 w-8 text-amber-400 animate-spin mx-auto" />
            <p className="text-xs text-slate-400">Loading document structure...</p>
          </div>
        )}

        {rendering && !loading && (
          <div className="absolute top-4 right-4 z-20 px-2 py-1 rounded bg-black/80 border border-white/20 text-[10px] text-amber-300 font-mono flex items-center gap-1.5 backdrop-blur-sm">
            <Loader2 className="h-3 w-3 animate-spin" /> Rendering...
          </div>
        )}

        {error && (
          <div className="text-center space-y-3 p-6 max-w-sm">
            <AlertCircle className="h-8 w-8 text-rose-400 mx-auto" />
            <p className="text-xs text-slate-300">{error}</p>
            <a
              href={pdfUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs text-amber-300 hover:text-amber-200"
            >
              Open PDF directly <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        )}

        {/* The PDF.js Canvas + Highlighting Overlay + Interactive Text Layer */}
        <div
          className={`relative inline-block transition-opacity duration-150 ${
            loading || error ? "hidden" : "opacity-100"
          }`}
          style={{
            width: canvasDimensions.width > 0 ? `${canvasDimensions.width}px` : undefined,
            height: canvasDimensions.height > 0 ? `${canvasDimensions.height}px` : undefined,
          }}
        >
          <canvas ref={canvasRef} className="rounded shadow-2xl block max-w-none" />

          {/* PDF.js Interactive Text Layer (Requirement B.1 - B.4) */}
          <div
            ref={textLayerRef}
            className="textLayer absolute inset-0 overflow-hidden pointer-events-auto select-text"
            style={{
              width: `${canvasDimensions.width}px`,
              height: `${canvasDimensions.height}px`,
            }}
          />

          {/* Evidence Highlight Box (Requirement B.5) */}
          {renderHighlightBox()}

          {/* OCR Confidence Overlay (Requirement B.6) */}
          {renderOcrConfidenceOverlay()}
        </div>
      </div>
    </div>
  )
}
