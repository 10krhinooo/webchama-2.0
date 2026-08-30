import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  getLoans,
  getMyLoans,
  createLoan,
  approveLoan,
  rejectLoan,
  getLoanRepayments,
  recordLoanRepayment,
  disburseLoan,
  type Loan,
  type LoanRepayment,
  type InterestMethod,
} from '../../api/loans'
import { getMembers, getCreditScores, CREDIT_SCORE_BAND_LABELS, type CreditScore, type Member } from '../../api/members'
import { getChama, type Chama } from '../../api/chamas'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import { extractErrorMessage } from '../../api/client'
import { useMyMembership } from '../../hooks/useMyMembership'
import { usePagination } from '../../hooks/usePagination'
import { TablePageSkeleton } from '../../components/ui/SkeletonLayouts'
import LoadingButton from '../../components/ui/LoadingButton'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import Modal from '../../components/ui/Modal'
import FormError from '../../components/ui/FormError'
import TransientAlert from '../../components/ui/TransientAlert'
import FormField from '../../components/ui/FormField'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import Pagination from '../../components/ui/Pagination'
import Reveal from '../../components/ui/Reveal'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui/Table'

const EMPTY_FORM = { memberId: '', principal: '', interestRate: '', interestMethod: 'FLAT' as InterestMethod, termMonths: '' }
const EMPTY_PAYMENT_FORM = { amount: '' }

function loanStatusVariant(status: Loan['status']) {
  if (status === 'CLOSED') return 'success' as const
  if (status === 'DEFAULTED' || status === 'REJECTED') return 'danger' as const
  if (status === 'REPAYING') return 'warning' as const
  if (status === 'DISBURSEMENT_PENDING') return 'warning' as const
  if (status === 'APPROVED' || status === 'DISBURSED') return 'primary' as const
  return 'muted' as const
}

function repaymentStatusVariant(status: LoanRepayment['status']) {
  if (status === 'PAID') return 'success' as const
  if (status === 'PARTIAL') return 'warning' as const
  if (status === 'OVERDUE') return 'danger' as const
  return 'muted' as const
}

const formatMoney = (amount: number) => `KES ${amount.toLocaleString()}`

function creditScoreVariant(band: CreditScore['band']) {
  if (band === 'EXCELLENT' || band === 'GOOD') return 'success' as const
  if (band === 'FAIR') return 'warning' as const
  if (band === 'POOR') return 'danger' as const
  return 'muted' as const
}

/**
 * A thin record is shown as such rather than as a number. A member with two months of history is
 * not comparable to one with two years, and a bare "62" hides that difference entirely.
 */
function creditScoreLabel(score: CreditScore) {
  if (score.score === null) return 'New'
  return score.confidence < 0.5 ? `${score.score}?` : String(score.score)
}

function creditScoreDescription(score: CreditScore) {
  const band = CREDIT_SCORE_BAND_LABELS[score.band]
  if (score.score === null) {
    return `${band}, nothing to score yet`
  }
  const evidence = `${score.contributionsConsidered} contributions, ${score.loanRepaymentsConsidered} repayments, ${score.meetingsConsidered} meetings`
  return score.confidence < 0.5 ? `${band}, based on limited history: ${evidence}` : `${band}, based on ${evidence}`
}

export default function LoansPage() {
  const { chamaId: chamaIdParam } = useParams<{ chamaId: string }>()
  const chamaId = Number(chamaIdParam)
  const { isTreasurer, isChairperson, member, loading: roleLoading } = useMyMembership(chamaId)
  const canManage = isTreasurer || isChairperson

  const [loans, setLoans] = useState<Loan[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [creditScores, setCreditScores] = useState<Record<number, CreditScore>>({})
  const [chama, setChama] = useState<Chama | null>(null)
  const [disbursing, setDisbursing] = useState<Loan | null>(null)
  const [disbursingId, setDisbursingId] = useState<number | null>(null)
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
  const [scheduleNotice, setScheduleNotice] = useState<string | null>(null)
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
        if (canManage) loadCreditScores()
      })
      .finally(() => setLoading(false))

    // Fetched separately rather than alongside the loans. The threshold only changes the wording
    // of a confirmation, so a failure to read it must not take the loans list down with it; the
    // backend enforces the rule regardless of what the UI managed to load.
    if (canManage) {
      getChama(chamaId)
        .then(setChama)
        .catch(() => setChama(null))
    }
  }

  // A data-backed signal for the chairperson/treasurer reviewing a loan request, not a hard gate
  // (issue #59). One request for the whole chama rather than one per member on the page, which
  // was a request each and five queries behind every one.
  const loadCreditScores = () => {
    getCreditScores(chamaId)
      .then((scores) => setCreditScores(Object.fromEntries(scores.map((s) => [s.memberId, s]))))
      .catch(() => {
        /* Non-critical signal, a failed lookup just leaves the scores blank. */
      })
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

  const handleReject = async (loan: Loan) => {
    setApprovingId(loan.id)
    try {
      await rejectLoan(chamaId, loan.id)
      setNotice({ variant: 'success', message: `Loan for ${loan.memberName} rejected.` })
      refresh()
    } catch (err) {
      setNotice({ variant: 'error', message: extractErrorMessage(err) })
    } finally {
      setApprovingId(null)
    }
  }

  /**
   * Whether this amount needs a second signature before it can be paid out.
   *
   * Checked here so the confirmation says what will happen, rather than letting the treasurer
   * press Disburse and discover the requirement from a rejection.
   */
  const needsDualSignOff = (loan: Loan) =>
    chama?.approvalThreshold != null && loan.principal > chama.approvalThreshold

  const handleDisburse = async () => {
    if (!disbursing) return
    const loan = disbursing
    setDisbursing(null)
    setDisbursingId(loan.id)
    try {
      const disbursement = await disburseLoan(chamaId, loan.id)
      setNotice({
        variant: 'success',
        message:
          disbursement.status === 'COMPLETED'
            ? `Loan for ${loan.memberName} disbursed.`
            : `Payout to ${loan.memberName} sent. It will settle once the provider confirms.`,
      })
      refresh()
    } catch (err) {
      setNotice({ variant: 'error', message: extractErrorMessage(err) })
    } finally {
      setDisbursingId(null)
    }
  }

  const openSchedule = (loan: Loan) => {
    setScheduleLoan(loan)
    setScheduleNotice(null)
    setScheduleLoading(true)
    getLoanRepayments(chamaId, loan.id)
      .then(setRepayments)
      .catch((err) => setScheduleNotice(extractErrorMessage(err)))
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
      <Reveal eager className="flex items-center justify-between">
        <h1 className="font-heading text-2xl font-bold text-ink">{canManage ? 'Loans' : 'My Loans'}</h1>
        <Button onClick={openCreate}>+ Request Loan</Button>
      </Reveal>

      <TransientAlert variant={notice?.variant ?? 'success'} message={notice?.message ?? null} onDismiss={() => setNotice(null)} />

      {loading || roleLoading ? (
        <TablePageSkeleton withFilter={false} />
      ) : (
        <Reveal eager delayMs={80}>
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                {canManage && <TableHead>Member</TableHead>}
                {canManage && <TableHead>Credit Score</TableHead>}
                <TableHead>Principal</TableHead>
                <TableHead>Interest</TableHead>
                <TableHead>Term</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {loans.length === 0 && (
                <TableRow><TableCell colSpan={canManage ? 7 : 5} className="py-10 text-center text-sm text-muted">No loans yet.</TableCell></TableRow>
              )}
              {pageItems.map((loan) => (
                <TableRow key={loan.id}>
                  {canManage && <TableCell className="font-medium text-ink">{loan.memberName}</TableCell>}
                  {canManage && (
                    <TableCell>
                      {creditScores[loan.memberId] !== undefined
                        ? <Badge
                            label={creditScoreLabel(creditScores[loan.memberId])}
                            variant={creditScoreVariant(creditScores[loan.memberId].band)}
                            description={creditScoreDescription(creditScores[loan.memberId])}
                          />
                        : <span className="text-muted text-xs">—</span>}
                    </TableCell>
                  )}
                  <TableCell className="font-mono text-muted">{loan.principal.toLocaleString()}</TableCell>
                  <TableCell className="text-muted">
                    {loan.interestRate}% ({loan.interestMethod === 'FLAT' ? 'Flat' : 'Reducing balance'})
                  </TableCell>
                  <TableCell className="text-muted">{loan.termMonths} mo</TableCell>
                  <TableCell><Badge label={loan.status} variant={loanStatusVariant(loan.status)} /></TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-3">
                      {canManage && loan.status === 'REQUESTED' && (
                        <button
                          onClick={() => handleApprove(loan)}
                          disabled={approvingId === loan.id}
                          className="text-brand text-xs hover:underline disabled:opacity-50"
                        >
                          {approvingId === loan.id ? 'Approving…' : 'Approve'}
                        </button>
                      )}
                      {canManage && loan.status === 'REQUESTED' && (
                        <button
                          onClick={() => handleReject(loan)}
                          disabled={approvingId === loan.id}
                          className="text-danger text-xs hover:underline disabled:opacity-50"
                        >
                          Reject
                        </button>
                      )}
                      {canManage && loan.status === 'APPROVED' && (
                        <button
                          onClick={() => setDisbursing(loan)}
                          disabled={disbursingId === loan.id}
                          className="text-success text-xs hover:underline disabled:opacity-50"
                        >
                          {disbursingId === loan.id ? 'Disbursing…' : 'Disburse'}
                        </button>
                      )}
                      {loan.status === 'DISBURSEMENT_PENDING' && (
                        <span className="text-xs text-muted" title="Waiting for the provider to confirm">
                          Payout in flight
                        </span>
                      )}
                      <button onClick={() => openSchedule(loan)} className="text-brand text-xs hover:underline">View Schedule</button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Reveal>
      )}

      {!loading && !roleLoading && (
        <Pagination page={page} totalPages={totalPages} total={total} pageSize={pageSize} onPage={setPage} label="loans" />
      )}

      {showCreateModal && (
        <Modal title="Request Loan" onClose={() => setShowCreateModal(false)}>
          <form onSubmit={handleCreate} className="space-y-4">
            {modalNotice && (
              <FormError message={modalNotice} />
            )}
            {canManage && (
              <FormField label="Member" htmlFor="loan-member" required>
                <Select id="loan-member" required value={form.memberId} onChange={(v) => setForm({ ...form, memberId: v })}>
                  <option value="" disabled>Select a member</option>
                  {members.map((m) => <option key={m.id} value={m.id}>{m.fullName}</option>)}
                </Select>
              </FormField>
            )}
            <FormField label="Principal" htmlFor="loan-principal" required>
              <Input id="loan-principal" required type="number" min="0" step="0.01" value={form.principal}
                onChange={(e) => setForm({ ...form, principal: e.target.value })} />
            </FormField>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FormField label="Interest rate (annual %)" htmlFor="loan-rate" required>
                <Input id="loan-rate" required type="number" min="0" step="0.01" value={form.interestRate}
                  onChange={(e) => setForm({ ...form, interestRate: e.target.value })} />
              </FormField>
              <FormField label="Interest method" htmlFor="loan-method" required>
                <Select id="loan-method" value={form.interestMethod}
                  onChange={(v) => setForm({ ...form, interestMethod: v as InterestMethod })}>
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

      {disbursing && (
        <ConfirmDialog
          title="Disburse this loan"
          message={
            needsDualSignOff(disbursing)
              ? `${formatMoney(disbursing.principal)} is above this chama's approval threshold, so it needs a second sign-off before it can be paid out. If that has not cleared on the Approvals page, this will be rejected.`
              : `Send ${formatMoney(disbursing.principal)} to ${disbursing.memberName} by M-Pesa. This moves real money and cannot be undone from here.`
          }
          confirmLabel="Disburse"
          variant="primary"
          onConfirm={handleDisburse}
          onCancel={() => setDisbursing(null)}
        />
      )}

      {scheduleLoan && (
        <Modal title={`Repayment Schedule — ${scheduleLoan.memberName}`} onClose={() => setScheduleLoan(null)}>
          {scheduleNotice && (
            <FormError message={scheduleNotice} className="mb-4" />
          )}
          {scheduleLoading ? (
            <p className="text-sm text-muted">Loading…</p>
          ) : scheduleNotice ? null : (
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
              <tbody className="divide-y divide-border">
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
                          <button onClick={() => openPayment(r)} className="text-brand text-xs hover:underline">Record Payment</button>
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
              <FormError message={paymentNotice} />
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
