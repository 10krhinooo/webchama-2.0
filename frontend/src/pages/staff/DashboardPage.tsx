import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { getChama, type Chama } from '../../api/chamas'
import { getMembers } from '../../api/members'
import { getContributions, getMyContributions, type Contribution } from '../../api/contributions'
import { extractErrorMessage } from '../../api/client'
import { useMyMembership } from '../../hooks/useMyMembership'
import ContributionPot from '../../components/marketing/ContributionPot'
import { SkeletonBlock, SkeletonLine } from '../../components/ui/Skeleton'
import TransientAlert from '../../components/ui/TransientAlert'

function formatMoney(amount: number, currency: string) {
  return `${currency} ${amount.toLocaleString()}`
}

function sumProgress(contributions: Contribution[], currency: string) {
  const due = contributions.reduce((total, c) => total + c.amountDue, 0)
  const paid = contributions.reduce((total, c) => total + c.amountPaid, 0)
  const percent = due > 0 ? (paid / due) * 100 : 0
  return { percent, sublabel: `${formatMoney(paid, currency)} of ${formatMoney(due, currency)} collected` }
}

export default function DashboardPage() {
  const { chamaId: chamaIdParam } = useParams<{ chamaId: string }>()
  const chamaId = Number(chamaIdParam)
  const { isChairperson, isTreasurer, loading: roleLoading } = useMyMembership(chamaId)
  const isManager = isChairperson || isTreasurer

  const [chama, setChama] = useState<Chama | null>(null)
  const [memberCount, setMemberCount] = useState<number | null>(null)
  const [contributions, setContributions] = useState<Contribution[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (roleLoading) return
    let cancelled = false
    setLoading(true)
    Promise.all([
      getChama(chamaId),
      getMembers(chamaId),
      isManager ? getContributions(chamaId) : getMyContributions(chamaId),
    ])
      .then(([chamaData, members, contributionData]) => {
        if (cancelled) return
        setChama(chamaData)
        setMemberCount(members.length)
        setContributions(contributionData)
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold text-ink">{chama?.name ?? 'Dashboard'}</h1>
        <p className="text-sm text-muted">
          {isManager ? 'This cycle across all members' : 'Your contribution this cycle'}
        </p>
      </div>

      <TransientAlert variant="error" message={error} onDismiss={() => setError(null)} />

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl bg-white p-8 shadow-card">
          <ContributionPot
            percent={percent}
            label={isManager ? 'Chama collected' : 'You have paid'}
            sublabel={sublabel}
          />
        </div>

        <div className="space-y-4">
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
        </div>
      </div>
    </div>
  )
}
