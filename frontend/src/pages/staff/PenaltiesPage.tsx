import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  getPenalties,
  getMyPenalties,
  createPenalty,
  approvePenalty,
  waivePenalty,
  settlePenalty,
  type Penalty,
  type PenaltyReason,
  type PenaltyStatus,
} from '../../api/penalties'
import { getMembers, type Member } from '../../api/members'
import { extractErrorMessage } from '../../api/client'
import { useMyMembership } from '../../hooks/useMyMembership'
import { usePagination } from '../../hooks/usePagination'
import LoadFailed from '../../components/ui/LoadFailed'
import { TablePageSkeleton } from '../../components/ui/SkeletonLayouts'
import { Table, type TableColumn } from '../../components/ui/Table'
import LoadingButton from '../../components/ui/LoadingButton'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import Modal from '../../components/ui/Modal'
import FormError from '../../components/ui/FormError'
import FormField from '../../components/ui/FormField'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import Textarea from '../../components/ui/Textarea'
import Pagination from '../../components/ui/Pagination'
import TransientAlert from '../../components/ui/TransientAlert'
import EmptyState from '../../components/ui/EmptyState'
import StatTile from '../../components/ui/StatTile'
import Reveal from '../../components/ui/Reveal'
import { formatMoney } from '../../utils/money'
import { formatDate } from '../../utils/dates'
import { useChamaCurrency } from '../../hooks/useChamaCurrency'

const EMPTY_FORM = { memberId: '', reason: 'LATE_CONTRIBUTION' as PenaltyReason, amount: '' }

const REASON_LABELS: Record<PenaltyReason, string> = {
  LATE_CONTRIBUTION: 'Late contribution',
  MISSED_MEETING: 'Missed meeting',
  LOAN_DEFAULT: 'Loan default',
  OTHER: 'Other',
}

function statusVariant(status: PenaltyStatus) {
  if (status === 'PAID') return 'success' as const
  if (status === 'WAIVED') return 'muted' as const
  if (status === 'APPROVED') return 'danger' as const
  return 'warning' as const
}

export default function PenaltiesPage() {
  const { chamaId: chamaIdParam } = useParams<{ chamaId: string }>()
  const chamaId = Number(chamaIdParam)
  const currency = useChamaCurrency(chamaId)

  const { isTreasurer, isChairperson, loading: roleLoading } = useMyMembership(chamaId)
  const canManage = isTreasurer || isChairperson

  const penaltyColumns: TableColumn<Penalty>[] = [
    ...(canManage
      ? [
          {
            key: 'member',
            header: 'Member',
            priority: 1 as const,
            render: (p: Penalty) => <span className="font-medium text-ink">{p.memberName}</span>,
          },
        ]
      : []),
    { key: 'reason', header: 'Reason', priority: 1, render: (p) => <>{REASON_LABELS[p.reason]}</> },
    {
      key: 'status',
      header: 'Status',
      priority: 1,
      render: (p) => (
        <>
          <Badge label={p.status} variant={statusVariant(p.status)} />
          {p.status === 'WAIVED' && p.waiverReason && (
            <p className="mt-1 text-xs text-muted">{p.waiverReason}</p>
          )}
        </>
      ),
    },
    { key: 'amount', header: 'Amount', render: (p) => <span className="font-mono">{formatMoney(p.amount, currency)}</span> },
    { key: 'issued', header: 'Issued', render: (p) => <span className="text-muted">{formatDate(p.imposedAt)}</span> },
    ...(canManage
      ? [
          {
            key: 'actions',
            header: 'Actions',
            render: (p: Penalty) => (
              <div className="flex flex-wrap justify-end gap-2">
                {p.status === 'PENDING' && (
                  <button
                    onClick={() =>
                      runAction(p, () => approvePenalty(chamaId, p.id), `Penalty for ${p.memberName} approved.`)
                    }
                    disabled={actingId === p.id}
                    className="text-xs text-brand hover:underline disabled:opacity-50"
                  >
                    Approve
                  </button>
                )}
                {(p.status === 'PENDING' || p.status === 'APPROVED') && (
                  <button
                    onClick={() => {
                      setWaiverReason('')
                      setWaiving(p)
                    }}
                    disabled={actingId === p.id}
                    className="text-xs text-muted hover:underline disabled:opacity-50"
                  >
                    Waive
                  </button>
                )}
                {p.status === 'APPROVED' && (
                  <button
                    onClick={() =>
                      runAction(p, () => settlePenalty(chamaId, p.id), `Penalty for ${p.memberName} settled.`)
                    }
                    disabled={actingId === p.id}
                    className="text-xs text-success hover:underline disabled:opacity-50"
                  >
                    Record payment
                  </button>
                )}
              </div>
            ),
          },
        ]
      : []),
  ]

  const [penalties, setPenalties] = useState<Penalty[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [notice, setNotice] = useState<{ variant: 'success' | 'error'; message: string } | null>(null)
  const [actingId, setActingId] = useState<number | null>(null)

  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [modalNotice, setModalNotice] = useState<string | null>(null)

  const [waiving, setWaiving] = useState<Penalty | null>(null)
  const [waiverReason, setWaiverReason] = useState('')
  const [waiverSaving, setWaiverSaving] = useState(false)

  const { page, totalPages, total, pageSize, pageItems, setPage } = usePagination(penalties)

  const refresh = () => {
    if (roleLoading) return
    setLoading(true)
    setLoadError(null)
    const penaltiesPromise = canManage ? getPenalties(chamaId) : getMyPenalties(chamaId)
    Promise.all([penaltiesPromise, canManage ? getMembers(chamaId) : Promise.resolve([])])
      .then(([p, m]) => {
        setPenalties(p)
        setMembers(m)
      })
      // A failed load has to be distinguishable from having no penalties, otherwise a server
      // error reads as good news.
      .catch((err) => setLoadError(extractErrorMessage(err)))
      .finally(() => setLoading(false))
  }

  useEffect(refresh, [chamaId, canManage, roleLoading])

  const outstanding = penalties
    .filter((p) => p.status === 'APPROVED')
    .reduce((sum, p) => sum + p.amount, 0)
  const awaitingDecision = penalties.filter((p) => p.status === 'PENDING').length

  const openCreate = () => {
    setForm(EMPTY_FORM)
    setModalNotice(null)
    setShowCreate(true)
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setModalNotice(null)
    try {
      await createPenalty(chamaId, {
        memberId: Number(form.memberId),
        reason: form.reason,
        amount: Number(form.amount),
      })
      setNotice({ variant: 'success', message: 'Penalty issued.' })
      setShowCreate(false)
      refresh()
    } catch (err) {
      setModalNotice(extractErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const runAction = async (penalty: Penalty, action: () => Promise<unknown>, success: string) => {
    setActingId(penalty.id)
    try {
      await action()
      setNotice({ variant: 'success', message: success })
      refresh()
    } catch (err) {
      setNotice({ variant: 'error', message: extractErrorMessage(err) })
    } finally {
      setActingId(null)
    }
  }

  const handleWaive = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!waiving) return
    const penalty = waiving
    setWaiverSaving(true)
    try {
      await runAction(
        penalty,
        () => waivePenalty(chamaId, penalty.id, waiverReason),
        `Penalty for ${penalty.memberName} waived.`,
      )
      setWaiving(null)
      setWaiverReason('')
    } finally {
      setWaiverSaving(false)
    }
  }

  return (
    <div data-testid="page-penalties" className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold text-ink">Penalties</h1>
          <p className="text-sm text-muted">
            {canManage
              ? 'Fines issued for late contributions, missed meetings and loan defaults.'
              : 'Fines recorded against you.'}
          </p>
        </div>
        {canManage && <Button onClick={openCreate}>Issue penalty</Button>}
      </div>

      {notice && (
        <TransientAlert variant={notice.variant} message={notice.message} onDismiss={() => setNotice(null)} />
      )}

      {canManage && !loading && !loadError && (
        <Reveal>
          <div className="grid gap-4 sm:grid-cols-2">
            <StatTile label="Outstanding" value={formatMoney(outstanding, currency)} detail="Approved and unpaid" />
            <StatTile label="Awaiting decision" value={awaitingDecision} detail="Issued but not yet approved or waived" />
          </div>
        </Reveal>
      )}

      {loading ? (
        <TablePageSkeleton />
      ) : loadError ? (
        <LoadFailed what="penalties" detail={loadError} onRetry={refresh} />
      ) : penalties.length === 0 ? (
        <EmptyState
          title={canManage ? 'No penalties issued' : 'No penalties against you'}
          description={
            canManage
              ? 'Penalties you issue for late contributions or missed meetings appear here.'
              : 'Nothing outstanding. Penalties issued against you would show here.'
          }
        />
      ) : (
        <Reveal>
          <Table
            data-testid="penalties-table"
            columns={penaltyColumns}
            rows={pageItems}
            rowKey={(penalty) => penalty.id}
            rowTestId={(penalty) => `penalty-row-${penalty.id}`}
          />
          <Pagination
            page={page}
            totalPages={totalPages}
            total={total}
            pageSize={pageSize}
            onPage={setPage}
            label="penalties"
          />
        </Reveal>
      )}

      {showCreate && (
        <Modal title="Issue penalty" onClose={() => setShowCreate(false)}>
          <form onSubmit={handleCreate} className="space-y-4">
            <FormError message={modalNotice} />
            <FormField label="Member" htmlFor="penalty-member" required>
              <Select
                id="penalty-member"
                value={form.memberId}
                onChange={(value) => setForm({ ...form, memberId: value })}
                required
              >
                <option value="">Select a member</option>
                {members.map((m) => (
                  <option key={m.id} value={String(m.id)}>
                    {m.fullName}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Reason" htmlFor="penalty-reason" required>
              <Select
                id="penalty-reason"
                value={form.reason}
                onChange={(value) => setForm({ ...form, reason: value as PenaltyReason })}
                required
              >
                {(Object.keys(REASON_LABELS) as PenaltyReason[]).map((reason) => (
                  <option key={reason} value={reason}>
                    {REASON_LABELS[reason]}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Amount" htmlFor="penalty-amount" required hint="In the chama's currency.">
              <Input
                id="penalty-amount"
                type="number"
                min="1"
                step="1"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                required
              />
            </FormField>
            <div className="flex gap-3">
              <LoadingButton type="submit" loading={saving} loadingText="Issuing…" className="flex-1">
                Issue penalty
              </LoadingButton>
              <Button variant="secondary" onClick={() => setShowCreate(false)} className="flex-1">
                Cancel
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {waiving && (
        <Modal title={`Waive penalty for ${waiving.memberName}`} onClose={() => setWaiving(null)}>
          <form onSubmit={handleWaive} className="space-y-4">
            <p className="text-sm text-ink/80">
              Waiving cancels {formatMoney(waiving.amount, currency)} for {REASON_LABELS[waiving.reason].toLowerCase()}.
            </p>
            <FormField
              label="Reason for waiving"
              htmlFor="waiver-reason"
              required
              hint="Recorded against the penalty, so the decision can be explained later."
            >
              <Textarea
                id="waiver-reason"
                value={waiverReason}
                onChange={(e) => setWaiverReason(e.target.value)}
                rows={3}
                required
              />
            </FormField>
            <div className="flex gap-3">
              <LoadingButton type="submit" loading={waiverSaving} loadingText="Waiving…" className="flex-1">
                Waive penalty
              </LoadingButton>
              <Button variant="secondary" onClick={() => setWaiving(null)} className="flex-1">
                Cancel
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
