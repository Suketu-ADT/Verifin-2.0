import { motion } from "framer-motion"
import { Link, useLocation } from "react-router-dom"
import { 
  FileSearch, History, Search, Activity, Settings, FileText,
  LayoutDashboard, X,
} from "lucide-react"

interface SidebarProps {
  isOpen: boolean
  onClose: () => void
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const location = useLocation()

  const navItems = [
    { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { name: "New Verification", href: "/verify", icon: FileSearch },
    { name: "History", href: "/history", icon: History },
    { name: "Reports", href: "/reports", icon: FileText },
    { name: "Evidence Explorer", href: "/evidence", icon: Search },
    { name: "System Status", href: "/system", icon: Activity },
    { name: "Settings", href: "/settings", icon: Settings },
  ]

  return (
    <div className={`fixed lg:static inset-y-0 left-0 z-50 h-full p-3 transform transition-transform duration-200 ease-in-out ${isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>
      <div
        className="w-72 glass glass-shadow rounded-2xl flex flex-col h-full overflow-hidden"
      >
      <div className="p-6 border-b border-white/5 flex items-center justify-between">
        <Link to="/" className="text-2xl font-bold tracking-tight text-white hover:text-amber-400 transition-colors">
          VERIFIN
        </Link>
        <button
          className="lg:hidden p-1 text-muted-foreground hover:text-foreground"
          onClick={onClose}
        >
          <X className="h-5 w-5" />
        </button>
      </div>
      <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = location.pathname === item.href || 
            (item.href !== "/dashboard" && location.pathname.startsWith(item.href))
          return (
            <Link
              key={item.name}
              to={item.href}
              onClick={onClose}
              className={`flex items-center space-x-3 px-4 py-2.5 rounded-xl transition-all text-sm relative overflow-hidden ${
                isActive
                  ? "text-white font-medium"
                  : "text-slate-400 hover:text-white hover:bg-white/[0.04] border border-transparent"
              }`}
            >
              {isActive && (
                <motion.div 
                  layoutId="activeNav"
                  className="absolute inset-0 bg-white/[0.06] shadow-[inset_0_0_0_1px_rgba(191,149,63,0.35)] rounded-xl pointer-events-none"
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                />
              )}
              {isActive && (
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-amber-400 z-10" />
              )}
              <item.icon className={`h-4 w-4 relative z-10 ${isActive ? "text-amber-400" : ""}`} />
              <span className="relative z-10">{item.name}</span>
            </Link>
          )
        })}
      </nav>
      <div className="p-4 border-t border-white/5 text-sm text-slate-400 flex items-center space-x-2">
        <div className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)] animate-pulse" />
        <span>Verification Engine: Online</span>
      </div>
      </div>
    </div>
  )
}
