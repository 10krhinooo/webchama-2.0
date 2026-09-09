import ChamaMark from '../marketing/ChamaMark'

/**
 * The Suspense fallback shown while a lazily loaded route's chunk is fetched. Deliberately quiet,
 * the same mark-and-line treatment as ProtectedRoute's "Signing you in" state, because on a fast
 * connection it exists for a handful of frames and should not flash anything louder than that.
 * It fills whatever container it lands in (the full viewport for a public route, the staff
 * layout's outlet otherwise) rather than forcing `min-h-screen` of its own.
 */
export default function RouteFallback() {
  return (
    <div
      role="status"
      className="flex min-h-[50vh] flex-col items-center justify-center gap-4 bg-paper text-muted"
    >
      <ChamaMark className="h-9 w-9 animate-pulse text-brand" />
      <p className="text-sm">Loading…</p>
    </div>
  )
}
