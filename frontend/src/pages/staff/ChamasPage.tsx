import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  getChamas,
  createChama,
  updateChama,
  deleteChama,
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
import { usePagination } from '../../hooks/usePagination'

const EMPTY_FORM = {
  name: '',
  description: '',
  type: 'MERRY_GO_ROUND' as Chama['type'],
  currency: 'KES',
  contributionFrequency: 'MONTHLY' as Chama['contributionFrequency'],
  contributionAmount: '',
  meetingDay: '',
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
      creatorFullName: '',
      creatorPhone: '',
    })
    setModalNotice(null)
    setShowModal(true)
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
        <div className="bg-white rounded-2xl shadow-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-paper-dim border-b border-black/10">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-ink/80">Name</th>
                <th className="text-left px-4 py-3 font-medium text-ink/80">Type</th>
                <th className="text-left px-4 py-3 font-medium text-ink/80">Contribution</th>
                <th className="text-left px-4 py-3 font-medium text-ink/80">Status</th>
                <th />
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5">
              {chamas.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-10 text-center text-muted text-sm">You are not part of any chama yet.</td></tr>
              )}
              {pageItems.map((c) => (
                <tr key={c.id} className="hover:bg-paper-dim/30">
                  <td className="px-4 py-3 font-medium text-ink">
                    <Link to={`/chamas/${c.id}/members`} className="hover:underline">{c.name}</Link>
                  </td>
                  <td className="px-4 py-3 text-muted">{c.type.replaceAll('_', ' ')}</td>
                  <td className="px-4 py-3 font-mono text-muted">
                    {c.currency} {c.contributionAmount.toLocaleString()} / {c.contributionFrequency.toLowerCase()}
                  </td>
                  <td className="px-4 py-3"><Badge label={c.status} variant={statusVariant(c.status)} /></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-3">
                      <button onClick={() => openEdit(c)} className="text-primary text-xs hover:underline">Edit</button>
                      <button onClick={() => setDeleting(c)} className="text-danger text-xs hover:underline">Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
                <Select id="chama-type" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as Chama['type'] })}>
                  <option value="MERRY_GO_ROUND">Merry-go-round</option>
                  <option value="TABLE_BANKING">Table banking</option>
                  <option value="INVESTMENT_GROUP">Investment group</option>
                </Select>
              </FormField>
              <FormField label="Frequency" htmlFor="chama-frequency" required>
                <Select
                  id="chama-frequency"
                  value={form.contributionFrequency}
                  onChange={(e) => setForm({ ...form, contributionFrequency: e.target.value as Chama['contributionFrequency'] })}
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
