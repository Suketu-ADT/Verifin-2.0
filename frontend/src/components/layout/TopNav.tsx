import { Bell, Search, User } from "lucide-react"

export default function TopNav() {
  return (
    <header className="h-16 border-b bg-card flex items-center justify-between px-6 shrink-0">
      <div className="flex items-center space-x-4">
        <h2 className="font-semibold text-lg text-foreground">Current Project</h2>
      </div>
      
      <div className="flex items-center space-x-6">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <input 
            type="text" 
            placeholder="Search claims..." 
            className="h-9 w-64 rounded-md border border-input bg-background pl-9 pr-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        
        <button className="text-muted-foreground hover:text-foreground">
          <Bell className="h-5 w-5" />
        </button>
        
        <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center cursor-pointer border">
          <User className="h-5 w-5 text-muted-foreground" />
        </div>
      </div>
    </header>
  )
}
