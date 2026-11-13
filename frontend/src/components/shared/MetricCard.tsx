import type { ReactNode } from "react"
import { Link } from "react-router-dom"
import type { LucideIcon } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import type { Verdict } from "@/lib/verdict"
import { VERDICTS } from "@/lib/verdict"

interface MetricCardProps {
  label: string
  value: ReactNode
  /** Supporting line under the value. */
  hint?: ReactNode
  icon?: LucideIcon
  /** Colours the icon chip with a verdict colour, for the supported / contradicted / unverifiable counts. */
  verdict?: Verdict
  /** "usage" counts what people ran; "performance" is a recorded model benchmark and is marked as such. */
  kind?: "usage" | "performance"
  loading?: boolean
  to?: string
  className?: string
}

export function MetricCard({ label, value, hint, icon: Icon, verdict, kind = "usage", loading, to, className }: MetricCardProps) {
  const v = verdict ? VERDICTS[verdict] : null
  const body = (
    <Card
      interactive={!!to}
      className={cn("relative h-full p-4", kind === "performance" && "border-l-[3px] border-l-brand-2", className)}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="text-[13px] font-medium text-muted">{label}</div>
        {Icon && (
          <span className={cn("grid size-8 shrink-0 place-items-center rounded-md border", v ? `${v.tint} ${v.border} ${v.text}` : "border-line bg-subtle text-muted")}>
            <Icon className="size-4" aria-hidden="true" />
          </span>
        )}
      </div>
      {loading ? (
        <Skeleton className="mt-2 h-8 w-24" />
      ) : (
        <div className="num animate-fade-in mt-1.5 text-[28px] font-semibold leading-tight tracking-tight text-ink">{value}</div>
      )}
      {hint && !loading && <div className="mt-1.5 text-xs text-muted">{hint}</div>}
      {kind === "performance" && <div className="mt-2 inline-block rounded-sm bg-brand-tint px-1.5 py-0.5 text-[11px] font-medium text-brand">Recorded benchmark</div>}
    </Card>
  )
  return to ? <Link to={to} className="block rounded-lg">{body}</Link> : body
}
