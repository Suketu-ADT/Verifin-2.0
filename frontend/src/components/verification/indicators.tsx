import { cn } from "@/lib/utils"
import { normalizeRisk, riskMeta, verdictMeta, VERDICTS } from "@/lib/verdict"
import { percent } from "@/lib/format"

/**
 * StatusBadge: a verdict is always an icon, a text label and a tinted chip, never colour alone.
 */
export function StatusBadge({ status, size = "md", iconOnly, className }: { status?: string | null; size?: "sm" | "md" | "lg"; iconOnly?: boolean; className?: string }) {
  const v = verdictMeta(status)
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md border font-medium",
        v.chip,
        size === "sm" && "px-1.5 py-0.5 text-xs [&_svg]:size-3",
        size === "md" && "px-2 py-0.5 text-[13px] [&_svg]:size-3.5",
        size === "lg" && "px-3 py-1.5 text-sm [&_svg]:size-4",
        className,
      )}
      title={v.meaning}
    >
      <v.Icon aria-hidden="true" />
      {iconOnly ? <span className="sr-only">{v.label}</span> : v.label}
    </span>
  )
}

/**
 * RiskIndicator: a three-segment meter in a single navy hue, with the level in words. It deliberately does not use the verdict
 * colours, so "high risk" can never be mistaken for "contradicted".
 */
export function RiskIndicator({ level, score, size = "md", showLabel = true, className }: { level?: string | null; score?: number | null; size?: "sm" | "md" | "lg"; showLabel?: boolean; className?: string }) {
  const r = riskMeta(level)
  const key = normalizeRisk(level)
  return (
    <span className={cn("inline-flex max-w-full flex-wrap items-center gap-x-2 gap-y-1", className)} title={`${r.label}: ${r.meaning}`}>
      <span className="inline-flex items-center gap-[3px]" aria-hidden="true">
        {[1, 2, 3].map((i) => (
          <span
            key={i}
            className={cn("rounded-full", size === "lg" ? "h-2 w-5" : size === "sm" ? "h-1.5 w-3" : "h-1.5 w-4")}
            style={{ backgroundColor: i <= r.level ? r.color : "#e2e8f0" }}
          />
        ))}
      </span>
      {showLabel && (
        <span className={cn("inline-flex items-center gap-1 whitespace-nowrap font-medium", size === "lg" ? "text-sm" : "text-[13px]", r.text, key === "HIGH" && "font-semibold")}>
          <r.Icon className={size === "lg" ? "size-4" : "size-3.5"} aria-hidden="true" />
          {r.label}
          {score != null && <span className="num font-normal text-muted">({score.toFixed(2)})</span>}
        </span>
      )}
      {!showLabel && <span className="sr-only">{r.label}</span>}
    </span>
  )
}

/**
 * ConfidenceIndicator: a thin neutral bar with the figure beside it. Neutral on purpose: confidence says how sure the model is,
 * not whether the claim is right, so it must not borrow a verdict colour.
 */
export function ConfidenceIndicator({ value, label, className, width = "w-16" }: { value?: number | null; label?: string; className?: string; width?: string }) {
  if (value == null) return <span className={cn("text-[13px] text-muted", className)}>Not recorded</span>
  const pct = Math.max(0, Math.min(1, value))
  return (
    <span className={cn("inline-flex items-center gap-2", className)} title={label ? `${label}: ${percent(pct, 1)}` : undefined}>
      <span className={cn("h-1.5 overflow-hidden rounded-full bg-line", width)} role="presentation">
        <span className="block h-full rounded-full bg-brand-2 transition-[width] duration-[var(--motion-slow)] ease-[var(--ease-out-soft)]" style={{ width: `${pct * 100}%` }} />
      </span>
      <span className="num text-[13px] font-medium text-ink">{Math.round(pct * 100)}%</span>
      {label && <span className="sr-only">{label}</span>}
    </span>
  )
}

/** The model's three probabilities for one claim against its evidence. Colours follow the status meanings; neutral is slate. */
export function NliBar({ nli, className }: { nli: { entailment: number; neutral: number; contradiction: number }; className?: string }) {
  const parts = [
    { key: "entailment", label: "Entailment", note: "evidence supports the claim", value: nli.entailment, bar: VERDICTS.SUPPORTED.bar, dot: "bg-supported" },
    { key: "neutral", label: "Neutral", note: "evidence does not settle it", value: nli.neutral, bar: "bg-neutral", dot: "bg-neutral" },
    { key: "contradiction", label: "Contradiction", note: "evidence conflicts with the claim", value: nli.contradiction, bar: VERDICTS.CONTRADICTED.bar, dot: "bg-contradicted" },
  ]
  return (
    <div className={className}>
      <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-full bg-line" role="img" aria-label={parts.map((p) => `${p.label} ${(p.value * 100).toFixed(1)} percent`).join(", ")}>
        {parts.map((p) => (
          <div key={p.key} className={cn("h-full transition-[width] duration-[var(--motion-slow)] ease-[var(--ease-out-soft)]", p.bar)} style={{ width: `${p.value * 100}%` }} title={`${p.label} ${(p.value * 100).toFixed(1)}%`} />
        ))}
      </div>
      <dl className="mt-2.5 grid grid-cols-3 gap-2">
        {parts.map((p) => (
          <div key={p.key} className="min-w-0">
            <dt className="flex items-center gap-1.5 text-xs text-muted">
              <span className={cn("size-2 shrink-0 rounded-sm", p.dot)} aria-hidden="true" />
              <span className="truncate">{p.label}</span>
            </dt>
            <dd className="num text-sm font-semibold text-ink">{(p.value * 100).toFixed(1)}%</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
