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
import { TablePageSkeleton } from '../../components/ui/SkeletonLayouts'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui/Table'
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

const formatMoney = (amount: number) => `KES ${amount.toLocaleString()}`

export default function PenaltiesPage() {
  const { chamaId: chamaIdParam } = useParams<{ chamaId: string }>()
  const chamaId = Number(chamaIdParam)
  const { isTreasurer, isChairperson, loading: roleLoading } = useMyMembership(chamaId)
  const canManage = isTreasurer || isChairperson

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
            <StatTile label="Outstanding" value={formatMoney(outstanding)} detail="Approved and unpaid" />
            <StatTile label="Awaiting decision" value={awaitingDecision} detail="Issued but not yet approved or waived" />
          </div>
        </Reveal>
      )}

      {loading ? (
        <TablePageSkeleton />
      ) : loadError ? (
        <FormError message={loadError} />
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
          <Table data-testid="penalties-table">
            <TableHeader>
              <TableRow>
                {canManage && <TableHead>Member</TableHead>}
                <TableHead>Reason</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Issued</TableHead>
                {canManage && <TableHead>Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageItems.map((penalty) => (
                <TableRow key={penalty.id} data-testid={`penalty-row-${penalty.id}`}>
                  {canManage && <TableCell className="font-medium text-ink">{penalty.memberName}</TableCell>}
                  <TableCell>{REASON_LABELS[penalty.reason]}</TableCell>
                  <TableCell className="font-mono">{formatMoney(penalty.amount)}</TableCell>
                  <TableCell>
                    <Badge label={penalty.status} variant={statusVariant(penalty.status)} />
                    {penalty.status === 'WAIVED' && penalty.waiverReason && (
                      <p className="mt-1 text-xs text-muted">{penalty.waiverReason}</p>
                    )}
                  </TableCell>
                  <TableCell className="text-muted">
                    {new Date(penalty.imposedAt).toLocaleDateString()}
                  </TableCell>
                  {canManage && (
                    <TableCell>
                      <div className="flex flex-wrap gap-2">
                        {penalty.status === 'PENDING' && (
                          <button
                            onClick={() =>
                              runAction(
                                penalty,
                                () => approvePenalty(chamaId, penalty.id),
                                `Penalty for ${penalty.memberName} approved.`,
                              )
                            }
                            disabled={actingId === penalty.id}
                            className="text-xs text-brand hover:underline disabled:opacity-50"
                          >
                            Approve
                          </button>
                        )}
                        {(penalty.status === 'PENDING' || penalty.status === 'APPROVED') && (
                          <button
                            onClick={() => {
                              setWaiverReason('')
                              setWaiving(penalty)
                            }}
                            disabled={actingId === penalty.id}
                            className="text-xs text-muted hover:underline disabled:opacity-50"
                          >
                            Waive
                          </button>
                        )}
                        {penalty.status === 'APPROVED' && (
                          <button
                            onClick={() =>
                              runAction(
                                penalty,
                                () => settlePenalty(chamaId, penalty.id),
                                `Penalty for ${penalty.memberName} settled.`,
                              )
                            }
                            disabled={actingId === penalty.id}
                            className="text-xs text-success hover:underline disabled:opacity-50"
                          >
                            Record payment
                          </button>
                        )}
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
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
              Waiving cancels {formatMoney(waiving.amount)} for {REASON_LABELS[waiving.reason].toLowerCase()}.
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
