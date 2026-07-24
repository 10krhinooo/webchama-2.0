import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { getChama, getSavingsProgress, type Chama, type SavingsProgress } from '../../api/chamas'
import { getMembers } from '../../api/members'
import { getContributions, getMyContributions, type Contribution, type ContributionStatus } from '../../api/contributions'
import { getLoans, getMyLoans, getLoanRepayments, type Loan } from '../../api/loans'
import { getPayouts, getMyPayouts, type Payout } from '../../api/payouts'
import { extractErrorMessage } from '../../api/client'
import { useMyMembership } from '../../hooks/useMyMembership'
import { useActivityFeed } from '../../hooks/useActivityFeed'
import ContributionPot from '../../components/marketing/ContributionPot'
import { SkeletonBlock, SkeletonLine } from '../../components/ui/Skeleton'
import TransientAlert from '../../components/ui/TransientAlert'

const ACTIVE_LOAN_STATUSES: Loan['status'][] = ['APPROVED', 'DISBURSED', 'REPAYING']

const CONTRIBUTION_STATUS_LABELS: Record<ContributionStatus, string> = {
  PAID: 'Paid',
  PARTIAL: 'Partial',
  PENDING: 'Pending',
  OVERDUE: 'Overdue',
}

const ACTIVITY_EVENT_LABELS: Record<string, string> = {
  MEMBER_INVITED: 'Member invited',
  CONTRIBUTION_PAID: 'Contribution paid',
  LOAN_APPROVED: 'Loan approved',
  PAYOUT_DISBURSED: 'Payout disbursed',
  DOCUMENT_GENERATED: 'Document generated',
}

function formatMoney(amount: number, currency: string) {
  return `${currency} ${amount.toLocaleString()}`
}

function sumProgress(contributions: Contribution[], currency: string) {
  const due = contributions.reduce((total, c) => total + c.amountDue, 0)
  const paid = contributions.reduce((total, c) => total + c.amountPaid, 0)
  const percent = due > 0 ? (paid / due) * 100 : 0
  return { percent, sublabel: `${formatMoney(paid, currency)} of ${formatMoney(due, currency)} collected` }
}

function savingsGoalProgress(progress: SavingsProgress, currency: string) {
  const target = progress.target ?? 0
  const percent = target > 0 ? (progress.totalPaid / target) * 100 : 0
  return { percent, sublabel: `${formatMoney(progress.totalPaid, currency)} of ${formatMoney(target, currency)} saved` }
}

function contributionStatusChartData(contributions: Contribution[]) {
  const counts: Record<ContributionStatus, number> = { PAID: 0, PARTIAL: 0, PENDING: 0, OVERDUE: 0 }
  for (const c of contributions) counts[c.status] += 1
  return (Object.keys(counts) as ContributionStatus[]).map((status) => ({
    status: CONTRIBUTION_STATUS_LABELS[status],
    count: counts[status],
  }))
}

function nextScheduledPayout(payouts: Payout[]): Payout | null {
  const scheduled = payouts.filter((p) => p.status === 'SCHEDULED')
  if (scheduled.length === 0) return null
  return scheduled.reduce((soonest, p) => (p.scheduledDate < soonest.scheduledDate ? p : soonest))
}

export default function DashboardPage() {
  const { chamaId: chamaIdParam } = useParams<{ chamaId: string }>()
  const chamaId = Number(chamaIdParam)
  const { isChairperson, isTreasurer, loading: roleLoading } = useMyMembership(chamaId)
  const isManager = isChairperson || isTreasurer

  const [chama, setChama] = useState<Chama | null>(null)
  const [savingsProgress, setSavingsProgress] = useState<SavingsProgress | null>(null)
  const [memberCount, setMemberCount] = useState<number | null>(null)
  const [contributions, setContributions] = useState<Contribution[]>([])
  const [outstandingLoanTotal, setOutstandingLoanTotal] = useState(0)
  const [activeLoanCount, setActiveLoanCount] = useState(0)
  const [nextPayout, setNextPayout] = useState<Payout | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const { entries: activityEntries, loading: activityLoading } = useActivityFeed(chamaId, isManager && !roleLoading)

  useEffect(() => {
    if (roleLoading) return
    let cancelled = false
    setLoading(true)

    async function loadOutstandingLoans(): Promise<{ total: number; count: number }> {
      const loans = isManager ? await getLoans(chamaId) : await getMyLoans(chamaId)
      const active = loans.filter((l) => ACTIVE_LOAN_STATUSES.includes(l.status))
      if (active.length === 0) return { total: 0, count: 0 }
      if (isManager) {
        return { total: active.reduce((sum, l) => sum + l.principal, 0), count: active.length }
      }
      const repaymentLists = await Promise.all(active.map((l) => getLoanRepayments(chamaId, l.id)))
      const total = repaymentLists.reduce(
        (sum, repayments) => sum + repayments.reduce((s, r) => s + (r.amountDue - r.amountPaid), 0),
        0,
      )
      return { total, count: active.length }
    }

    Promise.all([
      getChama(chamaId),
      getSavingsProgress(chamaId),
      getMembers(chamaId),
      isManager ? getContributions(chamaId) : getMyContributions(chamaId),
      loadOutstandingLoans(),
      isManager ? getPayouts(chamaId) : getMyPayouts(chamaId),
    ])
      .then(([chamaData, savingsData, members, contributionData, loanSummary, payouts]) => {
        if (cancelled) return
        setChama(chamaData)
        setSavingsProgress(savingsData)
        setMemberCount(members.length)
        setContributions(contributionData)
        setOutstandingLoanTotal(loanSummary.total)
        setActiveLoanCount(loanSummary.count)
        setNextPayout(nextScheduledPayout(payouts))
        setError(null)
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
  }, [chamaId, isManager, roleLoading])

  if (loading || roleLoading) {
    return (
      <div className="space-y-6">
        <SkeletonLine className="h-8 w-64" />
        <div className="grid gap-6 lg:grid-cols-2">
          <SkeletonBlock className="h-72" />
          <SkeletonBlock className="h-72" />
        </div>
      </div>
    )
  }

  const currency = chama?.currency ?? 'KES'
  const { percent, sublabel } = sumProgress(contributions, currency)
  const chartData = contributionStatusChartData(contributions)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold text-ink">{chama?.name ?? 'Dashboard'}</h1>
        <p className="text-sm text-muted">
          {isManager ? 'This cycle across all members' : 'Your contribution this cycle'}
        </p>
      </div>

      <TransientAlert variant="error" message={error} onDismiss={() => setError(null)} />

      {savingsProgress?.target != null && (() => {
        const goal = savingsGoalProgress(savingsProgress, currency)
        return (
          <div className="rounded-2xl bg-white p-8 shadow-card">
            <ContributionPot percent={goal.percent} label="Savings goal" sublabel={goal.sublabel} />
          </div>
        )
      })()}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl bg-white p-8 shadow-card">
          <ContributionPot
            percent={percent}
            label={isManager ? 'Chama collected' : 'You have paid'}
            sublabel={sublabel}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-2xl bg-white p-6 shadow-card">
            <p className="font-heading text-xs font-semibold uppercase tracking-widest text-muted">Members</p>
            <p className="mt-2 font-mono text-3xl font-bold text-ink">{memberCount}</p>
          </div>
          <div className="rounded-2xl bg-white p-6 shadow-card">
            <p className="font-heading text-xs font-semibold uppercase tracking-widest text-muted">
              Contributions paid in full
            </p>
            <p className="mt-2 font-mono text-3xl font-bold text-ink">
              {contributions.filter((c) => c.status === 'PAID').length}
              <span className="ml-1 text-base font-normal text-muted">/ {contributions.length}</span>
            </p>
          </div>
          <div className="rounded-2xl bg-white p-6 shadow-card">
            <p className="font-heading text-xs font-semibold uppercase tracking-widest text-muted">
              {isManager ? 'Outstanding loans' : 'My loan balance'}
            </p>
            <p className="mt-2 font-mono text-3xl font-bold text-ink">{formatMoney(outstandingLoanTotal, currency)}</p>
            {isManager && (
              <p className="mt-1 text-xs text-muted">{activeLoanCount} active loan{activeLoanCount === 1 ? '' : 's'}</p>
            )}
          </div>
          <div className="rounded-2xl bg-white p-6 shadow-card">
            <p className="font-heading text-xs font-semibold uppercase tracking-widest text-muted">
              {isManager ? 'Next payout' : 'My payout position'}
            </p>
            {nextPayout ? (
              <>
                <p className="mt-2 font-mono text-lg font-bold text-ink">
                  {isManager ? nextPayout.memberName : `Round ${nextPayout.roundNumber}`}
                </p>
                <p className="mt-1 text-xs text-muted">
                  {formatMoney(nextPayout.amount, currency)} on {nextPayout.scheduledDate}
                </p>
              </>
            ) : (
              <p className="mt-2 text-sm text-muted">No payout scheduled yet</p>
            )}
          </div>
        </div>
      </div>

      <div className={isManager ? 'grid gap-6 lg:grid-cols-2' : ''}>
        <div className="rounded-2xl bg-white p-6 shadow-card">
          <p className="font-heading text-xs font-semibold uppercase tracking-widest text-muted">
            Contributions by status
          </p>
          <div className="mt-4 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EDE1CC" />
                <XAxis dataKey="status" tick={{ fontSize: 12, fill: '#6E6759' }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#6E6759' }} axisLine={false} tickLine={false} />
                <Tooltip cursor={{ fill: '#EDE1CC' }} />
                <Bar dataKey="count" fill="#1B4D45" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {isManager && (
          <div className="rounded-2xl bg-white p-6 shadow-card">
            <p className="font-heading text-xs font-semibold uppercase tracking-widest text-muted">Recent activity</p>
            <div className="mt-4 space-y-3">
              {activityLoading && activityEntries.length === 0 && (
                <p className="text-sm text-muted">Loading activity…</p>
              )}
              {!activityLoading && activityEntries.length === 0 && (
                <p className="text-sm text-muted">Nothing has happened yet.</p>
              )}
              {activityEntries.map((entry) => (
                <div key={entry.id} className="border-b border-paper-dim pb-3 last:border-0 last:pb-0">
                  <p className="text-sm font-medium text-ink">{entry.description}</p>
                  <p className="mt-0.5 text-xs text-muted">
                    {ACTIVITY_EVENT_LABELS[entry.eventType] ?? entry.eventType} &middot;{' '}
                    {new Date(entry.createdAt).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
