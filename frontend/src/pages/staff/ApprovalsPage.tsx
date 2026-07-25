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
import { TablePageSkeleton } from '../../components/ui/SkeletonLayouts'
import LoadingButton from '../../components/ui/LoadingButton'
import Button from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'
import ApprovalStampBadge from '../../components/marketing/ApprovalStampBadge'
import SignOffTrail from '../../components/marketing/SignOffTrail'
import TransientAlert from '../../components/ui/TransientAlert'
import FormField from '../../components/ui/FormField'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import Pagination from '../../components/ui/Pagination'

const EMPTY_FORM = { targetType: 'LOAN_DISBURSEMENT' as ApprovalTargetType, targetId: '', memberId: '', amount: '', reason: '' }

function targetTypeLabel(type: ApprovalTargetType) {
  return type === 'LOAN_DISBURSEMENT' ? 'Loan disbursement' : 'Payout disbursement'
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
    Promise.all([getApprovals(chamaId), getMembers(chamaId), getLoans(chamaId), getPayouts(chamaId)])
      .then(([a, m, l, p]) => {
        setApprovals(a)
        setMembers(m)
        setLoans(l)
        setPayouts(p)
      })
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
      ) : (
        <div className="bg-white rounded-2xl shadow-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-paper-dim border-b border-black/10">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-ink/80">Member</th>
                <th className="text-left px-4 py-3 font-medium text-ink/80">Type</th>
                <th className="text-left px-4 py-3 font-medium text-ink/80">Amount</th>
                <th className="text-left px-4 py-3 font-medium text-ink/80">Reason</th>
                <th className="text-left px-4 py-3 font-medium text-ink/80">Sign-off</th>
                <th className="text-left px-4 py-3 font-medium text-ink/80">Status</th>
                <th />
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5">
              {approvals.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-muted text-sm">No approval requests yet.</td></tr>
              )}
              {pageItems.map((approval) => {
                const alreadySignedByMe = member != null && approval.firstApproverMemberId === member.id
                return (
                  <tr key={approval.id} className="hover:bg-paper-dim/30">
                    <td className="px-4 py-3 font-medium text-ink">{approval.memberName}</td>
                    <td className="px-4 py-3 text-muted">{targetTypeLabel(approval.targetType)}</td>
                    <td className="px-4 py-3 font-mono text-muted">{approval.amount.toLocaleString()}</td>
                    <td className="px-4 py-3 text-muted">{approval.reason || '—'}</td>
                    <td className="px-4 py-3">
                      <SignOffTrail requestedByName={approval.requestedByName} firstApproverName={approval.firstApproverName} />
                    </td>
                    <td className="px-4 py-3"><ApprovalStampBadge status={approval.status} /></td>
                    <td className="px-4 py-3">
                      {approval.status === 'PENDING' && (
                        <div className="flex items-center justify-end gap-3">
                          <button
                            onClick={() => handleApprove(approval)}
                            disabled={actingId === approval.id || alreadySignedByMe}
                            title={alreadySignedByMe ? 'A different signatory must provide the second sign-off' : undefined}
                            className="text-primary text-xs hover:underline disabled:opacity-50"
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
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {!loading && !roleLoading && (
        <Pagination page={page} totalPages={totalPages} total={total} pageSize={pageSize} onPage={setPage} label="approvals" />
      )}

      {showCreateModal && (
        <Modal title="Request Approval" onClose={() => setShowCreateModal(false)}>
          <form onSubmit={handleCreate} className="space-y-4">
            {modalNotice && (
              <div className="bg-danger/10 border border-danger/25 text-danger text-sm rounded-lg px-3 py-2">{modalNotice}</div>
            )}
            <FormField label="Type" htmlFor="approval-target-type" required>
              <Select id="approval-target-type" required value={form.targetType}
                onChange={(e) => setForm({ ...form, targetType: e.target.value as ApprovalTargetType, targetId: '' })}>
                <option value="LOAN_DISBURSEMENT">Loan disbursement</option>
                <option value="PAYOUT_DISBURSEMENT">Payout disbursement</option>
              </Select>
            </FormField>
            {form.targetType === 'LOAN_DISBURSEMENT' ? (
              <FormField label="Loan" htmlFor="approval-target-id" required>
                <Select id="approval-target-id" required value={form.targetId}
                  onChange={(e) => setForm({ ...form, targetId: e.target.value })}>
                  <option value="" disabled>Select a loan</option>
                  {loans.map((l) => (
                    <option key={l.id} value={l.id}>{l.memberName} &middot; {l.principal.toLocaleString()}</option>
                  ))}
                </Select>
              </FormField>
            ) : (
              <FormField label="Payout" htmlFor="approval-target-id" required>
                <Select id="approval-target-id" required value={form.targetId}
                  onChange={(e) => setForm({ ...form, targetId: e.target.value })}>
                  <option value="" disabled>Select a payout</option>
                  {payouts.map((p) => (
                    <option key={p.id} value={p.id}>{p.memberName} &middot; round {p.roundNumber}</option>
                  ))}
                </Select>
              </FormField>
            )}
            <FormField label="Member" htmlFor="approval-member" required>
              <Select id="approval-member" required value={form.memberId} onChange={(e) => setForm({ ...form, memberId: e.target.value })}>
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
