import type { KeyboardEvent, ReactNode } from "react"
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
  // Roving tabindex: only the selected tab is a Tab stop; arrow keys, Home and End move between tabs (selection follows focus).
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const keys = ["ArrowRight", "ArrowLeft", "Home", "End"]
    if (!keys.includes(e.key)) return
    const i = tabs.findIndex((t) => t.value === value)
    const next = e.key === "Home" ? 0 : e.key === "End" ? tabs.length - 1 : (i + (e.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length
    e.preventDefault()
    onChange(tabs[next].value)
    document.getElementById(`tab-${tabs[next].value}`)?.focus()
  }
  return (
    <div role="tablist" aria-label={label} onKeyDown={onKeyDown} className="-mb-px flex gap-1 overflow-x-auto border-b border-line">
      {tabs.map(({ value: v, label: l, icon: Icon }) => (
        <button
          key={v}
          role="tab"
          id={`tab-${v}`}
          aria-selected={value === v}
          aria-controls={value === v ? `panel-${v}` : undefined}
          tabIndex={value === v ? 0 : -1}
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
