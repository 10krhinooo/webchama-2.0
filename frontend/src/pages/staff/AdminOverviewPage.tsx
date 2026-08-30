import { useEffect, useState, type ReactNode } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { getPlatformOverview, type PlatformOverview } from '../../api/admin'
import { extractErrorMessage } from '../../api/client'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import StatTile from '../../components/ui/StatTile'
import { SkeletonBlock, SkeletonLine } from '../../components/ui/Skeleton'
import TransientAlert from '../../components/ui/TransientAlert'
import { chartAxisProps, chartTooltipProps } from '../../lib/chartTheme'
import { useChartColors } from '../../lib/useChartColors'
import { downloadCsv } from '../../utils/csv'

function formatMoney(amount: number) {
  return `KES ${amount.toLocaleString()}`
}

function successRate(succeeded: number, failed: number): string {
  const total = succeeded + failed
  if (total === 0) return 'No payments yet'
  return `${Math.round((succeeded / total) * 100)}% success (${succeeded} of ${total})`
}

function exportOverviewCsv(overview: PlatformOverview) {
  downloadCsv(`platform-overview-${new Date().toISOString().slice(0, 10)}.csv`, [
    ['Metric', 'Value'],
    ['Total chamas', overview.totalChamas],
    ['Active chamas', overview.activeChamas],
    ['New chamas this month', overview.newChamasThisMonth],
    ['Total memberships', overview.totalMemberships],
    ['Active memberships', overview.activeMemberships],
    ['Total contributions collected (KES)', overview.totalContributionsCollected],
    ['Contributions collected this month (KES)', overview.contributionsCollectedThisMonth],
    ['Overdue contributions', overview.overdueContributions],
    ['Outstanding loans', overview.outstandingLoans],
    ['Outstanding loan principal (KES)', overview.outstandingLoanPrincipal],
    ['M-Pesa payments succeeded', overview.mpesaPaymentsSucceeded],
    ['M-Pesa payments failed', overview.mpesaPaymentsFailed],
    ['Card payments succeeded', overview.cardPaymentsSucceeded],
    ['Card payments failed', overview.cardPaymentsFailed],
  ])
}

/**
 * A two-way split, as a proportion bar rather than a two-slice pie.
 *
 * A pie of "active and inactive" is a featureless disc whenever everything is active, which is the
 * ordinary case here, and disappears entirely when the total is zero. The bar keeps both counts
 * legible at every ratio, and the numbers are stated outright rather than left to be read off an
 * angle.
 */
function StatusSplit({ label, active, total, tone }: { label: string; active: number; total: number; tone: string }) {
  const inactive = Math.max(total - active, 0)
  const percent = total === 0 ? 0 : Math.round((active / total) * 100)

  return (
    <Card className="space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-heading text-xs font-semibold uppercase tracking-widest text-muted">{label}</p>
        <span className="font-mono text-sm text-muted">{total === 0 ? 'None yet' : `${percent}% active`}</span>
      </div>
      <div className="h-3 w-full overflow-hidden rounded-full bg-border">
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${percent}%` }} />
      </div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-ink/80">
          Active <span className="ml-1 font-mono text-ink">{active}</span>
        </span>
        <span className="text-muted">
          Inactive <span className="ml-1 font-mono">{inactive}</span>
        </span>
      </div>
    </Card>
  )
}

/**
 * A chart with its heading.
 *
 * `text-muted` on the wrapper is what the axis ticks inherit through `currentColor`, so the chart
 * follows the theme without naming a colour.
 */
function ChartCard({ title, children, className }: { title: string; children: ReactNode; className?: string }) {
  return (
    <Card className={className}>
      <p className="font-heading text-xs font-semibold uppercase tracking-widest text-muted">{title}</p>
      <div className="mt-4 h-64 text-muted">{children}</div>
    </Card>
  )
}

export default function AdminOverviewPage() {
  const colors = useChartColors(['success', 'danger'])
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
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold text-ink">Platform overview</h1>
          <p className="text-sm text-muted">Aggregated across every chama on Webchama</p>
        </div>
        {overview && (
          <Button variant="secondary" onClick={() => exportOverviewCsv(overview)}>
            Export CSV
          </Button>
        )}
      </div>

      <TransientAlert variant="error" message={error} onDismiss={() => setError(null)} />

      {overview && (
        <>
          {/*
            One grid rather than three rows of four, so the last row is not a single tile stranded
            beside three empty columns.
          */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            <StatTile
              label="Total chamas"
              value={overview.totalChamas}
              detail={`${overview.activeChamas} active`}
            />
            <StatTile label="New chamas this month" value={overview.newChamasThisMonth} />
            <StatTile
              label="Total memberships"
              value={overview.totalMemberships}
              detail={`${overview.activeMemberships} active`}
            />
            <StatTile label="Overdue contributions" value={overview.overdueContributions} />
            <StatTile
              label="Contributions collected"
              value={formatMoney(overview.totalContributionsCollected)}
              detail="All time"
            />
            <StatTile
              label="Collected this month"
              value={formatMoney(overview.contributionsCollectedThisMonth)}
            />
            <StatTile
              label="Outstanding loans"
              value={overview.outstandingLoans}
              detail={formatMoney(overview.outstandingLoanPrincipal)}
            />
            <StatTile
              label="M-Pesa payments"
              value={overview.mpesaPaymentsSucceeded + overview.mpesaPaymentsFailed}
              detail={successRate(overview.mpesaPaymentsSucceeded, overview.mpesaPaymentsFailed)}
            />
            <StatTile
              label="Card payments"
              value={overview.cardPaymentsSucceeded + overview.cardPaymentsFailed}
              detail={successRate(overview.cardPaymentsSucceeded, overview.cardPaymentsFailed)}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            {/*
              The two splits are short and the chart is tall, so they share one column rather than
              each stretching to the chart's height beside it.
            */}
            <div className="space-y-4">
              <StatusSplit
                label="Chamas by status"
                active={overview.activeChamas}
                total={overview.totalChamas}
                tone="bg-primary"
              />
              <StatusSplit
                label="Memberships by status"
                active={overview.activeMemberships}
                total={overview.totalMemberships}
                tone="bg-accent"
              />
            </div>

            <ChartCard title="Payments by rail" className="lg:col-span-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={[
                    { rail: 'M-Pesa', Succeeded: overview.mpesaPaymentsSucceeded, Failed: overview.mpesaPaymentsFailed },
                    { rail: 'Card', Succeeded: overview.cardPaymentsSucceeded, Failed: overview.cardPaymentsFailed },
                  ]}
                >
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                  <XAxis dataKey="rail" {...chartAxisProps} />
                  <YAxis allowDecimals={false} {...chartAxisProps} />
                  <Tooltip {...chartTooltipProps} cursor={{ className: 'fill-paper-dim' }} />
                  <Legend />
                  {/*
                    Resolved colours rather than fill utilities. Recharts draws the legend swatch
                    from the `fill` prop, so a series styled only by class is listed against a
                    black square.
                  */}
                  <Bar dataKey="Succeeded" fill={colors.success} radius={[6, 6, 0, 0]} />
                  <Bar dataKey="Failed" fill={colors.danger} radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>
        </>
      )}
    </div>
  )
}
