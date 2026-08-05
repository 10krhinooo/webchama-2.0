import { useEffect, useState, type ReactNode } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { getPlatformOverview, type PlatformOverview } from '../../api/admin'
import { extractErrorMessage } from '../../api/client'
import { SkeletonBlock, SkeletonLine } from '../../components/ui/Skeleton'
import TransientAlert from '../../components/ui/TransientAlert'
import { downloadCsv } from '../../utils/csv'

const CHART_COLORS = {
  primary: '#1B4D45',
  accent: '#E0A233',
  success: '#3F7A3B',
  danger: '#B84B2E',
  muted: '#6E6759',
}

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

function Tile({ label, value, sublabel }: { label: string; value: string; sublabel?: string }) {
  return (
    <div className="rounded-2xl bg-white p-6 shadow-card">
      <p className="font-heading text-xs font-semibold uppercase tracking-widest text-muted">{label}</p>
      <p className="mt-2 font-mono text-3xl font-bold text-ink">{value}</p>
      {sublabel && <p className="mt-1 text-xs text-muted">{sublabel}</p>}
    </div>
  )
}

function ChartCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl bg-white p-6 shadow-card">
      <p className="font-heading text-xs font-semibold uppercase tracking-widest text-muted">{title}</p>
      <div className="mt-4 h-64">{children}</div>
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
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold text-ink">Platform overview</h1>
          <p className="text-sm text-muted">Aggregated across every chama on Webchama</p>
        </div>
        {overview && (
          <button
            type="button"
            onClick={() => exportOverviewCsv(overview)}
            className="rounded-lg border border-primary px-4 py-2 text-sm font-semibold text-primary transition hover:bg-primary-light"
          >
            Export CSV
          </button>
        )}
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

          <div className="grid gap-4 lg:grid-cols-3">
            <ChartCard title="Chamas by status">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={[
                      { name: 'Active', value: overview.activeChamas },
                      { name: 'Inactive', value: overview.totalChamas - overview.activeChamas },
                    ]}
                    dataKey="value"
                    nameKey="name"
                    outerRadius={80}
                    label
                  >
                    <Cell fill={CHART_COLORS.primary} />
                    <Cell fill={CHART_COLORS.muted} />
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Memberships by status">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={[
                      { name: 'Active', value: overview.activeMemberships },
                      { name: 'Inactive', value: overview.totalMemberships - overview.activeMemberships },
                    ]}
                    dataKey="value"
                    nameKey="name"
                    outerRadius={80}
                    label
                  >
                    <Cell fill={CHART_COLORS.accent} />
                    <Cell fill={CHART_COLORS.muted} />
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Payments by rail">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={[
                    { rail: 'M-Pesa', Succeeded: overview.mpesaPaymentsSucceeded, Failed: overview.mpesaPaymentsFailed },
                    { rail: 'Card', Succeeded: overview.cardPaymentsSucceeded, Failed: overview.cardPaymentsFailed },
                  ]}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="rail" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="Succeeded" fill={CHART_COLORS.success} />
                  <Bar dataKey="Failed" fill={CHART_COLORS.danger} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>
        </>
      )}
    </div>
  )
}
