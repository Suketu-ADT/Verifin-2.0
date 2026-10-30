import { AlertCircle, RefreshCw } from "lucide-react"
import { Button } from "../ui/button"

interface ErrorStateProps {
  title?: string
  message?: string
  onRetry?: () => void
}

export default function ErrorState({
  title = "Something went wrong",
  message = "An error occurred while loading data. Please try again.",
  onRetry,
}: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center glass-card p-8 border-rose-500/20 max-w-lg mx-auto my-6">
      <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mb-4 glow-rose">
        <AlertCircle className="h-7 w-7 text-rose-400" />
      </div>
      <h3 className="text-lg font-bold text-white mb-1.5">{title}</h3>
      <p className="text-sm text-slate-400 max-w-sm mb-6 leading-relaxed">{message}</p>
      {onRetry && (
        <Button variant="outline" onClick={onRetry} className="text-xs font-semibold border-rose-500/30 text-rose-300 hover:bg-rose-500/10">
          <RefreshCw className="h-3.5 w-3.5 mr-2" /> Try Again
        </Button>
      )}
    </div>
  )
}
