import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  getContributions,
  getMyContributions,
  createContribution,
  recordPayment,
  deleteContribution,
  payContributionWithMpesa,
  type Contribution,
  type PaymentMethod,
} from '../../api/contributions'
import { getMembers, type Member } from '../../api/members'
import { extractErrorMessage } from '../../api/client'
import { useMyMembership } from '../../hooks/useMyMembership'
import { TablePageSkeleton } from '../../components/ui/SkeletonLayouts'
import LoadingButton from '../../components/ui/LoadingButton'
import Badge from '../../components/ui/Badge'
import Modal from '../../components/ui/Modal'
import TransientAlert from '../../components/ui/TransientAlert'

const EMPTY_CONTRIBUTION_FORM = { memberId: '', period: '', amountDue: '' }
const EMPTY_PAYMENT_FORM = { amount: '', method: 'MPESA' as PaymentMethod }

function statusVariant(status: Contribution['status']) {
  if (status === 'PAID') return 'success' as const
  if (status === 'PARTIAL') return 'warning' as const
  if (status === 'OVERDUE') return 'danger' as const
  return 'muted' as const
}

export default function ContributionsPage() {
  const { chamaId: chamaIdParam } = useParams<{ chamaId: string }>()
  const chamaId = Number(chamaIdParam)
  const { isTreasurer, isChairperson, member, loading: roleLoading } = useMyMembership(chamaId)
  const canManage = isTreasurer || isChairperson

  const [contributions, setContributions] = useState<Contribution[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [notice, setNotice] = useState<{ variant: 'success' | 'error'; message: string } | null>(null)
  const [modalNotice, setModalNotice] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [payingContribution, setPayingContribution] = useState<Contribution | null>(null)
  const [mpesaConfirm, setMpesaConfirm] = useState<Contribution | null>(null)
  const [sendingStkPush, setSendingStkPush] = useState(false)
  const [createForm, setCreateForm] = useState(EMPTY_CONTRIBUTION_FORM)
  const [paymentForm, setPaymentForm] = useState(EMPTY_PAYMENT_FORM)

  const refresh = () => {
    if (roleLoading) return
    setLoading(true)
    const contributionsPromise = canManage ? getContributions(chamaId) : getMyContributions(chamaId)
    Promise.all([contributionsPromise, canManage ? getMembers(chamaId) : Promise.resolve([])])
      .then(([c, m]) => {
        setContributions(c)
        setMembers(m)
      })
      .finally(() => setLoading(false))
  }

  useEffect(refresh, [chamaId, canManage, roleLoading])

  const openCreate = () => {
    setCreateForm(EMPTY_CONTRIBUTION_FORM)
    setModalNotice(null)
    setShowCreateModal(true)
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setModalNotice(null)
    try {
      await createContribution(chamaId, {
        memberId: Number(createForm.memberId),
        period: createForm.period,
        amountDue: Number(createForm.amountDue),
      })
      setNotice({ variant: 'success', message: 'Contribution recorded.' })
      setShowCreateModal(false)
      refresh()
    } catch (err) {
      setModalNotice(extractErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const openPayment = (contribution: Contribution) => {
    setPayingContribution(contribution)
    setPaymentForm(EMPTY_PAYMENT_FORM)
    setModalNotice(null)
  }

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!payingContribution) return
    setSaving(true)
    setModalNotice(null)
    try {
      await recordPayment(chamaId, payingContribution.id, Number(paymentForm.amount), paymentForm.method)
      setNotice({ variant: 'success', message: `Payment recorded for ${payingContribution.memberName}.` })
      setPayingContribution(null)
      refresh()
    } catch (err) {
      setModalNotice(extractErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const openMpesaConfirm = (contribution: Contribution) => {
    setMpesaConfirm(contribution)
    setModalNotice(null)
  }

  const handleConfirmMpesaPush = async () => {
    if (!mpesaConfirm) return
    setSendingStkPush(true)
    setModalNotice(null)
    try {
      await payContributionWithMpesa(chamaId, mpesaConfirm.id)
      setNotice({ variant: 'success', message: 'M-Pesa prompt sent. Check your phone to complete payment.' })
      setMpesaConfirm(null)
      refresh()
    } catch (err) {
      setModalNotice(extractErrorMessage(err))
    } finally {
      setSendingStkPush(false)
    }
  }

  const handleDelete = async (contribution: Contribution) => {
    if (!confirm(`Delete this contribution for ${contribution.memberName}?`)) return
    try {
      await deleteContribution(chamaId, contribution.id)
      setNotice({ variant: 'success', message: 'Contribution deleted.' })
      refresh()
    } catch (err) {
      setNotice({ variant: 'error', message: extractErrorMessage(err) })
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl font-bold text-ink">
          {canManage ? 'Contributions' : 'My Contributions'}
        </h1>
        {canManage && (
          <button
            onClick={openCreate}
            className="bg-primary text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-primary-dark"
          >
            + New Contribution
          </button>
        )}
      </div>

      <TransientAlert variant={notice?.variant ?? 'success'} message={notice?.message ?? null} onDismiss={() => setNotice(null)} />

      {loading || roleLoading ? (
        <TablePageSkeleton withFilter={false} withButton={canManage} />
      ) : (
        <div className="bg-white rounded-2xl shadow-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-paper-dim border-b border-black/10">
              <tr>
                {canManage && <th className="text-left px-4 py-3 font-medium text-ink/80">Member</th>}
                <th className="text-left px-4 py-3 font-medium text-ink/80">Period</th>
                <th className="text-left px-4 py-3 font-medium text-ink/80">Due</th>
                <th className="text-left px-4 py-3 font-medium text-ink/80">Paid</th>
                <th className="text-left px-4 py-3 font-medium text-ink/80">Status</th>
                <th />
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5">
              {contributions.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-muted text-sm">No contributions yet.</td></tr>
              )}
              {contributions.map((c) => (
                <tr key={c.id} className="hover:bg-paper-dim/30">
                  {canManage && <td className="px-4 py-3 font-medium text-ink">{c.memberName}</td>}
                  <td className="px-4 py-3 text-muted">{c.period}</td>
                  <td className="px-4 py-3 font-mono text-muted">{c.amountDue.toLocaleString()}</td>
                  <td className="px-4 py-3 font-mono text-muted">{c.amountPaid.toLocaleString()}</td>
                  <td className="px-4 py-3"><Badge label={c.status} variant={statusVariant(c.status)} /></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-3">
                      {canManage ? (
                        <>
                          {c.status !== 'PAID' && (
                            <button onClick={() => openPayment(c)} className="text-primary text-xs hover:underline">Record Payment</button>
                          )}
                          <button onClick={() => handleDelete(c)} className="text-danger text-xs hover:underline">Delete</button>
                        </>
                      ) : (
                        c.status !== 'PAID' && (
                          <button onClick={() => openMpesaConfirm(c)} className="text-primary text-xs hover:underline">Pay via M-Pesa</button>
                        )
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showCreateModal && (
        <Modal title="New Contribution" onClose={() => setShowCreateModal(false)}>
          <form onSubmit={handleCreate} className="space-y-4">
            {modalNotice && (
              <div className="bg-danger/10 border border-danger/25 text-danger text-sm rounded-lg px-3 py-2">{modalNotice}</div>
            )}
            <div>
              <label htmlFor="contribution-member" className="block text-sm font-medium text-ink/80 mb-1">Member *</label>
              <select id="contribution-member" required value={createForm.memberId}
                onChange={(e) => setCreateForm({ ...createForm, memberId: e.target.value })}
                className="w-full border border-black/15 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                <option value="" disabled>Select a member</option>
                {members.map((m) => <option key={m.id} value={m.id}>{m.fullName}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="contribution-period" className="block text-sm font-medium text-ink/80 mb-1">Period *</label>
              <input id="contribution-period" required type="date" value={createForm.period}
                onChange={(e) => setCreateForm({ ...createForm, period: e.target.value })}
                className="w-full border border-black/15 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
            </div>
            <div>
              <label htmlFor="contribution-amount" className="block text-sm font-medium text-ink/80 mb-1">Amount due *</label>
              <input id="contribution-amount" required type="number" min="0" step="0.01" value={createForm.amountDue}
                onChange={(e) => setCreateForm({ ...createForm, amountDue: e.target.value })}
                className="w-full border border-black/15 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
            </div>
            <LoadingButton type="submit" loading={saving} loadingText="Saving…"
              className="w-full bg-primary text-white font-semibold py-2.5 rounded-xl hover:bg-primary-dark disabled:opacity-50">
              Create Contribution
            </LoadingButton>
          </form>
        </Modal>
      )}

      {payingContribution && (
        <Modal title={`Record Payment — ${payingContribution.memberName}`} onClose={() => setPayingContribution(null)}>
          <form onSubmit={handleRecordPayment} className="space-y-4">
            {modalNotice && (
              <div className="bg-danger/10 border border-danger/25 text-danger text-sm rounded-lg px-3 py-2">{modalNotice}</div>
            )}
            <p className="text-sm text-muted">
              Due {payingContribution.amountDue.toLocaleString()}, already paid {payingContribution.amountPaid.toLocaleString()}.
            </p>
            <div>
              <label htmlFor="payment-amount" className="block text-sm font-medium text-ink/80 mb-1">Amount *</label>
              <input id="payment-amount" required type="number" min="0" step="0.01" value={paymentForm.amount}
                onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                className="w-full border border-black/15 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
            </div>
            <div>
              <label htmlFor="payment-method" className="block text-sm font-medium text-ink/80 mb-1">Method *</label>
              <select id="payment-method" value={paymentForm.method}
                onChange={(e) => setPaymentForm({ ...paymentForm, method: e.target.value as PaymentMethod })}
                className="w-full border border-black/15 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                <option value="MPESA">M-Pesa</option>
                <option value="CARD">Card</option>
                <option value="CASH">Cash</option>
                <option value="BANK">Bank</option>
              </select>
            </div>
            <LoadingButton type="submit" loading={saving} loadingText="Saving…"
              className="w-full bg-primary text-white font-semibold py-2.5 rounded-xl hover:bg-primary-dark disabled:opacity-50">
              Record Payment
            </LoadingButton>
          </form>
        </Modal>
      )}

      {mpesaConfirm && (
        <Modal title="Confirm M-Pesa Payment" onClose={() => setMpesaConfirm(null)}>
          <div className="space-y-4">
            {modalNotice && (
              <div className="bg-danger/10 border border-danger/25 text-danger text-sm rounded-lg px-3 py-2">{modalNotice}</div>
            )}
            <p className="text-sm text-ink/80">Send an M-Pesa prompt to your registered phone for:</p>
            <div className="bg-paper-dim rounded-xl p-4 space-y-1">
              <p className="text-xs text-muted">{mpesaConfirm.period}</p>
              <p className="font-mono text-2xl font-bold text-primary">
                KES {(mpesaConfirm.amountDue - mpesaConfirm.amountPaid).toLocaleString()}
              </p>
              {member?.phone && <p className="text-xs text-muted">To {member.phone}</p>}
            </div>
            <p className="text-xs text-muted">Complete the PIN prompt on your phone to finish payment.</p>
            <div className="flex gap-3">
              <LoadingButton
                onClick={handleConfirmMpesaPush}
                loading={sendingStkPush}
                loadingText="Sending…"
                className="flex-1 bg-primary text-white font-semibold py-2.5 rounded-xl hover:bg-primary-dark disabled:opacity-50"
              >
                Send Prompt
              </LoadingButton>
              <button
                onClick={() => setMpesaConfirm(null)}
                className="flex-1 border border-black/15 text-ink/80 font-semibold py-2.5 rounded-xl hover:bg-paper-dim"
              >
                Cancel
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
