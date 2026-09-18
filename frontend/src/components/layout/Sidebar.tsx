import { Link, useLocation } from "react-router-dom"
import { FileSearch, History, Search, Activity, Settings, Info, FileText } from "lucide-react"

export default function Sidebar() {
  const location = useLocation()
  
  const navItems = [
    { name: "New Verification", href: "/verify", icon: FileSearch },
    { name: "History", href: "/history", icon: History },
    { name: "Reports", href: "/reports", icon: FileText },
    { name: "Evidence Explorer", href: "/evidence", icon: Search },
    { name: "System Status", href: "/system", icon: Activity },
    { name: "Settings", href: "/settings", icon: Settings },
    { name: "About", href: "/about", icon: Info },
  ]

  return (
    <div className="w-64 bg-card border-r flex flex-col h-full">
      <div className="p-6 border-b">
        <h1 className="text-2xl font-bold tracking-tight text-primary">VERIFIN</h1>
      </div>
      <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = location.pathname.startsWith(item.href)
          return (
            <Link
              key={item.name}
              to={item.href}
              className={`flex items-center space-x-3 px-3 py-2 rounded-md transition-colors ${
                isActive 
                  ? "bg-primary text-primary-foreground font-medium" 
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <item.icon className="h-5 w-5" />
              <span>{item.name}</span>
            </Link>
          )
        })}
      </nav>
      <div className="p-4 border-t text-sm text-muted-foreground flex items-center space-x-2">
        <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></div>
        <span>AI Verification Engine: Online</span>
      </div>
    </div>
  )
}
