import type { ArrearsBucket } from '../../api/analytics'
import Card from '../ui/Card'

/**
 * Unpaid contribution balances by age.
 *
 * <p>Rendered as labelled bars rather than a chart library: there are always exactly four
 * categories and the useful comparison is between their sizes, which a plain bar conveys without
 * an axis to read.
 */
export default function ArrearsAgeingChart({ buckets }: { buckets: ArrearsBucket[] }) {
  const amounts = buckets.map((b) => Number(b.amount))
  const largest = Math.max(...amounts, 1)
  const total = amounts.reduce((sum, amount) => sum + amount, 0)

  return (
    <Card data-testid="arrears-ageing-chart" className="space-y-3">
      <div className="flex items-baseline justify-between">
        <h2 className="font-heading text-lg font-semibold text-ink">Arrears by age</h2>
        <span className="font-mono text-sm text-muted">{total.toLocaleString()} owed</span>
      </div>
      {total === 0 ? (
        <p className="text-sm text-muted">Nothing is in arrears.</p>
      ) : (
        <ul className="space-y-3">
          {buckets.map((bucket) => (
            <li key={bucket.bucket}>
              <div className="flex items-center justify-between text-sm">
                <span className="text-ink/80">{bucket.bucket} days</span>
                <span className="font-mono text-muted">
                  {Number(bucket.amount).toLocaleString()}
                  <span className="ml-2 text-xs text-subtle">
                    {bucket.members} {bucket.members === 1 ? 'member' : 'members'}
                  </span>
                </span>
              </div>
              <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-border">
                <div
                  className="h-full rounded-full bg-warning"
                  style={{ width: `${Math.round((Number(bucket.amount) / largest) * 100)}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
