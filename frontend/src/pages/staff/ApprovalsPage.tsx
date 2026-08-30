import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  getApprovals,
  requestApproval,
  approveApproval,
  rejectApproval,
  type Approval,
  type ApprovalTargetType,
} from '../../api/approvals'
import { getMembers, type Member } from '../../api/members'
import { getLoans, type Loan } from '../../api/loans'
import { getPayouts, type Payout } from '../../api/payouts'
import { extractErrorMessage } from '../../api/client'
import { useMyMembership } from '../../hooks/useMyMembership'
import { usePagination } from '../../hooks/usePagination'
import LoadFailed from '../../components/ui/LoadFailed'
import EmptyState from '../../components/ui/EmptyState'
import { TablePageSkeleton } from '../../components/ui/SkeletonLayouts'
import LoadingButton from '../../components/ui/LoadingButton'
import Button from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'
import FormError from '../../components/ui/FormError'
import ApprovalStampBadge from '../../components/marketing/ApprovalStampBadge'
import SignOffTrail from '../../components/marketing/SignOffTrail'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui/Table'
import TransientAlert from '../../components/ui/TransientAlert'
import FormField from '../../components/ui/FormField'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import Pagination from '../../components/ui/Pagination'

const EMPTY_FORM = { targetType: 'LOAN_DISBURSEMENT' as ApprovalTargetType, targetId: '', memberId: '', amount: '', reason: '' }

// A record rather than a ternary, so adding a target type is a compile error here instead of
// silently labelling the new kind as whichever branch the ternary fell through to.
const TARGET_TYPE_LABELS: Record<ApprovalTargetType, string> = {
  LOAN_DISBURSEMENT: 'Loan disbursement',
  PAYOUT_DISBURSEMENT: 'Payout disbursement',
  WELFARE_WITHDRAWAL: 'Welfare fund withdrawal',
}

function targetTypeLabel(type: ApprovalTargetType) {
  return TARGET_TYPE_LABELS[type]
}

export default function ApprovalsPage() {
  const { chamaId: chamaIdParam } = useParams<{ chamaId: string }>()
  const chamaId = Number(chamaIdParam)
  const { member, loading: roleLoading } = useMyMembership(chamaId)

  const [approvals, setApprovals] = useState<Approval[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [loans, setLoans] = useState<Loan[]>([])
  const [payouts, setPayouts] = useState<Payout[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [notice, setNotice] = useState<{ variant: 'success' | 'error'; message: string } | null>(null)
  const [modalNotice, setModalNotice] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [actingId, setActingId] = useState<number | null>(null)
  const { page, totalPages, total, pageSize, pageItems, setPage } = usePagination(approvals)

  const refresh = () => {
    if (roleLoading) return
    setLoading(true)
    setLoadError(null)
    Promise.all([getApprovals(chamaId), getMembers(chamaId), getLoans(chamaId), getPayouts(chamaId)])
      .then(([a, m, l, p]) => {
        setApprovals(a)
        setMembers(m)
        setLoans(l)
        setPayouts(p)
      })
      .catch((err) => setLoadError(extractErrorMessage(err)))
      .finally(() => setLoading(false))
  }

  useEffect(refresh, [chamaId, roleLoading])

  const openCreate = () => {
    setForm(EMPTY_FORM)
    setModalNotice(null)
    setShowCreateModal(true)
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setModalNotice(null)
    try {
      await requestApproval(chamaId, {
        targetType: form.targetType,
        targetId: Number(form.targetId),
        memberId: Number(form.memberId),
        amount: Number(form.amount),
        reason: form.reason || undefined,
      })
      setNotice({ variant: 'success', message: 'Approval request opened.' })
      setShowCreateModal(false)
      refresh()
    } catch (err) {
      setModalNotice(extractErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const handleApprove = async (approval: Approval) => {
    setActingId(approval.id)
    try {
      const updated = await approveApproval(chamaId, approval.id)
      setNotice({
        variant: 'success',
        message: updated.status === 'APPROVED'
          ? `Dual sign-off cleared for ${approval.memberName}.`
          : 'First sign-off recorded, a different signatory must approve next.',
      })
      refresh()
    } catch (err) {
      setNotice({ variant: 'error', message: extractErrorMessage(err) })
    } finally {
      setActingId(null)
    }
  }

  const handleReject = async (approval: Approval) => {
    setActingId(approval.id)
    try {
      await rejectApproval(chamaId, approval.id)
      setNotice({ variant: 'success', message: `Approval request for ${approval.memberName} rejected.` })
      refresh()
    } catch (err) {
      setNotice({ variant: 'error', message: extractErrorMessage(err) })
    } finally {
      setActingId(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl font-bold text-ink">Approvals</h1>
        <Button onClick={openCreate}>+ Request Approval</Button>
      </div>

      <TransientAlert variant={notice?.variant ?? 'success'} message={notice?.message ?? null} onDismiss={() => setNotice(null)} />

      {loading || roleLoading ? (
        <TablePageSkeleton withFilter={false} />
      ) : loadError ? (
        <LoadFailed what="approvals" detail={loadError} onRetry={refresh} />
      ) : (
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Member</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead>Sign-off</TableHead>
              <TableHead>Status</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {approvals.length === 0 && (
              <TableRow>
                  <TableCell colSpan={7}>
                    <EmptyState title="No approval requests yet" description="Requests appear here when a loan or payout is above this chama's threshold." />
                  </TableCell>
                </TableRow>
            )}
            {pageItems.map((approval) => {
              const alreadySignedByMe = member != null && approval.firstApproverMemberId === member.id
              return (
                <TableRow key={approval.id}>
                  <TableCell className="font-medium text-ink">{approval.memberName}</TableCell>
                  <TableCell className="text-muted">{targetTypeLabel(approval.targetType)}</TableCell>
                  <TableCell className="font-mono text-muted">{approval.amount.toLocaleString()}</TableCell>
                  <TableCell className="text-muted">{approval.reason || '—'}</TableCell>
                  <TableCell>
                    <SignOffTrail requestedByName={approval.requestedByName} firstApproverName={approval.firstApproverName} />
                  </TableCell>
                  <TableCell><ApprovalStampBadge status={approval.status} /></TableCell>
                  <TableCell>
                    {approval.status === 'PENDING' && (
                      <div className="flex items-center justify-end gap-3">
                        <button
                          onClick={() => handleApprove(approval)}
                          disabled={actingId === approval.id || alreadySignedByMe}
                          title={alreadySignedByMe ? 'A different signatory must provide the second sign-off' : undefined}
                          className="text-brand text-xs hover:underline disabled:opacity-50"
                        >
                          {actingId === approval.id ? 'Signing…' : 'Sign off'}
                        </button>
                        <button
                          onClick={() => handleReject(approval)}
                          disabled={actingId === approval.id}
                          className="text-danger text-xs hover:underline disabled:opacity-50"
                        >
                          Reject
                        </button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      )}

      {!loading && !roleLoading && (
        <Pagination page={page} totalPages={totalPages} total={total} pageSize={pageSize} onPage={setPage} label="approvals" />
      )}

      {showCreateModal && (
        <Modal title="Request Approval" onClose={() => setShowCreateModal(false)}>
          <form onSubmit={handleCreate} className="space-y-4">
            {modalNotice && (
              <FormError message={modalNotice} />
            )}
            <FormField label="Type" htmlFor="approval-target-type" required>
              <Select id="approval-target-type" required value={form.targetType}
                onChange={(v) => setForm({ ...form, targetType: v as ApprovalTargetType, targetId: '' })}>
                <option value="LOAN_DISBURSEMENT">Loan disbursement</option>
                <option value="PAYOUT_DISBURSEMENT">Payout disbursement</option>
                {/*
                  No welfare withdrawal option. Requesting one opens its own approval, for the
                  exact amount, at the moment the withdrawal is created. Offering it here would let
                  someone raise a second approval against the same withdrawal, or one carrying an
                  amount that does not match it.
                */}
              </Select>
            </FormField>
            {form.targetType === 'LOAN_DISBURSEMENT' ? (
              <FormField label="Loan" htmlFor="approval-target-id" required>
                <Select id="approval-target-id" required value={form.targetId}
                  onChange={(v) => setForm({ ...form, targetId: v })}>
                  <option value="" disabled>Select a loan</option>
                  {loans.map((l) => (
                    <option key={l.id} value={l.id}>{l.memberName} &middot; {l.principal.toLocaleString()}</option>
                  ))}
                </Select>
              </FormField>
            ) : (
              <FormField label="Payout" htmlFor="approval-target-id" required>
                <Select id="approval-target-id" required value={form.targetId}
                  onChange={(v) => setForm({ ...form, targetId: v })}>
                  <option value="" disabled>Select a payout</option>
                  {payouts.map((p) => (
                    <option key={p.id} value={p.id}>{p.memberName} &middot; round {p.roundNumber}</option>
                  ))}
                </Select>
              </FormField>
            )}
            <FormField label="Member" htmlFor="approval-member" required>
              <Select id="approval-member" required value={form.memberId} onChange={(v) => setForm({ ...form, memberId: v })}>
                <option value="" disabled>Select a member</option>
                {members.map((m) => <option key={m.id} value={m.id}>{m.fullName}</option>)}
              </Select>
            </FormField>
            <FormField label="Amount" htmlFor="approval-amount" required>
              <Input id="approval-amount" required type="number" min="0" step="0.01" value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })} />
            </FormField>
            <FormField label="Reason" htmlFor="approval-reason">
              <Input id="approval-reason" value={form.reason}
                onChange={(e) => setForm({ ...form, reason: e.target.value })} />
            </FormField>
            <LoadingButton type="submit" loading={saving} loadingText="Requesting…" className="w-full">
              Request Approval
            </LoadingButton>
          </form>
        </Modal>
      )}
    </div>
  )
}
