import { useEffect, useState } from 'react'
import { getPlatformOverview, type PlatformOverview } from '../../api/admin'
import { extractErrorMessage } from '../../api/client'
import { SkeletonBlock, SkeletonLine } from '../../components/ui/Skeleton'
import TransientAlert from '../../components/ui/TransientAlert'

function formatMoney(amount: number) {
  return `KES ${amount.toLocaleString()}`
}

function successRate(succeeded: number, failed: number): string {
  const total = succeeded + failed
  if (total === 0) return 'No payments yet'
  return `${Math.round((succeeded / total) * 100)}% success (${succeeded} of ${total})`
}

function Tile({ label, value, sublabel }: { label: string; value: string; sublabel?: string }) {
  return (
    <div className="rounded-2xl bg-white p-6 shadow-card">
      <p className="font-heading text-xs font-semibold uppercase tracking-widest text-muted">{label}</p>
      <p className="mt-2 font-mono text-3xl font-bold text-ink">{value}</p>
      {sublabel && <p className="mt-1 text-xs text-muted">{sublabel}</p>}
    </div>
  )
}

export default function AdminOverviewPage() {
  const [overview, setOverview] = useState<PlatformOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    getPlatformOverview()
      .then((data) => {
        if (!cancelled) {
          setOverview(data)
          setError(null)
        }
      })
      .catch((err) => {
        if (!cancelled) setError(extractErrorMessage(err))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (loading) {
    return (
      <div className="space-y-6">
        <SkeletonLine className="h-8 w-64" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <SkeletonBlock key={i} className="h-28" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold text-ink">Platform overview</h1>
        <p className="text-sm text-muted">Aggregated across every chama on Webchama</p>
      </div>

      <TransientAlert variant="error" message={error} onDismiss={() => setError(null)} />

      {overview && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Tile label="Total chamas" value={String(overview.totalChamas)} sublabel={`${overview.activeChamas} active`} />
            <Tile label="New chamas this month" value={String(overview.newChamasThisMonth)} />
            <Tile label="Total memberships" value={String(overview.totalMemberships)} sublabel={`${overview.activeMemberships} active`} />
            <Tile label="Overdue contributions" value={String(overview.overdueContributions)} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Tile label="Contributions collected" value={formatMoney(overview.totalContributionsCollected)} sublabel="All time" />
            <Tile
              label="Collected this month"
              value={formatMoney(overview.contributionsCollectedThisMonth)}
            />
            <Tile label="Outstanding loans" value={String(overview.outstandingLoans)} sublabel={formatMoney(overview.outstandingLoanPrincipal)} />
            <Tile
              label="M-Pesa payments"
              value={String(overview.mpesaPaymentsSucceeded + overview.mpesaPaymentsFailed)}
              sublabel={successRate(overview.mpesaPaymentsSucceeded, overview.mpesaPaymentsFailed)}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Tile
              label="Card payments"
              value={String(overview.cardPaymentsSucceeded + overview.cardPaymentsFailed)}
              sublabel={successRate(overview.cardPaymentsSucceeded, overview.cardPaymentsFailed)}
            />
          </div>
        </>
      )}
    </div>
  )
}
