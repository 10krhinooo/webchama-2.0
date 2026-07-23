import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  getLoans,
  getMyLoans,
  createLoan,
  approveLoan,
  getLoanRepayments,
  recordLoanRepayment,
  type Loan,
  type LoanRepayment,
  type InterestMethod,
} from '../../api/loans'
import { getMembers, type Member } from '../../api/members'
import { extractErrorMessage } from '../../api/client'
import { useMyMembership } from '../../hooks/useMyMembership'
import { usePagination } from '../../hooks/usePagination'
import { TablePageSkeleton } from '../../components/ui/SkeletonLayouts'
import LoadingButton from '../../components/ui/LoadingButton'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import Modal from '../../components/ui/Modal'
import TransientAlert from '../../components/ui/TransientAlert'
import FormField from '../../components/ui/FormField'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import Pagination from '../../components/ui/Pagination'

const EMPTY_FORM = { memberId: '', principal: '', interestRate: '', interestMethod: 'FLAT' as InterestMethod, termMonths: '' }
const EMPTY_PAYMENT_FORM = { amount: '' }

function loanStatusVariant(status: Loan['status']) {
  if (status === 'CLOSED') return 'success' as const
  if (status === 'DEFAULTED') return 'danger' as const
  if (status === 'REPAYING') return 'warning' as const
  if (status === 'APPROVED' || status === 'DISBURSED') return 'primary' as const
  return 'muted' as const
}

function repaymentStatusVariant(status: LoanRepayment['status']) {
  if (status === 'PAID') return 'success' as const
  if (status === 'PARTIAL') return 'warning' as const
  if (status === 'OVERDUE') return 'danger' as const
  return 'muted' as const
}

export default function LoansPage() {
  const { chamaId: chamaIdParam } = useParams<{ chamaId: string }>()
  const chamaId = Number(chamaIdParam)
  const { isTreasurer, isChairperson, member, loading: roleLoading } = useMyMembership(chamaId)
  const canManage = isTreasurer || isChairperson

  const [loans, setLoans] = useState<Loan[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [notice, setNotice] = useState<{ variant: 'success' | 'error'; message: string } | null>(null)
  const [modalNotice, setModalNotice] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [approvingId, setApprovingId] = useState<number | null>(null)
  const { page, totalPages, total, pageSize, pageItems, setPage } = usePagination(loans)

  const [scheduleLoan, setScheduleLoan] = useState<Loan | null>(null)
  const [repayments, setRepayments] = useState<LoanRepayment[]>([])
  const [scheduleLoading, setScheduleLoading] = useState(false)
  const [payingRepayment, setPayingRepayment] = useState<LoanRepayment | null>(null)
  const [paymentForm, setPaymentForm] = useState(EMPTY_PAYMENT_FORM)
  const [paymentSaving, setPaymentSaving] = useState(false)
  const [paymentNotice, setPaymentNotice] = useState<string | null>(null)

  const refresh = () => {
    if (roleLoading) return
    setLoading(true)
    const loansPromise = canManage ? getLoans(chamaId) : getMyLoans(chamaId)
    Promise.all([loansPromise, canManage ? getMembers(chamaId) : Promise.resolve([])])
      .then(([l, m]) => {
        setLoans(l)
        setMembers(m)
      })
      .finally(() => setLoading(false))
  }

  useEffect(refresh, [chamaId, canManage, roleLoading])

  const openCreate = () => {
    setForm({ ...EMPTY_FORM, memberId: canManage ? '' : String(member?.id ?? '') })
    setModalNotice(null)
    setShowCreateModal(true)
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setModalNotice(null)
    try {
      await createLoan(chamaId, {
        memberId: Number(form.memberId),
        principal: Number(form.principal),
        interestRate: Number(form.interestRate),
        interestMethod: form.interestMethod,
        termMonths: Number(form.termMonths),
      })
      setNotice({ variant: 'success', message: 'Loan requested.' })
      setShowCreateModal(false)
      refresh()
    } catch (err) {
      setModalNotice(extractErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const handleApprove = async (loan: Loan) => {
    setApprovingId(loan.id)
    try {
      await approveLoan(chamaId, loan.id)
      setNotice({ variant: 'success', message: `Loan for ${loan.memberName} approved.` })
      refresh()
    } catch (err) {
      setNotice({ variant: 'error', message: extractErrorMessage(err) })
    } finally {
      setApprovingId(null)
    }
  }

  const openSchedule = (loan: Loan) => {
    setScheduleLoan(loan)
    setScheduleLoading(true)
    getLoanRepayments(chamaId, loan.id)
      .then(setRepayments)
      .finally(() => setScheduleLoading(false))
  }

  const openPayment = (repayment: LoanRepayment) => {
    setPayingRepayment(repayment)
    setPaymentForm(EMPTY_PAYMENT_FORM)
    setPaymentNotice(null)
  }

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!scheduleLoan || !payingRepayment) return
    setPaymentSaving(true)
    setPaymentNotice(null)
    try {
      const updated = await recordLoanRepayment(chamaId, scheduleLoan.id, payingRepayment.id, Number(paymentForm.amount))
      setRepayments((current) => current.map((r) => (r.id === updated.id ? updated : r)))
      setPayingRepayment(null)
    } catch (err) {
      setPaymentNotice(extractErrorMessage(err))
    } finally {
      setPaymentSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl font-bold text-ink">{canManage ? 'Loans' : 'My Loans'}</h1>
        <Button onClick={openCreate}>+ Request Loan</Button>
      </div>

      <TransientAlert variant={notice?.variant ?? 'success'} message={notice?.message ?? null} onDismiss={() => setNotice(null)} />

      {loading || roleLoading ? (
        <TablePageSkeleton withFilter={false} />
      ) : (
        <div className="bg-white rounded-2xl shadow-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-paper-dim border-b border-black/10">
              <tr>
                {canManage && <th className="text-left px-4 py-3 font-medium text-ink/80">Member</th>}
                <th className="text-left px-4 py-3 font-medium text-ink/80">Principal</th>
                <th className="text-left px-4 py-3 font-medium text-ink/80">Interest</th>
                <th className="text-left px-4 py-3 font-medium text-ink/80">Term</th>
                <th className="text-left px-4 py-3 font-medium text-ink/80">Status</th>
                <th />
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5">
              {loans.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-muted text-sm">No loans yet.</td></tr>
              )}
              {pageItems.map((loan) => (
                <tr key={loan.id} className="hover:bg-paper-dim/30">
                  {canManage && <td className="px-4 py-3 font-medium text-ink">{loan.memberName}</td>}
                  <td className="px-4 py-3 font-mono text-muted">{loan.principal.toLocaleString()}</td>
                  <td className="px-4 py-3 text-muted">
                    {loan.interestRate}% ({loan.interestMethod === 'FLAT' ? 'Flat' : 'Reducing balance'})
                  </td>
                  <td className="px-4 py-3 text-muted">{loan.termMonths} mo</td>
                  <td className="px-4 py-3"><Badge label={loan.status} variant={loanStatusVariant(loan.status)} /></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-3">
                      {canManage && loan.status === 'REQUESTED' && (
                        <button
                          onClick={() => handleApprove(loan)}
                          disabled={approvingId === loan.id}
                          className="text-primary text-xs hover:underline disabled:opacity-50"
                        >
                          {approvingId === loan.id ? 'Approving…' : 'Approve'}
                        </button>
                      )}
                      <button onClick={() => openSchedule(loan)} className="text-primary text-xs hover:underline">View Schedule</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && !roleLoading && (
        <Pagination page={page} totalPages={totalPages} total={total} pageSize={pageSize} onPage={setPage} label="loans" />
      )}

      {showCreateModal && (
        <Modal title="Request Loan" onClose={() => setShowCreateModal(false)}>
          <form onSubmit={handleCreate} className="space-y-4">
            {modalNotice && (
              <div className="bg-danger/10 border border-danger/25 text-danger text-sm rounded-lg px-3 py-2">{modalNotice}</div>
            )}
            {canManage && (
              <FormField label="Member" htmlFor="loan-member" required>
                <Select id="loan-member" required value={form.memberId} onChange={(e) => setForm({ ...form, memberId: e.target.value })}>
                  <option value="" disabled>Select a member</option>
                  {members.map((m) => <option key={m.id} value={m.id}>{m.fullName}</option>)}
                </Select>
              </FormField>
            )}
            <FormField label="Principal" htmlFor="loan-principal" required>
              <Input id="loan-principal" required type="number" min="0" step="0.01" value={form.principal}
                onChange={(e) => setForm({ ...form, principal: e.target.value })} />
            </FormField>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Interest rate (annual %)" htmlFor="loan-rate" required>
                <Input id="loan-rate" required type="number" min="0" step="0.01" value={form.interestRate}
                  onChange={(e) => setForm({ ...form, interestRate: e.target.value })} />
              </FormField>
              <FormField label="Interest method" htmlFor="loan-method" required>
                <Select id="loan-method" value={form.interestMethod}
                  onChange={(e) => setForm({ ...form, interestMethod: e.target.value as InterestMethod })}>
                  <option value="FLAT">Flat</option>
                  <option value="REDUCING_BALANCE">Reducing balance</option>
                </Select>
              </FormField>
            </div>
            <FormField label="Term (months)" htmlFor="loan-term" required>
              <Input id="loan-term" required type="number" min="1" max="360" value={form.termMonths}
                onChange={(e) => setForm({ ...form, termMonths: e.target.value })} />
            </FormField>
            <LoadingButton type="submit" loading={saving} loadingText="Requesting…" className="w-full">
              Request Loan
            </LoadingButton>
          </form>
        </Modal>
      )}

      {scheduleLoan && (
        <Modal title={`Repayment Schedule — ${scheduleLoan.memberName}`} onClose={() => setScheduleLoan(null)}>
          {scheduleLoading ? (
            <p className="text-sm text-muted">Loading…</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-ink/60">
                  <th className="py-2 font-medium">#</th>
                  <th className="py-2 font-medium">Due</th>
                  <th className="py-2 font-medium">Due amount</th>
                  <th className="py-2 font-medium">Paid</th>
                  <th className="py-2 font-medium">Status</th>
                  {canManage && <th />}
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {repayments.map((r) => (
                  <tr key={r.id}>
                    <td className="py-2">{r.installmentNumber}</td>
                    <td className="py-2 text-muted">{r.scheduledDate}</td>
                    <td className="py-2 font-mono text-muted">{r.amountDue.toLocaleString()}</td>
                    <td className="py-2 font-mono text-muted">{r.amountPaid.toLocaleString()}</td>
                    <td className="py-2"><Badge label={r.status} variant={repaymentStatusVariant(r.status)} /></td>
                    {canManage && (
                      <td className="py-2 text-right">
                        {r.status !== 'PAID' && (
                          <button onClick={() => openPayment(r)} className="text-primary text-xs hover:underline">Record Payment</button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Modal>
      )}

      {payingRepayment && (
        <Modal title={`Record Payment — Installment ${payingRepayment.installmentNumber}`} onClose={() => setPayingRepayment(null)}>
          <form onSubmit={handleRecordPayment} className="space-y-4">
            {paymentNotice && (
              <div className="bg-danger/10 border border-danger/25 text-danger text-sm rounded-lg px-3 py-2">{paymentNotice}</div>
            )}
            <p className="text-sm text-muted">
              Due {payingRepayment.amountDue.toLocaleString()}, already paid {payingRepayment.amountPaid.toLocaleString()}.
            </p>
            <FormField label="Amount" htmlFor="loan-payment-amount" required>
              <Input id="loan-payment-amount" required type="number" min="0" step="0.01" value={paymentForm.amount}
                onChange={(e) => setPaymentForm({ amount: e.target.value })} />
            </FormField>
            <LoadingButton type="submit" loading={paymentSaving} loadingText="Saving…" className="w-full">
              Record Payment
            </LoadingButton>
          </form>
        </Modal>
      )}
    </div>
  )
}
