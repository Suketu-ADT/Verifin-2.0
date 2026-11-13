import { Activity, BarChart3, FileSearch, FileText, Gauge, History, LayoutDashboard, Search, Settings, ShieldCheck, UserCog, UserCircle, type LucideIcon } from "lucide-react"

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  group: "Workspace" | "Insights" | "System"
  /** Role needed to see the item. */
  role?: "admin"
  /** Extra path prefixes that count as being on this item. */
  also?: string[]
}

export const NAV: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, group: "Workspace" },
  { to: "/verify", label: "New Verification", icon: FileSearch, group: "Workspace" },
  { to: "/history", label: "Verification History", icon: History, group: "Workspace", also: ["/verify/results"] },
  { to: "/review", label: "Review Queue", icon: ShieldCheck, group: "Workspace" },
  { to: "/analytics", label: "Analytics", icon: BarChart3, group: "Insights" },
  { to: "/evidence", label: "Evidence Explorer", icon: Search, group: "Insights" },
  { to: "/reports", label: "Reports", icon: FileText, group: "Insights" },
  { to: "/benchmark", label: "Benchmark", icon: Gauge, group: "Insights" },
  { to: "/system", label: "System Status", icon: Activity, group: "System" },
  { to: "/settings", label: "Settings", icon: Settings, group: "System" },
  { to: "/admin", label: "Administration", icon: UserCog, group: "System", role: "admin" },
]

/** Pages reached from the profile menu rather than the sidebar list. */
export const EXTRA_TITLES: { prefix: string; label: string; group: string; icon: LucideIcon }[] = [
  { prefix: "/account", label: "My Account", group: "System", icon: UserCircle },
]

export function isActive(item: NavItem, pathname: string): boolean {
  if (item.to === "/verify") return pathname === "/verify"
  const prefixes = [item.to, ...(item.also ?? [])]
  return prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`))
}

/** Where the current path sits, for the header breadcrumb. */
export function locate(pathname: string): { group: string; label: string } {
  const hit = NAV.find((n) => isActive(n, pathname))
  if (hit) return { group: hit.group, label: pathname.includes("/claim/") ? "Claim audit" : pathname.startsWith("/verify/results") ? "Verification results" : hit.label }
  const extra = EXTRA_TITLES.find((e) => pathname.startsWith(e.prefix))
  return extra ? { group: extra.group, label: extra.label } : { group: "Workspace", label: "VERIFIN" }
}
