import type { ReactNode } from "react"
import { AlertCircle, AlertTriangle, CheckCircle2, FileSearch, Info, RefreshCw, type LucideIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface EmptyStateProps {
  icon?: LucideIcon
  title?: string
  message?: ReactNode
  actionLabel?: string
  onAction?: () => void
  className?: string
  /** Drops the card frame, for use inside a table or panel that already has one. */
  bare?: boolean
}

export function EmptyState({ icon: Icon = FileSearch, title = "Nothing here yet", message, actionLabel, onAction, className, bare }: EmptyStateProps) {
  const body = (
    <div className={cn("mx-auto flex max-w-md flex-col items-center px-6 py-12 text-center", className)}>
      <span className="mb-4 grid size-11 place-items-center rounded-lg border border-line bg-subtle text-muted">
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <h3 className="text-[15px] font-semibold text-ink">{title}</h3>
      {message && <p className="mt-1.5 text-[13px] leading-relaxed text-muted">{message}</p>}
      {actionLabel && onAction && <Button variant="primary" className="mt-5" onClick={onAction}>{actionLabel}</Button>}
    </div>
  )
  return bare ? body : <Card>{body}</Card>
}

interface ErrorStateProps {
  title?: string
  message?: ReactNode
  onRetry?: () => void
  className?: string
  bare?: boolean
}

export function ErrorState({ title = "Something went wrong", message = "An error occurred while loading this. Please try again.", onRetry, className, bare }: ErrorStateProps) {
  const body = (
    <div role="alert" className={cn("mx-auto flex max-w-md flex-col items-center px-6 py-12 text-center", className)}>
      <span className="mb-4 grid size-11 place-items-center rounded-lg border border-contradicted-line bg-contradicted-tint text-contradicted-fg">
        <AlertCircle className="size-5" aria-hidden="true" />
      </span>
      <h3 className="text-[15px] font-semibold text-ink">{title}</h3>
      <p className="mt-1.5 text-[13px] leading-relaxed text-muted">{message}</p>
      {onRetry && <Button className="mt-5" onClick={onRetry}><RefreshCw /> Try again</Button>}
    </div>
  )
  return bare ? body : <Card>{body}</Card>
}

type NoticeTone = "info" | "success" | "warning" | "error"
const NOTICE: Record<NoticeTone, { Icon: LucideIcon; box: string }> = {
  info: { Icon: Info, box: "border-line bg-surface text-ink [&_svg]:text-brand-2" },
  success: { Icon: CheckCircle2, box: "border-supported-line bg-supported-tint text-ink [&_svg]:text-supported" },
  warning: { Icon: AlertTriangle, box: "border-unverifiable-line bg-unverifiable-tint text-ink [&_svg]:text-unverifiable" },
  error: { Icon: AlertCircle, box: "border-contradicted-line bg-contradicted-tint text-ink [&_svg]:text-contradicted" },
}

/** An inline message banner. Errors are announced to screen readers. */
export function Notice({ tone = "info", title, children, action, className }: { tone?: NoticeTone; title?: string; children?: ReactNode; action?: ReactNode; className?: string }) {
  const { Icon, box } = NOTICE[tone]
  return (
    <div role={tone === "error" ? "alert" : "status"} className={cn("flex items-start gap-3 rounded-lg border p-3.5 text-[13px] leading-relaxed", box, className)}>
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        {title && <div className="font-medium">{title}</div>}
        {children && <div className={cn(title && "mt-0.5 text-muted")}>{children}</div>}
      </div>
      {action}
    </div>
  )
}
