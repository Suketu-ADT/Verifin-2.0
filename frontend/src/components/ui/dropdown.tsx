import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react"
import { Link } from "react-router-dom"
import { AnimatePresence, motion } from "framer-motion"
import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { DURATION, EASE } from "@/lib/motion"

interface DropdownProps {
  /** Renders the trigger; spread `props` on the button. */
  trigger: (state: { open: boolean; props: Record<string, unknown> }) => ReactNode
  children: (close: () => void) => ReactNode
  /** Where the menu opens relative to the trigger. */
  placement?: "bottom-end" | "bottom-start" | "top-start" | "top-end"
  className?: string
  menuClassName?: string
}

/** A menu that closes on outside click, Escape or selection and supports the arrow keys. */
export function Dropdown({ trigger, children, placement = "bottom-end", className, menuClassName }: DropdownProps) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const menu = useRef<HTMLDivElement>(null)
  const id = useId()
  const close = useCallback(() => setOpen(false), [])

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false) }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false)
        root.current?.querySelector<HTMLElement>("[aria-haspopup]")?.focus()
      }
    }
    document.addEventListener("mousedown", onDown)
    document.addEventListener("keydown", onKey)
    menu.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus()
    return () => {
      document.removeEventListener("mousedown", onDown)
      document.removeEventListener("keydown", onKey)
    }
  }, [open])

  const onMenuKey = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return
    e.preventDefault()
    const items = [...(menu.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])]
    const i = items.indexOf(document.activeElement as HTMLElement)
    const next = e.key === "ArrowDown" ? (i + 1) % items.length : (i - 1 + items.length) % items.length
    items[next]?.focus()
  }

  const up = placement.startsWith("top")
  const end = placement.endsWith("end")
  return (
    <div ref={root} className={cn("relative", className)}>
      {trigger({ open, props: { "aria-haspopup": "menu", "aria-expanded": open, "aria-controls": open ? id : undefined, onClick: () => setOpen((v) => !v) } })}
      <AnimatePresence>
        {open && (
          <motion.div
            ref={menu}
            id={id}
            role="menu"
            onKeyDown={onMenuKey}
            initial={{ opacity: 0, y: up ? 6 : -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: up ? 4 : -4, scale: 0.98 }}
            transition={{ duration: DURATION.fast, ease: EASE }}
            className={cn(
              "absolute z-50 min-w-52 rounded-lg border border-line bg-surface p-1 text-ink shadow-lg",
              up ? "bottom-full mb-2" : "top-full mt-2", end ? "right-0 origin-top-right" : "left-0 origin-top-left", menuClassName,
            )}
          >
            {children(close)}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

interface ItemProps {
  icon?: LucideIcon
  children: ReactNode
  onSelect?: () => void
  to?: string
  danger?: boolean
  close?: () => void
}

const itemClass = (danger?: boolean) =>
  cn("flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[13px] outline-none transition-colors hover:bg-subtle focus-visible:bg-subtle [&_svg]:size-4", danger ? "text-contradicted-fg" : "text-ink [&_svg]:text-muted")

export function DropdownItem({ icon: Icon, children, onSelect, to, danger, close }: ItemProps) {
  const content = <>{Icon && <Icon aria-hidden="true" />}{children}</>
  if (to) {
    return <Link to={to} role="menuitem" className={itemClass(danger)} onClick={() => close?.()}>{content}</Link>
  }
  return (
    <button type="button" role="menuitem" className={itemClass(danger)} onClick={() => { onSelect?.(); close?.() }}>
      {content}
    </button>
  )
}

export function DropdownLabel({ children }: { children: ReactNode }) {
  return <div className="px-2.5 py-1.5 text-xs text-muted">{children}</div>
}

export function DropdownSeparator() {
  return <div className="my-1 h-px bg-line" role="separator" />
}
