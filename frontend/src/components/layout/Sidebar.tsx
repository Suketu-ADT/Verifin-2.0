import { motion } from "framer-motion"
import { Link, useLocation } from "react-router-dom"
import { 
  FileSearch, History, Search, Activity, Settings, FileText,
  LayoutDashboard, BarChart3, Gauge, X, ShieldCheck, Shield, Sparkles, Layers, UserCog, UserCircle,
} from "lucide-react"
import { useAuth } from "../../lib/AuthContext"

interface SidebarProps {
  isOpen: boolean
  onClose: () => void
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const location = useLocation()
  const { user } = useAuth()

  const navItems = [
    { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { name: "New Verification", href: "/verify", icon: FileSearch, badge: "Hybrid RAG", badgeColor: "bg-indigo-500/15 text-indigo-300 border-indigo-400/30" },
    { name: "Review Queue", href: "/review", icon: ShieldCheck },
    { name: "Evidence Explorer", href: "/evidence", icon: Search },
    { name: "History", href: "/history", icon: History },
    { name: "Analytics", href: "/analytics", icon: BarChart3 },
    { name: "Benchmark", href: "/benchmark", icon: Gauge },
    { name: "Reports", href: "/reports", icon: FileText },
    { name: "System Status", href: "/system", icon: Activity },
    { name: "Settings", href: "/settings", icon: Settings },
    ...(user && user.id !== "anonymous" ? [{ name: "My Account", href: "/account", icon: UserCircle }] : []),
    ...(user?.role === "admin" ? [{ name: "Administration", href: "/admin", icon: UserCog }] : []),
  ]

  return (
    <div className={`fixed lg:static inset-y-0 left-0 z-50 h-full p-3 transform transition-transform duration-200 ease-in-out ${isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>
      <div className="w-72 glass-strong rounded-2xl flex flex-col h-full overflow-hidden border border-white/10 shadow-2xl">
        {/* Brand header */}
        <div className="p-5 border-b border-white/8 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3 group">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-[0_0_20px_rgba(245,158,11,0.35)] group-hover:shadow-[0_0_25px_rgba(245,158,11,0.5)] transition-all">
              <Shield className="h-5 w-5 text-neutral-950 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-lg font-black tracking-tight text-white group-hover:text-amber-300 transition-colors">
                  VERIFIN
                </span>
                <span className="text-[10px] font-bold font-mono px-1.5 py-0.2 rounded bg-amber-400/20 text-amber-300 border border-amber-400/30">
                  2.0
                </span>
              </div>
              <p className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">
                Hallucination Guard
              </p>
            </div>
          </Link>
          <button
            className="lg:hidden p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/5"
            onClick={onClose}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation list */}
        <nav className="flex-1 p-3.5 space-y-1 overflow-y-auto">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-3 py-1.5">
            Core Verification
          </div>
          {navItems.map((item) => {
            const isActive = location.pathname === item.href || 
              (item.href !== "/dashboard" && location.pathname.startsWith(item.href))
            return (
              <Link
                key={item.name}
                to={item.href}
                onClick={onClose}
                className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl transition-all text-xs font-semibold relative overflow-hidden group ${
                  isActive
                    ? "text-white bg-white/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_4px_12px_rgba(0,0,0,0.4)]"
                    : "text-slate-400 hover:text-white hover:bg-white/[0.04]"
                }`}
              >
                {isActive && (
                  <motion.div 
                    layoutId="activeNavIndicator"
                    className="absolute left-0 top-1 bottom-1 w-1 bg-gradient-to-b from-amber-400 to-amber-500 rounded-r-full shadow-[0_0_10px_#f59e0b]"
                    transition={{ type: "spring", stiffness: 350, damping: 30 }}
                  />
                )}
                <div className="flex items-center space-x-3 relative z-10">
                  <item.icon className={`h-4 w-4 transition-colors ${isActive ? "text-amber-400" : "text-slate-400 group-hover:text-slate-200"}`} />
                  <span className="relative z-10">{item.name}</span>
                </div>
                {item.badge && (
                  <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border ${item.badgeColor}`}>
                    {item.badge}
                  </span>
                )}
              </Link>
            )
          })}
        </nav>

        {/* Telemetry pill */}
        <div className="p-4 border-t border-white/8 bg-black/20">
          <div className="glass-subtle rounded-xl p-3 border border-white/8 space-y-2">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-400 flex items-center gap-1.5">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
                </span>
                Engine Status
              </span>
              <span className="text-emerald-400 font-mono font-bold text-[10px]">LIVE</span>
            </div>
            <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
              <span>Dual RAG:</span>
              <span className="text-indigo-300 font-bold">Dense + BM25</span>
            </div>
            <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
              <span>NLI Model:</span>
              <span className="text-slate-300">DeBERTa-v3</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

