import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

/**
 * Smooth expand and collapse without measuring heights: a one-row grid whose row animates between 0fr and 1fr.
 * The content stays mounted, so state inside it survives, and `inert` keeps collapsed content out of the tab order and the
 * accessibility tree. Under prefers-reduced-motion the transition becomes instant (see index.css).
 */
export function Collapse({ open, children, id, className }: { open: boolean; children: ReactNode; id?: string; className?: string }) {
  return (
    <div id={id} className={cn("collapse-rows grid", open ? "grid-rows-[1fr]" : "grid-rows-[0fr]", className)}>
      <div className="min-h-0 overflow-hidden" inert={!open}>
        {children}
      </div>
    </div>
  )
}
