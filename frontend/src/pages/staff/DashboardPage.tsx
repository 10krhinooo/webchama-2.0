import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { getChama, getSavingsProgress, updateChama, type Chama, type SavingsProgress } from '../../api/chamas'
import { getMembers } from '../../api/members'
import { getContributions, getMyContributions, type Contribution, type ContributionStatus } from '../../api/contributions'
import { getLoans, getMyLoans, getLoanRepayments, type Loan } from '../../api/loans'
import { getPayouts, getMyPayouts, type Payout } from '../../api/payouts'
import { getPendingApprovals, type Approval } from '../../api/approvals'
import { getMeetings, type Meeting } from '../../api/meetings'
import { getResolutions } from '../../api/resolutions'
import { getWelfareFund, updateWelfareFundTarget, type WelfareFund } from '../../api/welfareFund'
import { extractErrorMessage } from '../../api/client'
import { useMyMembership } from '../../hooks/useMyMembership'
import { useActivityFeed } from '../../hooks/useActivityFeed'
import ContributionPot from '../../components/marketing/ContributionPot'
import { SkeletonBlock, SkeletonLine } from '../../components/ui/Skeleton'
import TransientAlert from '../../components/ui/TransientAlert'
import Reveal from '../../components/ui/Reveal'
import Modal from '../../components/ui/Modal'
import FormError from '../../components/ui/FormError'
import FormField from '../../components/ui/FormField'
import Input from '../../components/ui/Input'
import LoadingButton from '../../components/ui/LoadingButton'

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
  CHAMA_MARKED_INACTIVE: 'Chama marked inactive',
  CHAMA_REACTIVATED: 'Chama reactivated',
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

function nextUpcomingMeeting(meetings: Meeting[]): Meeting | null {
  const today = new Date().toISOString().slice(0, 10)
  const upcoming = meetings.filter((m) => m.meetingDate >= today)
  if (upcoming.length === 0) return null
  return upcoming.reduce((soonest, m) => (m.meetingDate < soonest.meetingDate ? m : soonest))
}

export default function DashboardPage() {
  const { chamaId: chamaIdParam } = useParams<{ chamaId: string }>()
  const chamaId = Number(chamaIdParam)
  const { member, isChairperson, isTreasurer, isSecretary, loading: roleLoading } = useMyMembership(chamaId)
  const isManager = isChairperson || isTreasurer

  const [chama, setChama] = useState<Chama | null>(null)
  const [savingsProgress, setSavingsProgress] = useState<SavingsProgress | null>(null)
  const [welfareFund, setWelfareFund] = useState<WelfareFund | null>(null)
  const [memberCount, setMemberCount] = useState<number | null>(null)
  const [contributions, setContributions] = useState<Contribution[]>([])
  const [outstandingLoanTotal, setOutstandingLoanTotal] = useState(0)
  const [activeLoanCount, setActiveLoanCount] = useState(0)
  const [loansAwaitingDecision, setLoansAwaitingDecision] = useState(0)
  const [pendingApprovals, setPendingApprovals] = useState<Approval[]>([])
  const [nextPayout, setNextPayout] = useState<Payout | null>(null)
  const [nextMeeting, setNextMeeting] = useState<Meeting | null>(null)
  const [openResolutionCount, setOpenResolutionCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const { entries: activityEntries, loading: activityLoading } = useActivityFeed(chamaId, isManager && !roleLoading)

  useEffect(() => {
    if (roleLoading) return
    let cancelled = false
    setLoading(true)

    async function loadOutstandingLoans(): Promise<{ total: number; count: number; requested: number }> {
      const loans = isManager ? await getLoans(chamaId) : await getMyLoans(chamaId)
      const active = loans.filter((l) => ACTIVE_LOAN_STATUSES.includes(l.status))
      const requested = isChairperson ? loans.filter((l) => l.status === 'REQUESTED').length : 0
      if (active.length === 0) return { total: 0, count: 0, requested }
      if (isManager) {
        return { total: active.reduce((sum, l) => sum + l.principal, 0), count: active.length, requested }
      }
      const repaymentLists = await Promise.all(active.map((l) => getLoanRepayments(chamaId, l.id)))
      const total = repaymentLists.reduce(
        (sum, repayments) => sum + repayments.reduce((s, r) => s + (r.amountDue - r.amountPaid), 0),
        0,
      )
      return { total, count: active.length, requested }
    }

    Promise.all([
      getChama(chamaId),
      getSavingsProgress(chamaId),
      getMembers(chamaId),
      isManager ? getContributions(chamaId) : getMyContributions(chamaId),
      loadOutstandingLoans(),
      isManager ? getPayouts(chamaId) : getMyPayouts(chamaId),
      isManager ? getPendingApprovals(chamaId) : Promise.resolve([]),
      isSecretary ? getMeetings(chamaId) : Promise.resolve([]),
      isSecretary ? getResolutions(chamaId) : Promise.resolve([]),
      isManager ? getWelfareFund(chamaId) : Promise.resolve(null),
    ])
      .then(([chamaData, savingsData, members, contributionData, loanSummary, payouts, approvals, meetings, resolutions, welfareFundData]) => {
        if (cancelled) return
        setChama(chamaData)
        setSavingsProgress(savingsData)
        setWelfareFund(welfareFundData)
        setMemberCount(members.length)
        setContributions(contributionData)
        setOutstandingLoanTotal(loanSummary.total)
        setActiveLoanCount(loanSummary.count)
        setLoansAwaitingDecision(loanSummary.requested)
        setNextPayout(nextScheduledPayout(payouts))
        setPendingApprovals(approvals)
        setNextMeeting(nextUpcomingMeeting(meetings))
        setOpenResolutionCount(resolutions.filter((r) => r.status === 'OPEN').length)
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
  }, [chamaId, isManager, isChairperson, isSecretary, roleLoading])

  const [showGoalModal, setShowGoalModal] = useState(false)
  const [goalForm, setGoalForm] = useState('')
  const [goalSaving, setGoalSaving] = useState(false)
  const [goalNotice, setGoalNotice] = useState<string | null>(null)

  const openGoalEditor = () => {
    setGoalForm(savingsProgress?.target != null ? String(savingsProgress.target) : '')
    setGoalNotice(null)
    setShowGoalModal(true)
  }

  const handleGoalSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!chama) return
    setGoalSaving(true)
    setGoalNotice(null)
    try {
      const updated = await updateChama(chama.id, {
        name: chama.name,
        description: chama.description ?? undefined,
        type: chama.type,
        currency: chama.currency,
        contributionFrequency: chama.contributionFrequency,
        contributionAmount: chama.contributionAmount,
        meetingDay: chama.meetingDay ?? undefined,
        savingsTarget: goalForm ? Number(goalForm) : undefined,
      })
      setChama(updated)
      setSavingsProgress((current) => (current ? { ...current, target: updated.savingsTarget } : current))
      setShowGoalModal(false)
    } catch (err) {
      setGoalNotice(extractErrorMessage(err))
    } finally {
      setGoalSaving(false)
    }
  }

  const [showWelfareGoalModal, setShowWelfareGoalModal] = useState(false)
  const [welfareGoalForm, setWelfareGoalForm] = useState('')
  const [welfareGoalSaving, setWelfareGoalSaving] = useState(false)
  const [welfareGoalNotice, setWelfareGoalNotice] = useState<string | null>(null)

  const openWelfareGoalEditor = () => {
    setWelfareGoalForm(welfareFund?.target != null ? String(welfareFund.target) : '')
    setWelfareGoalNotice(null)
    setShowWelfareGoalModal(true)
  }

  const handleWelfareGoalSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setWelfareGoalSaving(true)
    setWelfareGoalNotice(null)
    try {
      const updated = await updateWelfareFundTarget(chamaId, {
        target: welfareGoalForm ? Number(welfareGoalForm) : undefined,
      })
      setWelfareFund(updated)
      setShowWelfareGoalModal(false)
    } catch (err) {
      setWelfareGoalNotice(extractErrorMessage(err))
    } finally {
      setWelfareGoalSaving(false)
    }
  }

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
      <Reveal eager>
        <h1 className="font-heading text-2xl font-bold text-ink">{chama?.name ?? 'Dashboard'}</h1>
        <p className="text-sm text-muted">
          {isManager ? 'This cycle across all members' : 'Your contribution this cycle'}
        </p>
      </Reveal>

      <TransientAlert variant="error" message={error} onDismiss={() => setError(null)} />

      {(savingsProgress?.target != null || isChairperson) && (
        <div className="rounded-2xl bg-surface p-8 shadow-card">
          {isChairperson && (
            <div className="mb-4 flex justify-end">
              <button onClick={openGoalEditor} className="text-brand text-xs hover:underline">
                Edit savings goal
              </button>
            </div>
          )}
          {savingsProgress?.target != null ? (
            (() => {
              const goal = savingsGoalProgress(savingsProgress, currency)
              return <ContributionPot percent={goal.percent} label="Savings goal" sublabel={goal.sublabel} />
            })()
          ) : (
            <p className="text-sm text-muted">No savings goal set yet.</p>
          )}
        </div>
      )}

      <Reveal eager delayMs={80} className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl bg-surface p-8 shadow-card">
          <ContributionPot
            percent={percent}
            label={isManager ? 'Chama collected' : 'You have paid'}
            sublabel={sublabel}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-2xl bg-surface p-6 shadow-card">
            <p className="font-heading text-xs font-semibold uppercase tracking-widest text-muted">Members</p>
            <p className="mt-2 font-mono text-3xl font-bold text-ink">{memberCount}</p>
          </div>
          <div className="rounded-2xl bg-surface p-6 shadow-card">
            <p className="font-heading text-xs font-semibold uppercase tracking-widest text-muted">
              Contributions paid in full
            </p>
            <p className="mt-2 font-mono text-3xl font-bold text-ink">
              {contributions.filter((c) => c.status === 'PAID').length}
              <span className="ml-1 text-base font-normal text-muted">/ {contributions.length}</span>
            </p>
          </div>
          <div className="rounded-2xl bg-surface p-6 shadow-card">
            <p className="font-heading text-xs font-semibold uppercase tracking-widest text-muted">
              {isManager ? 'Outstanding loans' : 'My loan balance'}
            </p>
            <p className="mt-2 font-mono text-3xl font-bold text-ink">{formatMoney(outstandingLoanTotal, currency)}</p>
            {isManager && (
              <p className="mt-1 text-xs text-muted">{activeLoanCount} active loan{activeLoanCount === 1 ? '' : 's'}</p>
            )}
          </div>
          <div className="rounded-2xl bg-surface p-6 shadow-card">
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
          {isManager && welfareFund && (
            <div className="rounded-2xl bg-surface p-6 shadow-card">
              <div className="flex items-start justify-between">
                <p className="font-heading text-xs font-semibold uppercase tracking-widest text-muted">
                  Welfare fund
                </p>
                {isChairperson && (
                  <button onClick={openWelfareGoalEditor} className="text-brand text-xs hover:underline">
                    Edit goal
                  </button>
                )}
              </div>
              <p className="mt-2 font-mono text-3xl font-bold text-ink">{formatMoney(welfareFund.balance, currency)}</p>
              {welfareFund.target != null && (
                <p className="mt-1 text-xs text-muted">of {formatMoney(welfareFund.target, currency)} goal</p>
              )}
            </div>
          )}
        </div>
      </Reveal>

      {(isChairperson || isTreasurer || isSecretary) && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {isChairperson && (
            <>
              <div className="rounded-2xl bg-surface p-6 shadow-card">
                <p className="font-heading text-xs font-semibold uppercase tracking-widest text-muted">
                  Awaiting your sign-off
                </p>
                <p className="mt-2 font-mono text-3xl font-bold text-ink">{pendingApprovals.length}</p>
              </div>
              <div className="rounded-2xl bg-surface p-6 shadow-card">
                <p className="font-heading text-xs font-semibold uppercase tracking-widest text-muted">
                  Loans awaiting decision
                </p>
                <p className="mt-2 font-mono text-3xl font-bold text-ink">{loansAwaitingDecision}</p>
              </div>
            </>
          )}
          {isTreasurer && (
            <>
              <div className="rounded-2xl bg-surface p-6 shadow-card">
                <p className="font-heading text-xs font-semibold uppercase tracking-widest text-muted">
                  Overdue contributions
                </p>
                <p className="mt-2 font-mono text-3xl font-bold text-ink">
                  {contributions.filter((c) => c.status === 'OVERDUE').length}
                </p>
              </div>
              <div className="rounded-2xl bg-surface p-6 shadow-card">
                <p className="font-heading text-xs font-semibold uppercase tracking-widest text-muted">
                  Your pending requests
                </p>
                <p className="mt-2 font-mono text-3xl font-bold text-ink">
                  {pendingApprovals.filter((a) => a.requestedByMemberId === member?.id).length}
                </p>
              </div>
            </>
          )}
          {isSecretary && (
            <>
              <div className="rounded-2xl bg-surface p-6 shadow-card">
                <p className="font-heading text-xs font-semibold uppercase tracking-widest text-muted">Next meeting</p>
                {nextMeeting ? (
                  <>
                    <p className="mt-2 font-mono text-lg font-bold text-ink">{nextMeeting.meetingDate}</p>
                    <p className="mt-1 text-xs text-muted line-clamp-2">{nextMeeting.agenda}</p>
                  </>
                ) : (
                  <p className="mt-2 text-sm text-muted">No meeting scheduled yet</p>
                )}
              </div>
              <div className="rounded-2xl bg-surface p-6 shadow-card">
                <p className="font-heading text-xs font-semibold uppercase tracking-widest text-muted">
                  Open resolutions
                </p>
                <p className="mt-2 font-mono text-3xl font-bold text-ink">{openResolutionCount}</p>
              </div>
            </>
          )}
        </div>
      )}

      <div className={isManager ? 'grid gap-6 lg:grid-cols-2' : ''}>
        <div className="rounded-2xl bg-surface p-6 shadow-card">
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
          <div className="rounded-2xl bg-surface p-6 shadow-card">
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

      {showGoalModal && (
        <Modal title="Edit Savings Goal" onClose={() => setShowGoalModal(false)}>
          <form onSubmit={handleGoalSubmit} className="space-y-4">
            {goalNotice && (
              <FormError message={goalNotice} />
            )}
            <FormField label="Savings goal" htmlFor="dashboard-savings-goal" hint="Leave blank to clear the goal.">
              <Input
                id="dashboard-savings-goal"
                type="number"
                min="0"
                step="0.01"
                value={goalForm}
                onChange={(e) => setGoalForm(e.target.value)}
              />
            </FormField>
            <LoadingButton type="submit" loading={goalSaving} className="w-full">
              Save
            </LoadingButton>
          </form>
        </Modal>
      )}

      {showWelfareGoalModal && (
        <Modal title="Edit Welfare Fund Goal" onClose={() => setShowWelfareGoalModal(false)}>
          <form onSubmit={handleWelfareGoalSubmit} className="space-y-4">
            {welfareGoalNotice && (
              <FormError message={welfareGoalNotice} />
            )}
            <FormField label="Welfare fund goal" htmlFor="dashboard-welfare-goal" hint="Leave blank to clear the goal.">
              <Input
                id="dashboard-welfare-goal"
                type="number"
                min="0"
                step="0.01"
                value={welfareGoalForm}
                onChange={(e) => setWelfareGoalForm(e.target.value)}
              />
            </FormField>
            <LoadingButton type="submit" loading={welfareGoalSaving} className="w-full">
              Save
            </LoadingButton>
          </form>
        </Modal>
      )}
    </div>
  )
}
