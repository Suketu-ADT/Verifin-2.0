import { Link, useLocation } from "react-router-dom"
import { ChevronRight, Menu, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useSystemHealth, type HealthState } from "@/lib/hooks"
import { locate } from "./nav"

const STATUS: Record<HealthState["state"], { label: string; dot: string; text: string }> = {
  checking: { label: "Checking engine", dot: "bg-faint", text: "text-muted" },
  ok: { label: "Engine operational", dot: "bg-supported", text: "text-ink" },
  degraded: { label: "Engine degraded", dot: "bg-unverifiable", text: "text-unverifiable-fg" },
  offline: { label: "Engine unreachable", dot: "bg-contradicted", text: "text-contradicted-fg" },
}

/** The live engine status. Real data from /system/health; it says "checking" until the first answer rather than assuming. */
export function EngineStatus({ className }: { className?: string }) {
  const health = useSystemHealth()
  const s = STATUS[health.state]
  const fallback = health.state !== "checking" && health.state !== "offline" && health.health.services.database === "fallback"
  return (
    <Link
      to="/system"
      className={cn("inline-flex h-8 items-center gap-2 rounded-full border border-line bg-surface px-3 text-xs font-medium transition-colors hover:bg-subtle", s.text, className)}
      title={fallback ? "Running on the local fallback database" : "Open System Status"}
    >
      <span className={cn("size-2 rounded-full", s.dot)} aria-hidden="true" />
      {s.label}
      {fallback && <span className="text-muted">· local data</span>}
    </Link>
  )
}

export function Header({ onMenu, showMenu }: { onMenu: () => void; showMenu: boolean }) {
  const { pathname } = useLocation()
  const here = locate(pathname)
  return (
    <header className="app-header sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-line bg-surface/90 px-4 backdrop-blur sm:px-6 lg:px-8">
      <div className="flex min-w-0 items-center gap-3">
        {showMenu && (
          <Button variant="ghost" size="icon" onClick={onMenu} aria-label="Open navigation" className="-ml-2"><Menu /></Button>
        )}
        <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-[13px]">
          <span className="hidden text-muted sm:inline">{here.group}</span>
          <ChevronRight className="hidden size-3.5 text-faint sm:inline" aria-hidden="true" />
          <span className="truncate font-medium text-ink" aria-current="page">{here.label}</span>
        </nav>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <EngineStatus className="hidden md:inline-flex" />
        {pathname !== "/verify" && (
          <Link to="/verify" className="no-print">
            <Button variant="primary" size="sm"><Plus /> <span className="hidden sm:inline">New verification</span><span className="sm:hidden">New</span></Button>
          </Link>
        )}
      </div>
    </header>
  )
}
