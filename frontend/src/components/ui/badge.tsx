import type { ComponentProps } from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

/**
 * General-purpose chip. Verdicts have their own StatusBadge (icon + label from lib/verdict); `neutral` here is for plain facts
 * such as "Page 12" or "Hybrid", `brand` for product accents, and the three status tones exist for non-verdict states
 * (for example "Healthy" / "Degraded") that must still follow the colour meanings.
 */
const badgeVariants = cva("inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-md border px-2 py-0.5 text-xs font-medium [&_svg]:size-3", {
  variants: {
    tone: {
      neutral: "border-neutral-line bg-neutral-tint text-neutral-fg",
      outline: "border-line-strong bg-surface text-neutral-fg",
      brand: "border-brand/15 bg-brand-tint text-brand",
      success: "border-supported-line bg-supported-tint text-supported-fg",
      danger: "border-contradicted-line bg-contradicted-tint text-contradicted-fg",
      warning: "border-unverifiable-line bg-unverifiable-tint text-unverifiable-fg",
    },
  },
  defaultVariants: { tone: "neutral" },
})

export function Badge({ className, tone, ...props }: ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />
}
