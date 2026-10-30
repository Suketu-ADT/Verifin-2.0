interface LoadingSkeletonProps {
  lines?: number
  className?: string
}

export function SkeletonLine({ className = "" }: { className?: string }) {
  return (
    <div className={`h-4 bg-white/10 rounded-md animate-pulse ${className}`} />
  )
}

export function SkeletonCard({ lines = 3, className = "" }: LoadingSkeletonProps) {
  return (
    <div className={`glass-card p-5 space-y-3 ${className}`}>
      <div className="h-3 w-28 bg-white/15 rounded-md animate-pulse" />
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="h-4 bg-white/5 rounded-md animate-pulse" style={{ width: `${85 - i * 15}%` }} />
      ))}
    </div>
  )
}

export function SkeletonMetricCard() {
  return (
    <div className="glass-card p-5 space-y-3">
      <div className="flex justify-between items-center">
        <div className="h-3 w-24 bg-white/15 rounded-md animate-pulse" />
        <div className="h-5 w-5 bg-white/10 rounded-md animate-pulse" />
      </div>
      <div className="h-8 w-20 bg-white/20 rounded-md animate-pulse" />
      <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
        <div className="h-full w-1/3 bg-amber-400/30 rounded-full animate-pulse" />
      </div>
    </div>
  )
}

export function SkeletonClaimCard() {
  return (
    <div className="glass-card overflow-hidden">
      <div className="h-10 bg-white/[0.04] border-b border-white/5 px-4 flex items-center justify-between">
        <div className="h-3 w-20 bg-white/15 rounded animate-pulse" />
        <div className="h-4 w-16 bg-white/10 rounded-full animate-pulse" />
      </div>
      <div className="p-5 space-y-3.5">
        <div className="h-4 bg-white/10 rounded-md animate-pulse w-full" />
        <div className="h-4 bg-white/10 rounded-md animate-pulse w-3/4" />
        <div className="h-2 w-full bg-white/5 rounded-full animate-pulse" />
        <div className="h-16 bg-black/20 rounded-xl border border-white/5 animate-pulse" />
      </div>
    </div>
  )
}
