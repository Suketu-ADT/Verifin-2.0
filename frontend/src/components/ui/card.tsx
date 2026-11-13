import type { ComponentProps, ReactNode } from "react"
import { cn } from "@/lib/utils"

/** The one surface: white, thin neutral border, restrained shadow. `interactive` adds the hover lift for clickable cards. */
export function Card({ className, interactive, ...props }: ComponentProps<"div"> & { interactive?: boolean }) {
  return (
    <div
      className={cn(
        "min-w-0 rounded-lg border border-line bg-surface shadow-xs",
        interactive && "transition-[box-shadow,border-color,transform] duration-[var(--motion-base)] ease-[var(--ease-out-soft)] hover:-translate-y-px hover:border-line-strong hover:shadow-md active:translate-y-0 active:shadow-sm",
        className,
      )}
      {...props}
    />
  )
}

export function CardHeader({ title, description, action, className }: { title: ReactNode; description?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4", className)}>
      <div className="min-w-0">
        <h2 className="text-[15px] font-semibold tracking-tight text-ink">{title}</h2>
        {description && <p className="mt-0.5 text-[13px] text-muted">{description}</p>}
      </div>
      {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
    </div>
  )
}

export function CardBody({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("p-5", className)} {...props} />
}

export function CardFooter({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("flex items-center gap-3 rounded-b-lg border-t border-line bg-canvas px-5 py-3", className)} {...props} />
}

/** A labelled section for settings-style pages: title and help on the side, content on the right. */
export function Section({ title, description, children, className }: { title: string; description?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("grid gap-4 py-6 first:pt-0 lg:grid-cols-[minmax(0,260px)_1fr] lg:gap-10", className)}>
      <div>
        <h2 className="text-[15px] font-semibold tracking-tight text-ink">{title}</h2>
        {description && <p className="mt-1 text-[13px] leading-relaxed text-muted">{description}</p>}
      </div>
      <Card className="min-w-0 p-5">{children}</Card>
    </section>
  )
}

/** One "label … value" row inside a Section or card. */
export function DetailRow({ label, hint, children }: { label: ReactNode; hint?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b border-line py-2.5 first:pt-0 last:border-0 last:pb-0">
      <div className="min-w-0">
        <div className="text-[13px] font-medium text-ink">{label}</div>
        {hint && <div className="text-xs text-muted">{hint}</div>}
      </div>
      <div className="num min-w-0 break-words text-right text-[13px] text-ink">{children}</div>
    </div>
  )
}
