import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  getChamas,
  createChama,
  updateChama,
  deleteChama,
  regenerateJoinCode,
  inviteToChama,
  updateAutoPushSettings,
  type Chama,
  type CreateChamaRequest,
  type UpdateChamaRequest,
} from '../../api/chamas'
import { extractErrorMessage } from '../../api/client'
import { TablePageSkeleton } from '../../components/ui/SkeletonLayouts'
import LoadingButton from '../../components/ui/LoadingButton'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import Modal from '../../components/ui/Modal'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import TransientAlert from '../../components/ui/TransientAlert'
import PhoneInput from '../../components/ui/PhoneInput'
import FormField from '../../components/ui/FormField'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import Textarea from '../../components/ui/Textarea'
import Pagination from '../../components/ui/Pagination'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui/Table'
import { usePagination } from '../../hooks/usePagination'

const EMPTY_FORM = {
  name: '',
  description: '',
  type: 'MERRY_GO_ROUND' as Chama['type'],
  currency: 'KES',
  contributionFrequency: 'MONTHLY' as Chama['contributionFrequency'],
  contributionAmount: '',
  meetingDay: '',
  savingsTarget: '',
  creatorFullName: '',
  creatorPhone: '',
}

export default function ChamasPage() {
  const [chamas, setChamas] = useState<Chama[]>([])
  const [loading, setLoading] = useState(true)
  const [notice, setNotice] = useState<{ variant: 'success' | 'error'; message: string } | null>(null)
  const [modalNotice, setModalNotice] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Chama | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [deleting, setDeleting] = useState<Chama | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [regenerating, setRegenerating] = useState(false)
  const [copied, setCopied] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviting, setInviting] = useState(false)
  const [inviteNotice, setInviteNotice] = useState<string | null>(null)
  const [autoPushEnabled, setAutoPushEnabled] = useState(true)
  const [autoPushRetryHours, setAutoPushRetryHours] = useState('24')
  const [autoPushSaving, setAutoPushSaving] = useState(false)
  const [autoPushNotice, setAutoPushNotice] = useState<string | null>(null)
  const { page, totalPages, total, pageSize, pageItems, setPage } = usePagination(chamas)

  const refresh = () => {
    setLoading(true)
    getChamas().then(setChamas).finally(() => setLoading(false))
  }

  useEffect(refresh, [])

  const openCreate = () => {
    setEditing(null)
    setForm(EMPTY_FORM)
    setModalNotice(null)
    setShowModal(true)
  }

  const openEdit = (chama: Chama) => {
    setEditing(chama)
    setForm({
      name: chama.name,
      description: chama.description ?? '',
      type: chama.type,
      currency: chama.currency,
      contributionFrequency: chama.contributionFrequency,
      contributionAmount: String(chama.contributionAmount),
      meetingDay: chama.meetingDay ?? '',
      savingsTarget: chama.savingsTarget != null ? String(chama.savingsTarget) : '',
      creatorFullName: '',
      creatorPhone: '',
    })
    setAutoPushEnabled(chama.autoPushEnabled)
    setAutoPushRetryHours(String(chama.autoPushRetryHours))
    setAutoPushNotice(null)
    setModalNotice(null)
    setCopied(false)
    setInviteEmail('')
    setInviteNotice(null)
    setShowModal(true)
  }

  const handleCopyJoinCode = async () => {
    if (!editing) return
    await navigator.clipboard.writeText(editing.joinCode)
    setCopied(true)
  }

  const handleRegenerateJoinCode = async () => {
    if (!editing) return
    setRegenerating(true)
    try {
      const updated = await regenerateJoinCode(editing.id)
      setEditing(updated)
      setChamas((prev) => prev.map((c) => (c.id === updated.id ? updated : c)))
      setCopied(false)
      setNotice({ variant: 'success', message: 'Join code regenerated. The old code no longer works.' })
    } catch (err) {
      setModalNotice(extractErrorMessage(err))
    } finally {
      setRegenerating(false)
    }
  }

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editing) return
    setInviting(true)
    setInviteNotice(null)
    try {
      await inviteToChama(editing.id, { email: inviteEmail })
      setNotice({ variant: 'success', message: `Invite sent to ${inviteEmail}.` })
      setInviteEmail('')
    } catch (err) {
      setInviteNotice(extractErrorMessage(err))
    } finally {
      setInviting(false)
    }
  }

  const handleSaveAutoPushSettings = async () => {
    if (!editing) return
    setAutoPushSaving(true)
    setAutoPushNotice(null)
    try {
      const updated = await updateAutoPushSettings(editing.id, {
        autoPushEnabled,
        autoPushRetryHours: Number(autoPushRetryHours),
      })
      setEditing(updated)
      setChamas((prev) => prev.map((c) => (c.id === updated.id ? updated : c)))
      setNotice({ variant: 'success', message: 'Auto-push settings saved.' })
    } catch (err) {
      setAutoPushNotice(extractErrorMessage(err))
    } finally {
      setAutoPushSaving(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setModalNotice(null)
    try {
      const base: UpdateChamaRequest = {
        name: form.name,
        description: form.description || undefined,
        type: form.type,
        currency: form.currency || undefined,
        contributionFrequency: form.contributionFrequency,
        contributionAmount: Number(form.contributionAmount),
        meetingDay: form.meetingDay || undefined,
        savingsTarget: form.savingsTarget ? Number(form.savingsTarget) : undefined,
      }
      if (editing) {
        await updateChama(editing.id, base)
        setNotice({ variant: 'success', message: `${form.name} updated.` })
      } else {
        const payload: CreateChamaRequest = {
          ...base,
          creatorFullName: form.creatorFullName,
          creatorPhone: form.creatorPhone,
        }
        await createChama(payload)
        setNotice({ variant: 'success', message: `${form.name} created. You are its chairperson.` })
      }
      setShowModal(false)
      refresh()
    } catch (err) {
      setModalNotice(extractErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleting) return
    setDeleteLoading(true)
    try {
      await deleteChama(deleting.id)
      setNotice({ variant: 'success', message: `${deleting.name} deleted.` })
      setDeleting(null)
      refresh()
    } catch (err) {
      setNotice({ variant: 'error', message: extractErrorMessage(err) })
    } finally {
      setDeleteLoading(false)
    }
  }

  const statusVariant = (status: Chama['status']) => (status === 'ACTIVE' ? ('success' as const) : ('muted' as const))

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl font-bold text-ink">Chamas</h1>
        <Button onClick={openCreate}>+ New Chama</Button>
      </div>

      <TransientAlert variant={notice?.variant ?? 'success'} message={notice?.message ?? null} onDismiss={() => setNotice(null)} />

      {loading ? (
        <TablePageSkeleton withFilter={false} />
      ) : (
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Contribution</TableHead>
              <TableHead>Status</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {chamas.length === 0 && (
              <TableRow><TableCell colSpan={5} className="py-10 text-center text-sm text-muted">You are not part of any chama yet.</TableCell></TableRow>
            )}
            {pageItems.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium text-ink">
                  <Link to={`/chamas/${c.id}/members`} className="hover:underline">{c.name}</Link>
                </TableCell>
                <TableCell className="text-muted">{c.type.replaceAll('_', ' ')}</TableCell>
                <TableCell className="font-mono text-muted">
                  {c.currency} {c.contributionAmount.toLocaleString()} / {c.contributionFrequency.toLowerCase()}
                </TableCell>
                <TableCell><Badge label={c.status} variant={statusVariant(c.status)} /></TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-3">
                    <button onClick={() => openEdit(c)} className="text-primary text-xs hover:underline">Edit</button>
                    <button onClick={() => setDeleting(c)} className="text-danger text-xs hover:underline">Delete</button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {!loading && (
        <Pagination page={page} totalPages={totalPages} total={total} pageSize={pageSize} onPage={setPage} label="chamas" />
      )}

      {showModal && (
        <Modal title={editing ? 'Edit Chama' : 'New Chama'} onClose={() => setShowModal(false)}>
          <form onSubmit={handleSubmit} className="space-y-4">
            {modalNotice && (
              <div className="bg-danger/10 border border-danger/25 text-danger text-sm rounded-lg px-3 py-2">{modalNotice}</div>
            )}
            <FormField label="Name" htmlFor="chama-name" required>
              <Input id="chama-name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </FormField>
            <FormField label="Description" htmlFor="chama-description">
              <Textarea id="chama-description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </FormField>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Type" htmlFor="chama-type" required>
                <Select id="chama-type" value={form.type} onChange={(v) => setForm({ ...form, type: v as Chama['type'] })}>
                  <option value="MERRY_GO_ROUND">Merry-go-round</option>
                  <option value="TABLE_BANKING">Table banking</option>
                  <option value="INVESTMENT_GROUP">Investment group</option>
                </Select>
              </FormField>
              <FormField label="Frequency" htmlFor="chama-frequency" required>
                <Select
                  id="chama-frequency"
                  value={form.contributionFrequency}
                  onChange={(v) => setForm({ ...form, contributionFrequency: v as Chama['contributionFrequency'] })}
                >
                  <option value="WEEKLY">Weekly</option>
                  <option value="MONTHLY">Monthly</option>
                </Select>
              </FormField>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Contribution amount" htmlFor="chama-amount" required>
                <Input
                  id="chama-amount"
                  required
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.contributionAmount}
                  onChange={(e) => setForm({ ...form, contributionAmount: e.target.value })}
                />
              </FormField>
              <FormField label="Currency" htmlFor="chama-currency">
                <Input id="chama-currency" value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} />
              </FormField>
            </div>
            <FormField label="Meeting day" htmlFor="chama-meeting-day">
              <Input
                id="chama-meeting-day"
                value={form.meetingDay}
                onChange={(e) => setForm({ ...form, meetingDay: e.target.value })}
                placeholder="e.g. Last Saturday of the month"
              />
            </FormField>
            <FormField
              label="Savings target"
              htmlFor="chama-savings-target"
              hint="Optional lifetime savings goal, shown as progress on the dashboard."
            >
              <Input
                id="chama-savings-target"
                type="number"
                min="0"
                step="0.01"
                value={form.savingsTarget}
                onChange={(e) => setForm({ ...form, savingsTarget: e.target.value })}
                placeholder="e.g. 500000"
              />
            </FormField>

            {editing && (
              <div className="border-t border-ink/10 pt-4 space-y-3">
                <h3 className="text-sm font-semibold text-ink">Auto-push settings</h3>
                <p className="text-xs text-muted">
                  Controls the automatic M-Pesa prompt sent to members who have opted in to
                  auto-pay on their contribution's due date.
                </p>
                {autoPushNotice && (
                  <div className="bg-danger/10 border border-danger/25 text-danger text-sm rounded-lg px-3 py-2">{autoPushNotice}</div>
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
                  htmlFor="chama-auto-push-retry-hours"
                  hint="How long to wait before re-sending a prompt to a member who hasn't paid yet."
                >
                  <Input
                    id="chama-auto-push-retry-hours"
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
              </div>
            )}

            {!editing && (
              <>
                <FormField label="Your full name" htmlFor="chama-creator-name" required>
                  <Input
                    id="chama-creator-name"
                    required
                    value={form.creatorFullName}
                    onChange={(e) => setForm({ ...form, creatorFullName: e.target.value })}
                  />
                </FormField>
                <FormField label="Your phone" htmlFor="chama-creator-phone" required>
                  <PhoneInput value={form.creatorPhone} onChange={(v) => setForm({ ...form, creatorPhone: v })} required />
                </FormField>
                <p className="text-xs text-muted -mt-1">You will become this chama&apos;s chairperson.</p>
              </>
            )}

            <LoadingButton type="submit" loading={saving} loadingText="Saving…" className="w-full">
              {editing ? 'Save Changes' : 'Create Chama'}
            </LoadingButton>
          </form>

          {editing && (
            <div className="mt-6 border-t border-ink/10 pt-4 space-y-3">
              <h3 className="text-sm font-semibold text-ink">Join code</h3>
              <p className="text-xs text-muted">
                Share this code so an already-registered user can join this chama themselves, or email it to them directly.
              </p>
              <div className="flex items-center gap-2">
                <Input readOnly value={editing.joinCode} className="font-mono uppercase tracking-widest" />
                <Button type="button" variant="secondary" onClick={handleCopyJoinCode}>
                  {copied ? 'Copied' : 'Copy'}
                </Button>
              </div>
              <LoadingButton type="button" variant="secondary" loading={regenerating} loadingText="Regenerating…" onClick={handleRegenerateJoinCode}>
                Regenerate code
              </LoadingButton>

              <form onSubmit={handleInvite} className="flex items-end gap-2 pt-2">
                <FormField label="Invite by email" htmlFor="chama-invite-email" hint={inviteNotice ?? undefined}>
                  <Input
                    id="chama-invite-email"
                    type="email"
                    required
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="member@example.com"
                    invalid={!!inviteNotice}
                  />
                </FormField>
                <LoadingButton type="submit" loading={inviting} loadingText="Sending…">
                  Send invite
                </LoadingButton>
              </form>
            </div>
          )}
        </Modal>
      )}

      {deleting && (
        <ConfirmDialog
          title="Delete chama"
          message={`Delete ${deleting.name}? This removes all its members and contributions.`}
          confirmLabel="Delete"
          loading={deleteLoading}
          onConfirm={handleDelete}
          onCancel={() => setDeleting(null)}
        />
      )}
    </div>
  )
}
