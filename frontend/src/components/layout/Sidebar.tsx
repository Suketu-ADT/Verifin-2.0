import { useEffect, useRef } from "react"
import { Link, useLocation, useNavigate } from "react-router-dom"
import { ChevronsUpDown, LogOut, PanelLeftClose, PanelLeftOpen, Settings, ShieldCheck, UserCircle, X } from "lucide-react"
import { Dropdown, DropdownItem, DropdownLabel, DropdownSeparator } from "@/components/ui/dropdown"
import { cn } from "@/lib/utils"
import { initials } from "@/lib/format"
import { useAuth } from "@/lib/AuthContext"
import { NAV, isActive } from "./nav"

interface SidebarProps {
  collapsed: boolean
  onToggleCollapsed: () => void
  /** Drawer state on screens below the lg breakpoint. */
  drawerOpen: boolean
  onCloseDrawer: () => void
  isDesktop: boolean
}

function Brand({ collapsed }: { collapsed: boolean }) {
  return (
    <Link to="/dashboard" className="flex min-w-0 items-center gap-3 rounded-md outline-offset-4" aria-label="VERIFIN home">
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-brand-2 to-brand ring-1 ring-white/15">
        <ShieldCheck className="size-5 text-white" aria-hidden="true" />
      </span>
      {!collapsed && (
        <span className="min-w-0 leading-tight">
          <span className="block text-[15px] font-semibold tracking-[0.04em] text-white">VERIFIN <span className="font-normal text-white/50">2.0</span></span>
          <span className="block truncate text-[11px] text-white/50">Evidence-based verification</span>
        </span>
      )}
    </Link>
  )
}

export function Sidebar({ collapsed, onToggleCollapsed, drawerOpen, onCloseDrawer, isDesktop }: SidebarProps) {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { user, authDisabled, logout } = useAuth()
  // inside the drawer the labels always show; the collapsed rail only exists on desktop
  const rail = collapsed && isDesktop

  const closeButton = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (!isDesktop && drawerOpen) {
      // focus moves into the drawer while it is open and returns to the menu button after
      const opener = document.activeElement as HTMLElement | null
      const focusTimer = window.setTimeout(() => closeButton.current?.focus(), 0)
      const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCloseDrawer()
      document.addEventListener("keydown", onKey)
      return () => {
        window.clearTimeout(focusTimer)
        document.removeEventListener("keydown", onKey)
        opener?.focus?.()
      }
    }
  }, [isDesktop, drawerOpen, onCloseDrawer])

  const items = NAV.filter((n) => !n.role || user?.role === n.role)
  const groups = [...new Set(items.map((i) => i.group))]
  const displayName = authDisabled ? "Local mode" : user?.name || user?.email || "Account"

  return (
    <>
      {!isDesktop && drawerOpen && <div className="fixed inset-0 z-40 bg-navy/60 animate-fade-in" onClick={onCloseDrawer} aria-hidden="true" />}
      <aside
        aria-label="Primary"
        inert={!isDesktop && !drawerOpen}
        className={cn(
          "on-navy flex h-dvh flex-col bg-navy text-white transition-[width,transform] duration-200 ease-out",
          isDesktop
            ? cn("sticky top-0 z-40 shrink-0", rail ? "w-[72px]" : "w-64")
            : cn("fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] shadow-lg", drawerOpen ? "translate-x-0" : "-translate-x-full"),
        )}
      >
        <div className={cn("flex h-16 shrink-0 items-center border-b border-navy-line", rail ? "justify-center px-2" : "justify-between px-4")}>
          <Brand collapsed={rail} />
          {!isDesktop && (
            <button ref={closeButton} type="button" onClick={onCloseDrawer} className="rounded-md p-2 text-white/70 hover:bg-white/10 hover:text-white" aria-label="Close navigation">
              <X className="size-5" />
            </button>
          )}
        </div>

        <nav className="min-h-0 flex-1 overflow-y-auto px-3 py-4" aria-label="Main">
          {groups.map((group, gi) => (
            <div key={group} className={cn(gi > 0 && "mt-5")}>
              {rail ? (
                gi > 0 && <div className="mx-2 mb-3 h-px bg-navy-line" role="separator" />
              ) : (
                <div className="px-3 pb-1.5 text-[11px] font-medium uppercase tracking-[0.08em] text-white/40">{group}</div>
              )}
              <ul className="space-y-0.5">
                {items.filter((i) => i.group === group).map((item) => {
                  const active = isActive(item, pathname)
                  return (
                    <li key={item.to}>
                      <Link
                        to={item.to}
                        onClick={onCloseDrawer}
                        aria-current={active ? "page" : undefined}
                        title={rail ? item.label : undefined}
                        className={cn(
                          "group relative flex h-10 items-center gap-3 rounded-md text-[13.5px] font-medium transition-[background-color,color] duration-[var(--motion-fast)] ease-[var(--ease-out-soft)] active:bg-white/[0.14]",
                          rail ? "justify-center px-0" : "px-3",
                          active ? "bg-white/10 text-white" : "text-white/65 hover:bg-white/[0.06] hover:text-white",
                        )}
                      >
                        {active && <span className="animate-fade-in absolute inset-y-2 left-0 w-[3px] rounded-r-full bg-sky" aria-hidden="true" />}
                        <item.icon className={cn("size-[18px] shrink-0 transition-colors duration-[var(--motion-fast)]", active ? "text-sky" : "text-white/55 group-hover:text-white/90")} strokeWidth={1.75} aria-hidden="true" />
                        {rail ? <span className="sr-only">{item.label}</span> : <span className="truncate">{item.label}</span>}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className="shrink-0 space-y-1 border-t border-navy-line p-3">
          {isDesktop && (
            <button
              type="button"
              onClick={onToggleCollapsed}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              aria-pressed={collapsed}
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              className={cn("flex h-9 w-full items-center gap-3 rounded-md text-[13px] text-white/55 transition-colors hover:bg-white/[0.06] hover:text-white", rail ? "justify-center" : "px-3")}
            >
              {collapsed ? <PanelLeftOpen className="size-[18px]" strokeWidth={1.75} /> : <PanelLeftClose className="size-[18px]" strokeWidth={1.75} />}
              {!rail && "Collapse"}
            </button>
          )}
          {user && (
            <Dropdown
              placement="top-start"
              className="w-full"
              menuClassName={cn("w-60", rail && "left-0")}
              trigger={({ props }) => (
                <button
                  type="button"
                  {...props}
                  className={cn("flex w-full items-center gap-3 rounded-md p-2 text-left transition-colors hover:bg-white/[0.06]", rail && "justify-center")}
                  aria-label={`Account menu for ${displayName}`}
                >
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-brand-2 text-xs font-semibold text-white ring-1 ring-white/20">{initials(user.name || user.email)}</span>
                  {!rail && (
                    <>
                      <span className="min-w-0 flex-1 leading-tight">
                        <span className="block truncate text-[13px] font-medium text-white">{displayName}</span>
                        <span className="block truncate text-[11px] capitalize text-white/50">{authDisabled ? "Authentication off" : user.role}</span>
                      </span>
                      <ChevronsUpDown className="size-4 shrink-0 text-white/40" aria-hidden="true" />
                    </>
                  )}
                </button>
              )}
            >
              {(close) => (
                <>
                  <DropdownLabel>
                    <span className="block truncate text-[13px] font-medium text-ink">{displayName}</span>
                    {!authDisabled && <span className="block truncate">{user.email}</span>}
                  </DropdownLabel>
                  <DropdownSeparator />
                  {!authDisabled && <DropdownItem icon={UserCircle} to="/account" close={() => { close(); onCloseDrawer() }}>My account</DropdownItem>}
                  <DropdownItem icon={Settings} to="/settings" close={() => { close(); onCloseDrawer() }}>Settings</DropdownItem>
                  {!authDisabled && (
                    <>
                      <DropdownSeparator />
                      <DropdownItem icon={LogOut} danger close={close} onSelect={() => { logout(); navigate("/login") }}>Sign out</DropdownItem>
                    </>
                  )}
                </>
              )}
            </Dropdown>
          )}
        </div>
      </aside>
    </>
  )
}
