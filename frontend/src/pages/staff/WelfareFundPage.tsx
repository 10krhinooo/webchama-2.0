import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  getWelfareFund,
  getWelfareContributions,
  getMyWelfareContributions,
  recordWelfareContribution,
  payWelfareContributionWithMpesa,
  getWelfareWithdrawals,
  createWelfareWithdrawal,
  disburseWelfareWithdrawal,
  type WelfareFund,
  type WelfareContribution,
  type WelfareWithdrawal,
  type PaymentMethod,
} from '../../api/welfareFund'
import { getMembers, type Member } from '../../api/members'
import { extractErrorMessage } from '../../api/client'
import { useMyMembership } from '../../hooks/useMyMembership'
import EmptyState from '../../components/ui/EmptyState'
import Card from '../../components/ui/Card'
import { TablePageSkeleton } from '../../components/ui/SkeletonLayouts'
import LoadingButton from '../../components/ui/LoadingButton'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui/Table'
import Modal from '../../components/ui/Modal'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import FormError from '../../components/ui/FormError'
import TransientAlert from '../../components/ui/TransientAlert'
import FormField from '../../components/ui/FormField'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'

const EMPTY_RECORD_FORM = { memberId: '', amount: '', method: 'CASH' as PaymentMethod }
const EMPTY_WITHDRAWAL_FORM = { amount: '', reason: '' }

function contributionStatusVariant(status: WelfareContribution['status']) {
  return status === 'PAID' ? ('success' as const) : ('warning' as const)
}

const WITHDRAWAL_STATUS_LABELS: Record<WelfareWithdrawal['status'], string> = {
  PENDING_APPROVAL: 'Awaiting sign-off',
  DISBURSED: 'Disbursed',
}

export default function WelfareFundPage() {
  const { chamaId: chamaIdParam } = useParams<{ chamaId: string }>()
  const chamaId = Number(chamaIdParam)
  const { isManager, member, loading: roleLoading } = useMyMembership(chamaId)

  const [fund, setFund] = useState<WelfareFund | null>(null)
  const [contributions, setContributions] = useState<WelfareContribution[]>([])
  const [withdrawals, setWithdrawals] = useState<WelfareWithdrawal[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [notice, setNotice] = useState<{ variant: 'success' | 'error'; message: string } | null>(null)

  const [showContributeModal, setShowContributeModal] = useState(false)
  const [contributeAmount, setContributeAmount] = useState('')
  const [contributeNotice, setContributeNotice] = useState<string | null>(null)
  const [contributing, setContributing] = useState(false)

  const [showRecordModal, setShowRecordModal] = useState(false)
  const [recordForm, setRecordForm] = useState(EMPTY_RECORD_FORM)
  const [recordNotice, setRecordNotice] = useState<string | null>(null)
  const [recording, setRecording] = useState(false)

  const [disbursing, setDisbursing] = useState<WelfareWithdrawal | null>(null)
  const [disburseSaving, setDisburseSaving] = useState(false)

  const [showWithdrawModal, setShowWithdrawModal] = useState(false)
  const [withdrawForm, setWithdrawForm] = useState(EMPTY_WITHDRAWAL_FORM)
  const [withdrawNotice, setWithdrawNotice] = useState<string | null>(null)
  const [withdrawing, setWithdrawing] = useState(false)

  const refresh = () => {
    if (roleLoading) return
    setLoading(true)
    const promises: Promise<unknown>[] = [
      getMyWelfareContributions(chamaId).then(setContributions),
    ]
    if (isManager) {
      promises.push(getWelfareFund(chamaId).then(setFund))
      promises.push(getWelfareContributions(chamaId).then(setContributions))
      promises.push(getWelfareWithdrawals(chamaId).then(setWithdrawals))
      promises.push(getMembers(chamaId).then(setMembers))
    }
    Promise.all(promises).finally(() => setLoading(false))
  }

  useEffect(refresh, [chamaId, isManager, roleLoading])

  const openContribute = () => {
    setContributeAmount('')
    setContributeNotice(null)
    setShowContributeModal(true)
  }

  const handleContribute = async (e: React.FormEvent) => {
    e.preventDefault()
    setContributing(true)
    setContributeNotice(null)
    try {
      await payWelfareContributionWithMpesa(chamaId, Number(contributeAmount))
      setNotice({ variant: 'success', message: 'M-Pesa prompt sent. Check your phone to complete payment.' })
      setShowContributeModal(false)
      refresh()
    } catch (err) {
      setContributeNotice(extractErrorMessage(err))
    } finally {
      setContributing(false)
    }
  }

  const openRecord = () => {
    setRecordForm(EMPTY_RECORD_FORM)
    setRecordNotice(null)
    setShowRecordModal(true)
  }

  const handleRecord = async (e: React.FormEvent) => {
    e.preventDefault()
    setRecording(true)
    setRecordNotice(null)
    try {
      await recordWelfareContribution(chamaId, {
        memberId: Number(recordForm.memberId),
        amount: Number(recordForm.amount),
        method: recordForm.method,
      })
      setNotice({ variant: 'success', message: 'Contribution recorded.' })
      setShowRecordModal(false)
      refresh()
    } catch (err) {
      setRecordNotice(extractErrorMessage(err))
    } finally {
      setRecording(false)
    }
  }

  const openWithdraw = () => {
    setWithdrawForm(EMPTY_WITHDRAWAL_FORM)
    setWithdrawNotice(null)
    setShowWithdrawModal(true)
  }

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault()
    setWithdrawing(true)
    setWithdrawNotice(null)
    try {
      const withdrawal = await createWelfareWithdrawal(chamaId, {
        amount: Number(withdrawForm.amount),
        reason: withdrawForm.reason,
      })
      // Whether the money moved depends on the chama's approval threshold, so the confirmation
      // has to say which happened rather than always claiming the fund was debited.
      setNotice(withdrawal.status === 'DISBURSED'
        ? { variant: 'success', message: 'Withdrawal disbursed from the fund.' }
        : {
            variant: 'success',
            message: 'Withdrawal requested. It needs two sign-offs on the approvals page before the money can leave the fund.',
          })
      setShowWithdrawModal(false)
      refresh()
    } catch (err) {
      setWithdrawNotice(extractErrorMessage(err))
    } finally {
      setWithdrawing(false)
    }
  }

  const handleDisburse = async () => {
    if (!disbursing) return
    setDisburseSaving(true)
    try {
      await disburseWelfareWithdrawal(chamaId, disbursing.id)
      setNotice({ variant: 'success', message: 'Withdrawal disbursed from the fund.' })
      setDisbursing(null)
      refresh()
    } catch (err) {
      // Surfaced on the page rather than in the dialog: the two likeliest failures are that the
      // sign-off has not cleared and that another withdrawal has since drained the fund, and
      // neither is fixed by staying in the dialog.
      setNotice({ variant: 'error', message: extractErrorMessage(err) })
      setDisbursing(null)
    } finally {
      setDisburseSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl font-bold text-ink">Welfare Fund</h1>
        <div className="flex gap-3">
          <Button onClick={openContribute}>+ Contribute</Button>
          {isManager && <Button variant="secondary" onClick={openRecord}>+ Record Contribution</Button>}
          {isManager && <Button variant="secondary" onClick={openWithdraw}>+ Withdrawal</Button>}
        </div>
      </div>

      <TransientAlert variant={notice?.variant ?? 'success'} message={notice?.message ?? null} onDismiss={() => setNotice(null)} />

      {loading || roleLoading ? (
        <TablePageSkeleton withFilter={false} />
      ) : (
        <>
          {isManager && fund && (
            <Card>
              <p className="text-sm text-muted">Fund balance</p>
              <p className="font-mono text-3xl font-bold text-brand">{fund.balance.toLocaleString()}</p>
            </Card>
          )}

          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                {isManager && <TableHead>Member</TableHead>}
                <TableHead>Amount</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contributions.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4}>
                    <EmptyState title="No welfare contributions yet" description="Contributions to the fund appear here once members pay in." />
                  </TableCell>
                </TableRow>
              )}
              {contributions.map((c) => (
                <TableRow key={c.id}>
                  {isManager && <TableCell className="font-medium text-ink">{c.memberName}</TableCell>}
                  <TableCell className="font-mono text-muted">{c.amount.toLocaleString()}</TableCell>
                  <TableCell className="text-muted">{c.paymentMethod ?? '—'}</TableCell>
                  <TableCell><Badge label={c.status} variant={contributionStatusVariant(c.status)} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {isManager && (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Amount</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Requested by</TableHead>
                  <TableHead>Disbursed by</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {withdrawals.length === 0 && (
                  <TableRow>
                  <TableCell colSpan={6}>
                    <EmptyState title="No withdrawals yet" description="Requests to draw on the fund appear here." />
                  </TableCell>
                </TableRow>
                )}
                {withdrawals.map((w) => (
                  <TableRow key={w.id}>
                    <TableCell className="font-mono text-muted">{w.amount.toLocaleString()}</TableCell>
                    <TableCell className="text-muted">{w.reason}</TableCell>
                    <TableCell>
                      <Badge
                        label={WITHDRAWAL_STATUS_LABELS[w.status]}
                        variant={w.status === 'DISBURSED' ? 'success' : 'warning'}
                      />
                    </TableCell>
                    <TableCell className="text-muted">{w.requestedByName}</TableCell>
                    <TableCell className="text-muted">{w.disbursedByName ?? '\u2014'}</TableCell>
                    <TableCell className="text-right">
                      {w.status === 'PENDING_APPROVAL' && (
                        <Button variant="secondary" onClick={() => setDisbursing(w)}>Disburse</Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </>
      )}

      {disbursing && (
        <ConfirmDialog
          title="Disburse from the welfare fund"
          message={`Release ${disbursing.amount.toLocaleString()} for "${disbursing.reason}"? This debits the fund and cannot be undone.`}
          confirmLabel="Disburse"
          loading={disburseSaving}
          onConfirm={handleDisburse}
          onCancel={() => setDisbursing(null)}
        />
      )}

      {showContributeModal && (
        <Modal title="Contribute to Welfare Fund" onClose={() => setShowContributeModal(false)}>
          <form onSubmit={handleContribute} className="space-y-4">
            {contributeNotice && (
              <FormError message={contributeNotice} />
            )}
            <FormField label="Amount" htmlFor="welfare-contribute-amount" required>
              <Input id="welfare-contribute-amount" required type="number" min="0" step="0.01" value={contributeAmount}
                onChange={(e) => setContributeAmount(e.target.value)} />
            </FormField>
            {member?.phone && <p className="text-xs text-muted">An M-Pesa prompt will be sent to {member.phone}.</p>}
            <LoadingButton type="submit" loading={contributing} loadingText="Sending…" className="w-full">
              Send M-Pesa Prompt
            </LoadingButton>
          </form>
        </Modal>
      )}

      {showRecordModal && (
        <Modal title="Record Contribution" onClose={() => setShowRecordModal(false)}>
          <form onSubmit={handleRecord} className="space-y-4">
            {recordNotice && (
              <FormError message={recordNotice} />
            )}
            <FormField label="Member" htmlFor="welfare-record-member" required>
              <Select id="welfare-record-member" required value={recordForm.memberId}
                onChange={(v) => setRecordForm({ ...recordForm, memberId: v })}>
                <option value="" disabled>Select a member</option>
                {members.map((m) => <option key={m.id} value={m.id}>{m.fullName}</option>)}
              </Select>
            </FormField>
            <FormField label="Amount" htmlFor="welfare-record-amount" required>
              <Input id="welfare-record-amount" required type="number" min="0" step="0.01" value={recordForm.amount}
                onChange={(e) => setRecordForm({ ...recordForm, amount: e.target.value })} />
            </FormField>
            <FormField label="Method" htmlFor="welfare-record-method" required>
              <Select id="welfare-record-method" value={recordForm.method}
                onChange={(v) => setRecordForm({ ...recordForm, method: v as PaymentMethod })}>
                <option value="CASH">Cash</option>
                <option value="BANK">Bank</option>
                <option value="MPESA">M-Pesa</option>
                <option value="CARD">Card</option>
              </Select>
            </FormField>
            <LoadingButton type="submit" loading={recording} loadingText="Saving…" className="w-full">
              Record Contribution
            </LoadingButton>
          </form>
        </Modal>
      )}

      {showWithdrawModal && (
        <Modal title="Record Withdrawal" onClose={() => setShowWithdrawModal(false)}>
          <form onSubmit={handleWithdraw} className="space-y-4">
            {withdrawNotice && (
              <FormError message={withdrawNotice} />
            )}
            <FormField label="Amount" htmlFor="welfare-withdraw-amount" required>
              <Input id="welfare-withdraw-amount" required type="number" min="0" step="0.01" value={withdrawForm.amount}
                onChange={(e) => setWithdrawForm({ ...withdrawForm, amount: e.target.value })} />
            </FormField>
            <FormField label="Reason" htmlFor="welfare-withdraw-reason" required>
              <Input id="welfare-withdraw-reason" required value={withdrawForm.reason}
                onChange={(e) => setWithdrawForm({ ...withdrawForm, reason: e.target.value })} />
            </FormField>
            <LoadingButton type="submit" loading={withdrawing} loadingText="Saving…" className="w-full">
              Record Withdrawal
            </LoadingButton>
          </form>
        </Modal>
      )}
    </div>
  )
}
