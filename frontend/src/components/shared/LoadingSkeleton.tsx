interface LoadingSkeletonProps {
  lines?: number
  className?: string
}

export function SkeletonLine({ className = "" }: { className?: string }) {
  return (
    <div className={`h-4 bg-slate-200 rounded animate-pulse ${className}`} />
  )
}

export function SkeletonCard({ lines = 3, className = "" }: LoadingSkeletonProps) {
  return (
    <div className={`border border-slate-200 rounded-lg p-5 bg-white space-y-3 shadow-sm ${className}`}>
      <div className="h-3 w-24 bg-slate-200 rounded animate-pulse" />
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="h-4 bg-slate-100 rounded animate-pulse" style={{ width: `${85 - i * 15}%` }} />
      ))}
    </div>
  )
}

export function SkeletonMetricCard() {
  return (
    <div className="border border-slate-200 rounded-lg p-5 bg-white shadow-sm space-y-3">
      <div className="flex justify-between">
        <div className="h-3 w-20 bg-slate-200 rounded animate-pulse" />
        <div className="h-5 w-5 bg-slate-100 rounded animate-pulse" />
      </div>
      <div className="h-8 w-16 bg-slate-200 rounded animate-pulse" />
      <div className="h-1 w-full bg-slate-100 rounded animate-pulse" />
    </div>
  )
}

export function SkeletonClaimCard() {
  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden bg-white shadow-sm">
      <div className="h-9 bg-slate-100 animate-pulse" />
      <div className="p-4 space-y-3">
        <div className="flex justify-between">
          <div className="h-3 w-16 bg-slate-200 rounded animate-pulse" />
          <div className="h-3 w-12 bg-slate-200 rounded animate-pulse" />
        </div>
        <div className="h-4 bg-slate-100 rounded animate-pulse w-full" />
        <div className="h-4 bg-slate-100 rounded animate-pulse w-3/4" />
        <div className="h-1.5 w-full bg-slate-100 rounded animate-pulse" />
        <div className="h-16 bg-slate-50 rounded animate-pulse" />
      </div>
    </div>
  )
}
