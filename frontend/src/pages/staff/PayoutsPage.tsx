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
import { getChama, updateAutoPushSettings, type Chama } from '../../api/chamas'
import { extractErrorMessage } from '../../api/client'
import { useMyMembership } from '../../hooks/useMyMembership'
import { TablePageSkeleton } from '../../components/ui/SkeletonLayouts'
import LoadingButton from '../../components/ui/LoadingButton'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui/Table'
import Modal from '../../components/ui/Modal'
import FormError from '../../components/ui/FormError'
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
  const [chama, setChama] = useState<Chama | null>(null)
  const [loading, setLoading] = useState(true)
  const [notice, setNotice] = useState<{ variant: 'success' | 'error'; message: string } | null>(null)

  const [autoPushEnabled, setAutoPushEnabled] = useState(true)
  const [autoPushRetryHours, setAutoPushRetryHours] = useState('24')
  const [autoPushSaving, setAutoPushSaving] = useState(false)
  const [autoPushNotice, setAutoPushNotice] = useState<string | null>(null)

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
      canManage ? getChama(chamaId) : Promise.resolve(null),
    ])
      .then(([s, p, m, c]) => {
        setSchedule(s)
        setPayouts(p)
        setMembers(m)
        setChama(c)
        if (c) {
          setAutoPushEnabled(c.autoPushEnabled)
          setAutoPushRetryHours(String(c.autoPushRetryHours))
        }
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

  const handleSaveAutoPushSettings = async () => {
    if (!chama) return
    setAutoPushSaving(true)
    setAutoPushNotice(null)
    try {
      const updated = await updateAutoPushSettings(chama.id, {
        autoPushEnabled,
        autoPushRetryHours: Number(autoPushRetryHours),
      })
      setChama(updated)
      setNotice({ variant: 'success', message: 'Auto-push settings saved.' })
    } catch (err) {
      setAutoPushNotice(extractErrorMessage(err))
    } finally {
      setAutoPushSaving(false)
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
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Position</TableHead>
                  <TableHead>Member</TableHead>
                  <TableHead>Order</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {schedule.length === 0 && (
                  <TableRow><TableCell colSpan={4} className="py-10 text-center text-sm text-muted">No rotation schedule generated yet.</TableCell></TableRow>
                )}
                {schedule.map((entry) => (
                  <TableRow key={entry.id} className={member && entry.memberId === member.id ? 'bg-primary-light/40 hover:bg-primary-light/40' : undefined}>
                    <TableCell className="font-mono text-muted">{entry.sequencePosition}</TableCell>
                    <TableCell className="font-medium text-ink">{entry.memberName}</TableCell>
                    <TableCell className="text-muted">{entry.rotationOrderType}</TableCell>
                    <TableCell><Badge label={entry.status} variant={scheduleStatusVariant(entry.status)} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Reveal>

          <Reveal eager delayMs={160} as="section" className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-heading text-lg font-semibold text-ink">{canManage ? 'Payouts' : 'My Payouts'}</h2>
              {canManage && <Button onClick={openPayoutModal}>Create Next Payout</Button>}
            </div>
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Round</TableHead>
                  {canManage && <TableHead>Member</TableHead>}
                  <TableHead>Scheduled</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {payouts.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="py-10 text-center text-sm text-muted">No payouts yet.</TableCell></TableRow>
                )}
                {payouts.map((payout) => (
                  <TableRow key={payout.id}>
                    <TableCell className="font-mono text-muted">{payout.roundNumber}</TableCell>
                    {canManage && <TableCell className="font-medium text-ink">{payout.memberName}</TableCell>}
                    <TableCell className="text-muted">{payout.scheduledDate}</TableCell>
                    <TableCell className="font-mono text-muted">{payout.amount.toLocaleString()}</TableCell>
                    <TableCell><Badge label={payout.status} variant={payoutStatusVariant(payout.status)} /></TableCell>
                    <TableCell className="text-right">
                      {canManage && payout.status === 'SCHEDULED' && (
                        <button onClick={() => setDisbursingPayout(payout)} className="text-brand text-xs hover:underline">
                          Disburse
                        </button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Reveal>

          {canManage && chama && (
            <section className="space-y-3 rounded-xl border border-border bg-surface p-4">
              <h2 className="font-heading text-lg font-semibold text-ink">Auto-push settings</h2>
              <p className="text-xs text-muted">
                Controls the automatic M-Pesa prompt sent to members who have opted in to
                auto-pay on their contribution's due date.
              </p>
              {autoPushNotice && (
                <FormError message={autoPushNotice} />
              )}
              <label className="flex items-center gap-2 text-sm text-ink/80">
                <input
                  type="checkbox"
                  checked={autoPushEnabled}
                  onChange={(e) => setAutoPushEnabled(e.target.checked)}
                  aria-label="Enable auto-push"
                />
                Enable automatic M-Pesa prompts
              </label>
              <FormField
                label="Retry after (hours)"
                htmlFor="payout-auto-push-retry-hours"
                hint="How long to wait before re-sending a prompt to a member who hasn't paid yet."
              >
                <Input
                  id="payout-auto-push-retry-hours"
                  type="number"
                  min="1"
                  max="168"
                  step="1"
                  value={autoPushRetryHours}
                  onChange={(e) => setAutoPushRetryHours(e.target.value)}
                  disabled={!autoPushEnabled}
                />
              </FormField>
              <LoadingButton
                type="button"
                variant="secondary"
                loading={autoPushSaving}
                loadingText="Saving…"
                onClick={handleSaveAutoPushSettings}
              >
                Save Auto-Push Settings
              </LoadingButton>
            </section>
          )}
        </>
      )}

      {showScheduleModal && (
        <Modal title="Generate Payout Schedule" onClose={() => setShowScheduleModal(false)}>
          <form onSubmit={handleGenerateSchedule} className="space-y-4">
            {scheduleModalNotice && (
              <FormError message={scheduleModalNotice} />
            )}
            <p className="text-xs text-muted">Regenerating replaces the current rotation schedule.</p>
            <FormField label="Rotation order" htmlFor="payout-rotation-type" required>
              <Select
                id="payout-rotation-type"
                value={scheduleForm.rotationOrderType}
                onChange={(v) => setScheduleForm({ rotationOrderType: v as RotationOrderType })}
              >
                <option value="SENIORITY">Seniority (by join date)</option>
                <option value="RANDOM">Random</option>
                <option value="AGREED">Agreed order</option>
              </Select>
            </FormField>
            {scheduleForm.rotationOrderType === 'AGREED' && (
              <div>
                <p className="mb-1 text-sm font-medium text-ink/80">Order (top goes first)</p>
                <ul className="divide-y divide-border rounded-lg border border-border">
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
              <FormError message={payoutModalNotice} />
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
