/**
 * Skeleton.jsx
 * Loading placeholder components that mirror real content layout.
 * Prevents layout shift and communicates loading state clearly.
 */

// Base pulsing skeleton block
export const Skeleton = ({ className = '' }) => (
  <div className={`animate-pulse bg-surface-700 rounded-lg ${className}`} />
)

// ── Stat card skeleton (3-up grid on sales page) ─────────────────────────────
export const StatCardSkeleton = () => (
  <div className="card p-4 space-y-2">
    <Skeleton className="w-6 h-6 rounded-md" />
    <Skeleton className="h-7 w-24 mt-1" />
    <Skeleton className="h-3 w-16" />
  </div>
)

// ── Chart area skeleton ───────────────────────────────────────────────────────
export const ChartSkeleton = ({ height = 200 }) => (
  <div className="card p-4">
    <div className="flex items-center justify-between mb-4">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-6 w-32 rounded-full" />
    </div>
    <div className="relative overflow-hidden rounded-lg bg-surface-700/40" style={{ height }}>
      {/* Animated shimmer */}
      <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.5s_infinite]
        bg-gradient-to-r from-transparent via-surface-600/30 to-transparent" />
      {/* Fake bar shapes */}
      <div className="absolute bottom-0 left-0 right-0 flex items-end gap-2 px-4 pb-0">
        {[40, 65, 30, 80, 55, 70, 45].map((h, i) => (
          <div
            key={i}
            className="flex-1 bg-surface-600/50 rounded-t-sm"
            style={{ height: `${h}%` }}
          />
        ))}
      </div>
    </div>
  </div>
)

// ── Single row skeleton (transaction list) ────────────────────────────────────
export const RowSkeleton = () => (
  <div className="flex items-center gap-4 px-4 py-4 border-b border-surface-700 last:border-0">
    <Skeleton className="w-14 h-6 rounded-md shrink-0" />
    <div className="flex-1 space-y-2">
      <Skeleton className="h-3.5 w-3/4" />
      <Skeleton className="h-3 w-1/3" />
    </div>
    <div className="text-right space-y-2 shrink-0">
      <Skeleton className="h-4 w-16 ml-auto" />
      <Skeleton className="h-3 w-10 ml-auto" />
    </div>
  </div>
)

// ── Best-sellers row skeleton ─────────────────────────────────────────────────
export const BestSellerSkeleton = () => (
  <div className="flex items-center gap-3 py-2.5">
    <Skeleton className="w-5 h-5 rounded-full shrink-0" />
    <div className="flex-1 space-y-1.5">
      <Skeleton className="h-3.5 w-3/5" />
      <Skeleton className="h-2 w-full rounded-full" />
    </div>
    <Skeleton className="h-4 w-14 shrink-0" />
  </div>
)

// ── Page-level loading screen ─────────────────────────────────────────────────
export const PageLoader = () => (
  <div className="flex items-center justify-center h-full bg-surface-900">
    <div className="flex flex-col items-center gap-3">
      <div className="w-10 h-10 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
      <span className="text-slate-500 text-sm font-medium">Loading…</span>
    </div>
  </div>
)
