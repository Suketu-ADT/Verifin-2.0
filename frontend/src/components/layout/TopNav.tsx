import { Bell, Search, User, Menu, Cpu, Sparkles, Command } from "lucide-react"
import { useLocation, useNavigate } from "react-router-dom"
import { LogOut } from "lucide-react"
import { useAuth } from "../../lib/AuthContext"

interface TopNavProps {
  onMenuClick: () => void
}

export default function TopNav({ onMenuClick }: TopNavProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, authDisabled, logout } = useAuth()
  const path = location.pathname

  const getBreadcrumb = () => {
    if (path.startsWith("/verify/results")) return "Verification Audit"
    if (path.startsWith("/verify")) return "New Verification"
    if (path.startsWith("/review")) return "Human-in-the-Loop Review"
    if (path.startsWith("/evidence")) return "Evidence Explorer"
    if (path.startsWith("/history")) return "Verification Log"
    if (path.startsWith("/reports")) return "Audit Reports"
    if (path.startsWith("/system")) return "System Infrastructure"
    if (path.startsWith("/settings")) return "Configuration"
    if (path.startsWith("/admin")) return "Administration"
    return "Intelligence Overview"
  }

  return (
    <div className="p-3 pb-0">
      <header className="h-16 glass-strong rounded-2xl flex items-center justify-between px-4 md:px-6 shrink-0 border border-white/10">
        <div className="flex items-center space-x-3">
          <button
            className="lg:hidden p-2 text-slate-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
            onClick={onMenuClick}
            aria-label="Toggle navigation"
          >
            <Menu className="h-5 w-5" />
          </button>

          {/* Breadcrumb & Section indicator */}
          <div className="flex items-center gap-2 text-xs font-semibold">
            <span className="text-slate-400 hidden sm:inline">VERIFIN 2.0</span>
            <span className="text-slate-400 hidden sm:inline">/</span>
            <span className="text-white font-bold tracking-tight">{getBreadcrumb()}</span>
          </div>
        </div>

        <div className="flex items-center space-x-3.5">
          {/* Engine Status Pill */}
          <div className="hidden xl:flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-400/20 text-[11px] font-mono text-indigo-300">
            <Cpu className="h-3.5 w-3.5 text-indigo-400" />
            <span>Dual-RAG: BM25 + Dense Active</span>
          </div>

          {/* Quick Search */}
          <div className="relative hidden md:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search claims & evidence..."
              className="h-9 w-60 lg:w-72 rounded-full border border-white/10 bg-black/30 pl-9 pr-9 text-xs text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400/40 focus:border-amber-400/40 transition-all font-sans"
            />
            <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-0.5 text-[10px] font-mono text-slate-400 bg-white/5 px-1.5 py-0.5 rounded border border-white/5">
              <span>⌘K</span>
            </div>
          </div>

          {/* Notifications */}
          <button 
            className="relative p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-full transition-colors"
            title="System alerts"
          >
            <Bell className="h-4 w-4" />
            <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-amber-400 ring-2 ring-[#0f121c]" />
          </button>

          {/* User profile */}
          <div className="flex items-center gap-2 pl-1 border-l border-white/10">
            <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-amber-400/20 to-indigo-500/20 border border-white/15 flex items-center justify-center">
              <User className="h-4 w-4 text-amber-300" />
            </div>
            {user && (
              <div className="hidden md:block leading-tight max-w-[10rem]">
                <div className="truncate text-xs font-semibold text-white">{authDisabled ? "Local mode" : user.name || user.email}</div>
                <div className="text-[10px] uppercase tracking-wide text-slate-400">{authDisabled ? "auth off" : user.role}</div>
              </div>
            )}
            {user && !authDisabled && (
              <button
                onClick={() => { logout(); navigate("/login") }}
                className="p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-full transition-colors"
                title="Sign out"
                aria-label="Sign out"
              >
                <LogOut className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </header>
    </div>
  )
}

