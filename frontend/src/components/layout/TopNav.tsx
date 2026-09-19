import { Bell, Search, User, Menu } from "lucide-react"

interface TopNavProps {
  onMenuClick: () => void
}

export default function TopNav({ onMenuClick }: TopNavProps) {
  return (
    <div className="p-3 pb-0">
      <header className="h-16 glass glass-shadow rounded-2xl flex items-center justify-between px-4 md:px-6 shrink-0">
        <div className="flex items-center space-x-3">
          <button
            className="lg:hidden p-1.5 text-slate-400 hover:text-white"
          onClick={onMenuClick}
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>

      <div className="flex items-center space-x-4">
        <div className="relative hidden md:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search claims..."
            className="h-10 w-64 rounded-full border border-white/10 glass-subtle pl-10 pr-4 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-400/40 focus:border-amber-400/40 transition-all"
          />
        </div>

        <button className="text-slate-400 hover:text-white transition-colors">
          <Bell className="h-5 w-5" />
        </button>

        <div className="h-9 w-9 rounded-full glass-strong flex items-center justify-center cursor-pointer border-white/10 hover:bg-white/10 transition-colors">
          <User className="h-5 w-5 text-slate-300" />
        </div>
      </div>
    </header>
    </div>
  )
}
