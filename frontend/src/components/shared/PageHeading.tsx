import type { ReactNode } from "react"
import { Link } from "react-router-dom"
import { ArrowLeft } from "lucide-react"

interface PageHeadingProps {
  title: ReactNode
  subtitle?: ReactNode
  /** Page-level actions, aligned right on wide screens and wrapped under the title on narrow ones. */
  actions?: ReactNode
  back?: { to: string; label: string }
  /** A row of chips or facts under the subtitle. */
  meta?: ReactNode
}

export function PageHeading({ title, subtitle, actions, back, meta }: PageHeadingProps) {
  return (
    <div className="mb-6 space-y-3">
      {back && (
        <Link to={back.to} className="inline-flex items-center gap-1.5 rounded-md text-[13px] font-medium text-muted transition-colors hover:text-ink">
          <ArrowLeft className="size-3.5" aria-hidden="true" /> {back.label}
        </Link>
      )}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-ink">{title}</h1>
          {subtitle && <p className="mt-1 max-w-3xl text-sm leading-relaxed text-muted">{subtitle}</p>}
        </div>
        {actions && <div className="no-print flex flex-wrap items-center gap-2 sm:shrink-0 sm:justify-end">{actions}</div>}
      </div>
      {meta && <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px] text-muted">{meta}</div>}
    </div>
  )
}
