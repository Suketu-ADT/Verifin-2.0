import type { LucideIcon } from "lucide-react"
import { FileSearch } from "lucide-react"
import { Button } from "../ui/button"

interface EmptyStateProps {
  icon?: LucideIcon
  title?: string
  message?: string
  actionLabel?: string
  onAction?: () => void
}

export default function EmptyState({
  icon: Icon = FileSearch,
  title = "Nothing here yet",
  message = "Get started by running your first verification.",
  actionLabel,
  onAction,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center glass-card p-8 border-white/10 max-w-lg mx-auto my-6">
      <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-4 glow-amber">
        <Icon className="h-7 w-7 text-amber-400" />
      </div>
      <h3 className="text-lg font-bold text-white mb-1.5">{title}</h3>
      <p className="text-sm text-slate-400 max-w-sm mb-6 leading-relaxed">{message}</p>
      {actionLabel && onAction && (
        <Button onClick={onAction} className="text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-black px-5 py-2 shadow-lg shadow-amber-500/20 transition-all">
          {actionLabel}
        </Button>
      )}
    </div>
  )
}
