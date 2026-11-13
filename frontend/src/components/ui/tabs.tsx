import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

interface Option<T extends string> {
  value: T
  label: ReactNode
  count?: number
}

/** A segmented control for switching a view or filter (pressed buttons, so it works without panels). */
export function Segmented<T extends string>({ value, onChange, options, label, className, size = "md" }: {
  value: T
  onChange: (v: T) => void
  options: Option<T>[]
  label: string
  className?: string
  size?: "sm" | "md"
}) {
  return (
    <div role="group" aria-label={label} className={cn("inline-flex max-w-full items-center gap-0.5 overflow-x-auto rounded-md border border-line bg-subtle p-0.5", className)}>
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-[5px] font-medium transition-[background-color,color,box-shadow] duration-[var(--motion-fast)] ease-[var(--ease-out-soft)]",
              size === "sm" ? "h-7 px-2.5 text-xs" : "h-8 px-3 text-[13px]",
              active ? "bg-surface text-ink shadow-xs" : "text-muted hover:text-ink",
            )}
          >
            {o.label}
            {o.count !== undefined && <span className={cn("num text-xs", active ? "text-muted" : "text-muted/80")}>{o.count}</span>}
          </button>
        )
      })}
    </div>
  )
}

/** Underlined tabs with real tab semantics, for page sections such as Administration. */
export function Tabs<T extends string>({ value, onChange, tabs, label }: {
  value: T
  onChange: (v: T) => void
  tabs: { value: T; label: string; icon?: React.ComponentType<{ className?: string }> }[]
  label: string
}) {
  return (
    <div role="tablist" aria-label={label} className="-mb-px flex gap-1 overflow-x-auto border-b border-line">
      {tabs.map(({ value: v, label: l, icon: Icon }) => (
        <button
          key={v}
          role="tab"
          id={`tab-${v}`}
          aria-selected={value === v}
          aria-controls={`panel-${v}`}
          onClick={() => onChange(v)}
          className={cn(
            "inline-flex shrink-0 items-center gap-2 border-b-2 px-4 py-2.5 text-[13px] font-medium transition-colors",
            value === v ? "border-brand text-ink" : "border-transparent text-muted hover:border-line-strong hover:text-ink",
          )}
        >
          {Icon && <Icon className="size-4" />}
          {l}
        </button>
      ))}
    </div>
  )
}
