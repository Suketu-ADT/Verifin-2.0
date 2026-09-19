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
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-14 h-14 rounded-full bg-rose-50 flex items-center justify-center mb-4">
        <AlertCircle className="h-7 w-7 text-rose-500" />
      </div>
      <h3 className="text-lg font-bold text-slate-800 mb-1">{title}</h3>
      <p className="text-sm text-slate-500 max-w-sm mb-6 leading-relaxed">{message}</p>
      {onRetry && (
        <Button variant="outline" onClick={onRetry} className="text-sm font-semibold">
          <RefreshCw className="h-4 w-4 mr-2" /> Try Again
        </Button>
      )}
    </div>
  )
}
