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
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center mb-4">
        <Icon className="h-7 w-7 text-slate-400" />
      </div>
      <h3 className="text-lg font-bold text-slate-700 mb-1">{title}</h3>
      <p className="text-sm text-slate-400 max-w-sm mb-6 leading-relaxed">{message}</p>
      {actionLabel && onAction && (
        <Button onClick={onAction} className="text-sm font-semibold bg-slate-900 text-white hover:bg-slate-800">
          {actionLabel}
        </Button>
      )}
    </div>
  )
}
