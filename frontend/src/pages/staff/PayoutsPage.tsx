import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  getPayoutSchedule,
  generatePayoutSchedule,
  getPayouts,
  getMyPayouts,
  createPayout,
  disbursePayout,
  type PayoutScheduleEntry,
  type Payout,
  type RotationOrderType,
} from '../../api/payouts'
import { getMembers, type Member } from '../../api/members'
import { extractErrorMessage } from '../../api/client'
import { useMyMembership } from '../../hooks/useMyMembership'
import { TablePageSkeleton } from '../../components/ui/SkeletonLayouts'
import LoadingButton from '../../components/ui/LoadingButton'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import Modal from '../../components/ui/Modal'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import TransientAlert from '../../components/ui/TransientAlert'
import FormField from '../../components/ui/FormField'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import Reveal from '../../components/ui/Reveal'

const EMPTY_SCHEDULE_FORM = { rotationOrderType: 'SENIORITY' as RotationOrderType }
const EMPTY_PAYOUT_FORM = { scheduledDate: '' }

function scheduleStatusVariant(status: PayoutScheduleEntry['status']) {
  return status === 'ACTIVE' ? ('primary' as const) : ('muted' as const)
}

function payoutStatusVariant(status: Payout['status']) {
  return status === 'DISBURSED' ? ('success' as const) : ('muted' as const)
}

export default function PayoutsPage() {
  const { chamaId: chamaIdParam } = useParams<{ chamaId: string }>()
  const chamaId = Number(chamaIdParam)
  const { isTreasurer, isChairperson, member, loading: roleLoading } = useMyMembership(chamaId)
  const canManage = isTreasurer || isChairperson

  const [schedule, setSchedule] = useState<PayoutScheduleEntry[]>([])
  const [payouts, setPayouts] = useState<Payout[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [notice, setNotice] = useState<{ variant: 'success' | 'error'; message: string } | null>(null)

  const [showScheduleModal, setShowScheduleModal] = useState(false)
  const [scheduleForm, setScheduleForm] = useState(EMPTY_SCHEDULE_FORM)
  const [agreedOrder, setAgreedOrder] = useState<Member[]>([])
  const [scheduleModalNotice, setScheduleModalNotice] = useState<string | null>(null)
  const [generatingSchedule, setGeneratingSchedule] = useState(false)

  const [showPayoutModal, setShowPayoutModal] = useState(false)
  const [payoutForm, setPayoutForm] = useState(EMPTY_PAYOUT_FORM)
  const [payoutModalNotice, setPayoutModalNotice] = useState<string | null>(null)
  const [creatingPayout, setCreatingPayout] = useState(false)

  const [disbursingPayout, setDisbursingPayout] = useState<Payout | null>(null)
  const [disbursing, setDisbursing] = useState(false)

  const refresh = () => {
    if (roleLoading) return
    setLoading(true)
    Promise.all([
      getPayoutSchedule(chamaId),
      canManage ? getPayouts(chamaId) : getMyPayouts(chamaId),
      canManage ? getMembers(chamaId) : Promise.resolve([]),
    ])
      .then(([s, p, m]) => {
        setSchedule(s)
        setPayouts(p)
        setMembers(m)
      })
      .finally(() => setLoading(false))
  }

  useEffect(refresh, [chamaId, canManage, roleLoading])

  const openScheduleModal = () => {
    setScheduleForm(EMPTY_SCHEDULE_FORM)
    setAgreedOrder(members.filter((m) => m.status === 'ACTIVE'))
    setScheduleModalNotice(null)
    setShowScheduleModal(true)
  }

  const moveAgreedMember = (index: number, direction: -1 | 1) => {
    const target = index + direction
    if (target < 0 || target >= agreedOrder.length) return
    const next = [...agreedOrder]
    ;[next[index], next[target]] = [next[target], next[index]]
    setAgreedOrder(next)
  }

  const handleGenerateSchedule = async (e: React.FormEvent) => {
    e.preventDefault()
    setGeneratingSchedule(true)
    setScheduleModalNotice(null)
    try {
      await generatePayoutSchedule(chamaId, {
        rotationOrderType: scheduleForm.rotationOrderType,
        agreedMemberIds: scheduleForm.rotationOrderType === 'AGREED' ? agreedOrder.map((m) => m.id) : undefined,
      })
      setNotice({ variant: 'success', message: 'Payout rotation schedule generated.' })
      setShowScheduleModal(false)
      refresh()
    } catch (err) {
      setScheduleModalNotice(extractErrorMessage(err))
    } finally {
      setGeneratingSchedule(false)
    }
  }

  const openPayoutModal = () => {
    setPayoutForm(EMPTY_PAYOUT_FORM)
    setPayoutModalNotice(null)
    setShowPayoutModal(true)
  }

  const handleCreatePayout = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreatingPayout(true)
    setPayoutModalNotice(null)
    try {
      await createPayout(chamaId, { scheduledDate: payoutForm.scheduledDate })
      setNotice({ variant: 'success', message: 'Payout created for the next round.' })
      setShowPayoutModal(false)
      refresh()
    } catch (err) {
      setPayoutModalNotice(extractErrorMessage(err))
    } finally {
      setCreatingPayout(false)
    }
  }

  const handleDisburse = async () => {
    if (!disbursingPayout) return
    setDisbursing(true)
    try {
      await disbursePayout(chamaId, disbursingPayout.id)
      setNotice({ variant: 'success', message: `Payout for ${disbursingPayout.memberName} marked disbursed.` })
      setDisbursingPayout(null)
      refresh()
    } catch (err) {
      setNotice({ variant: 'error', message: extractErrorMessage(err) })
      setDisbursingPayout(null)
    } finally {
      setDisbursing(false)
    }
  }

  return (
    <div className="space-y-8">
      <Reveal eager className="flex items-center justify-between">
        <h1 className="font-heading text-2xl font-bold text-ink">Payouts</h1>
      </Reveal>

      <TransientAlert variant={notice?.variant ?? 'success'} message={notice?.message ?? null} onDismiss={() => setNotice(null)} />

      {loading || roleLoading ? (
        <TablePageSkeleton withFilter={false} withButton={canManage} />
      ) : (
        <>
          <Reveal eager delayMs={80} as="section" className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-heading text-lg font-semibold text-ink">Rotation Schedule</h2>
              {canManage && <Button onClick={openScheduleModal}>Generate Schedule</Button>}
            </div>
            <div className="bg-white rounded-2xl shadow-card overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-paper-dim border-b border-black/10">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-ink/80">Position</th>
                    <th className="text-left px-4 py-3 font-medium text-ink/80">Member</th>
                    <th className="text-left px-4 py-3 font-medium text-ink/80">Order</th>
                    <th className="text-left px-4 py-3 font-medium text-ink/80">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5">
                  {schedule.length === 0 && (
                    <tr><td colSpan={4} className="px-4 py-10 text-center text-muted text-sm">No rotation schedule generated yet.</td></tr>
                  )}
                  {schedule.map((entry) => (
                    <tr key={entry.id} className={member && entry.memberId === member.id ? 'bg-primary-light/40' : 'hover:bg-paper-dim/30'}>
                      <td className="px-4 py-3 font-mono text-muted">{entry.sequencePosition}</td>
                      <td className="px-4 py-3 font-medium text-ink">{entry.memberName}</td>
                      <td className="px-4 py-3 text-muted">{entry.rotationOrderType}</td>
                      <td className="px-4 py-3"><Badge label={entry.status} variant={scheduleStatusVariant(entry.status)} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Reveal>

          <Reveal eager delayMs={160} as="section" className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-heading text-lg font-semibold text-ink">{canManage ? 'Payouts' : 'My Payouts'}</h2>
              {canManage && <Button onClick={openPayoutModal}>Create Next Payout</Button>}
            </div>
            <div className="bg-white rounded-2xl shadow-card overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-paper-dim border-b border-black/10">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-ink/80">Round</th>
                    {canManage && <th className="text-left px-4 py-3 font-medium text-ink/80">Member</th>}
                    <th className="text-left px-4 py-3 font-medium text-ink/80">Scheduled</th>
                    <th className="text-left px-4 py-3 font-medium text-ink/80">Amount</th>
                    <th className="text-left px-4 py-3 font-medium text-ink/80">Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5">
                  {payouts.length === 0 && (
                    <tr><td colSpan={6} className="px-4 py-10 text-center text-muted text-sm">No payouts yet.</td></tr>
                  )}
                  {payouts.map((payout) => (
                    <tr key={payout.id} className="hover:bg-paper-dim/30">
                      <td className="px-4 py-3 font-mono text-muted">{payout.roundNumber}</td>
                      {canManage && <td className="px-4 py-3 font-medium text-ink">{payout.memberName}</td>}
                      <td className="px-4 py-3 text-muted">{payout.scheduledDate}</td>
                      <td className="px-4 py-3 font-mono text-muted">{payout.amount.toLocaleString()}</td>
                      <td className="px-4 py-3"><Badge label={payout.status} variant={payoutStatusVariant(payout.status)} /></td>
                      <td className="px-4 py-3 text-right">
                        {canManage && payout.status === 'SCHEDULED' && (
                          <button onClick={() => setDisbursingPayout(payout)} className="text-primary text-xs hover:underline">
                            Disburse
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Reveal>
        </>
      )}

      {showScheduleModal && (
        <Modal title="Generate Payout Schedule" onClose={() => setShowScheduleModal(false)}>
          <form onSubmit={handleGenerateSchedule} className="space-y-4">
            {scheduleModalNotice && (
              <div className="bg-danger/10 border border-danger/25 text-danger text-sm rounded-lg px-3 py-2">{scheduleModalNotice}</div>
            )}
            <p className="text-xs text-muted">Regenerating replaces the current rotation schedule.</p>
            <FormField label="Rotation order" htmlFor="payout-rotation-type" required>
              <Select
                id="payout-rotation-type"
                value={scheduleForm.rotationOrderType}
                onChange={(e) => setScheduleForm({ rotationOrderType: e.target.value as RotationOrderType })}
              >
                <option value="SENIORITY">Seniority (by join date)</option>
                <option value="RANDOM">Random</option>
                <option value="AGREED">Agreed order</option>
              </Select>
            </FormField>
            {scheduleForm.rotationOrderType === 'AGREED' && (
              <div>
                <p className="mb-1 text-sm font-medium text-ink/80">Order (top goes first)</p>
                <ul className="divide-y divide-black/5 rounded-lg border border-black/10">
                  {agreedOrder.map((m, i) => (
                    <li key={m.id} className="flex items-center justify-between px-3 py-2 text-sm">
                      <span>{i + 1}. {m.fullName}</span>
                      <span className="flex gap-1">
                        <button type="button" onClick={() => moveAgreedMember(i, -1)} disabled={i === 0}
                          className="px-1.5 text-muted hover:text-ink disabled:opacity-30">↑</button>
                        <button type="button" onClick={() => moveAgreedMember(i, 1)} disabled={i === agreedOrder.length - 1}
                          className="px-1.5 text-muted hover:text-ink disabled:opacity-30">↓</button>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <LoadingButton type="submit" loading={generatingSchedule} loadingText="Generating…" className="w-full">
              Generate Schedule
            </LoadingButton>
          </form>
        </Modal>
      )}

      {showPayoutModal && (
        <Modal title="Create Next Payout" onClose={() => setShowPayoutModal(false)}>
          <form onSubmit={handleCreatePayout} className="space-y-4">
            {payoutModalNotice && (
              <div className="bg-danger/10 border border-danger/25 text-danger text-sm rounded-lg px-3 py-2">{payoutModalNotice}</div>
            )}
            <p className="text-xs text-muted">Whose turn it is is resolved automatically from the rotation schedule.</p>
            <FormField label="Scheduled date" htmlFor="payout-scheduled-date" required>
              <Input id="payout-scheduled-date" required type="date" value={payoutForm.scheduledDate}
                onChange={(e) => setPayoutForm({ scheduledDate: e.target.value })} />
            </FormField>
            <LoadingButton type="submit" loading={creatingPayout} loadingText="Creating…" className="w-full">
              Create Payout
            </LoadingButton>
          </form>
        </Modal>
      )}

      {disbursingPayout && (
        <ConfirmDialog
          title="Mark payout disbursed"
          message={`Mark the round ${disbursingPayout.roundNumber} payout of ${disbursingPayout.amount.toLocaleString()} for ${disbursingPayout.memberName} as disbursed? This cannot be undone.`}
          confirmLabel="Mark Disbursed"
          variant="primary"
          loading={disbursing}
          onConfirm={handleDisburse}
          onCancel={() => setDisbursingPayout(null)}
        />
      )}
    </div>
  )
}
