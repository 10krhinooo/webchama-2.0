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
  chamaLogoUrl,
  uploadChamaLogo,
  deleteChamaLogo,
} from '../../api/chamas'
import { extractErrorMessage } from '../../api/client'
import LoadFailed from '../../components/ui/LoadFailed'
import EmptyState from '../../components/ui/EmptyState'
import { TablePageSkeleton } from '../../components/ui/SkeletonLayouts'
import LoadingButton from '../../components/ui/LoadingButton'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import Modal from '../../components/ui/Modal'
import FormError from '../../components/ui/FormError'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import TransientAlert from '../../components/ui/TransientAlert'
import PhoneInput from '../../components/ui/PhoneInput'
import FormField from '../../components/ui/FormField'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import Textarea from '../../components/ui/Textarea'
import Pagination from '../../components/ui/Pagination'
import Reveal from '../../components/ui/Reveal'
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
  postalAddress: '',
  physicalAddress: '',
  contactPhone: '',
  contactEmail: '',
  registrationNumber: '',
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
  const [logoBusy, setLogoBusy] = useState(false)
  // Bumped after every logo change so the browser refetches an image it is otherwise caching.
  const [logoVersion, setLogoVersion] = useState(0)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const { page, totalPages, total, pageSize, pageItems, setPage } = usePagination(chamas)

  const refresh = () => {
    setLoading(true)
    setLoadError(null)
    getChamas()
      .then(setChamas)
      .catch((err) => setLoadError(extractErrorMessage(err)))
      .finally(() => setLoading(false))
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
      postalAddress: chama.postalAddress ?? '',
      physicalAddress: chama.physicalAddress ?? '',
      contactPhone: chama.contactPhone ?? '',
      contactEmail: chama.contactEmail ?? '',
      registrationNumber: chama.registrationNumber ?? '',
    })
    setModalNotice(null)
    setShowModal(true)
  }

  const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    // Clearing the input means a second attempt at the same file still fires a change event.
    e.target.value = ''
    if (!file || !editing) return

    setLogoBusy(true)
    setModalNotice(null)
    try {
      const updated = await uploadChamaLogo(editing.id, file)
      setEditing(updated)
      setLogoVersion((v) => v + 1)
      refresh()
    } catch (err) {
      setModalNotice(extractErrorMessage(err))
    } finally {
      setLogoBusy(false)
    }
  }

  const handleLogoRemove = async () => {
    if (!editing) return
    setLogoBusy(true)
    setModalNotice(null)
    try {
      setEditing(await deleteChamaLogo(editing.id))
      setLogoVersion((v) => v + 1)
      refresh()
    } catch (err) {
      setModalNotice(extractErrorMessage(err))
    } finally {
      setLogoBusy(false)
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
        postalAddress: form.postalAddress || undefined,
        physicalAddress: form.physicalAddress || undefined,
        contactPhone: form.contactPhone || undefined,
        contactEmail: form.contactEmail || undefined,
        registrationNumber: form.registrationNumber || undefined,
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
      refresh()
    } catch (err) {
      setNotice({ variant: 'error', message: extractErrorMessage(err) })
    } finally {
      setDeleteLoading(false)
      // Dismissed either way, so a refusal is readable. The banner sits behind the overlay in the
      // subtree the dialog marks aria-hidden while it is open.
      setDeleting(null)
    }
  }

  const statusVariant = (status: Chama['status']) => (status === 'ACTIVE' ? ('success' as const) : ('muted' as const))

  return (
    <div className="space-y-4">
      <Reveal eager className="flex items-center justify-between">
        <h1 className="font-heading text-2xl font-bold text-ink">Chamas</h1>
        <Button onClick={openCreate}>+ New Chama</Button>
      </Reveal>

      <TransientAlert variant={notice?.variant ?? 'success'} message={notice?.message ?? null} onDismiss={() => setNotice(null)} />

      {loading ? (
        <TablePageSkeleton withFilter={false} />
      ) : loadError ? (
        <LoadFailed what="your chamas" detail={loadError} onRetry={refresh} />
      ) : (
        <Reveal eager delayMs={80}>
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
                <TableRow>
                  <TableCell colSpan={5}>
                    <EmptyState title="You are not part of any chama yet" description="Create one, or join an existing chama with its code." />
                  </TableCell>
                </TableRow>
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
                      <button onClick={() => openEdit(c)} className="text-brand text-xs hover:underline">Edit</button>
                      <button onClick={() => setDeleting(c)} className="text-danger text-xs hover:underline">Delete</button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Reveal>
      )}

      {!loading && (
        <Pagination page={page} totalPages={totalPages} total={total} pageSize={pageSize} onPage={setPage} label="chamas" />
      )}

      {showModal && (
        <Modal title={editing ? 'Edit Chama' : 'New Chama'} onClose={() => setShowModal(false)}>
          <form onSubmit={handleSubmit} className="space-y-4">
            {modalNotice && (
              <FormError message={modalNotice} />
            )}
            <FormField label="Name" htmlFor="chama-name" required>
              <Input id="chama-name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </FormField>
            <FormField label="Description" htmlFor="chama-description">
              <Textarea id="chama-description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </FormField>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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

            {/*
              Edit only. A chama that does not exist yet has nothing to attach a logo to, and
              holding the file in memory until the create succeeds would be a second upload path
              for one rare case.
            */}
            {editing && (
              <FormField label="Logo" htmlFor="chama-logo" hint="PNG or JPEG, up to 256KB. Appears on the documents this chama issues.">
                <div className="flex items-center gap-4">
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-paper-dim">
                    {editing.hasLogo ? (
                      <img
                        src={`${chamaLogoUrl(editing.id)}?v=${logoVersion}`}
                        alt={`${editing.name} logo`}
                        className="h-full w-full object-contain"
                      />
                    ) : (
                      <span className="text-xs text-muted">None</span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      id="chama-logo"
                      type="file"
                      accept="image/png,image/jpeg"
                      disabled={logoBusy}
                      onChange={handleLogoChange}
                      className="text-sm text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-on-dark hover:file:bg-primary-dark"
                    />
                    {editing.hasLogo && (
                      <Button type="button" variant="secondary" onClick={handleLogoRemove} disabled={logoBusy}>
                        Remove
                      </Button>
                    )}
                  </div>
                </div>
              </FormField>
            )}

            {/*
              These are what the chama puts at the top of the documents it issues, so a receipt
              says who it came from. Grouped and labelled rather than appended to the list above,
              because they answer a different question from the money settings.
            */}
            <fieldset className="space-y-4 border-t border-border pt-4">
              <legend className="font-heading text-xs font-semibold uppercase tracking-widest text-muted">
                Chama details
              </legend>
              <p className="-mt-1 text-xs text-muted">
                Optional. Whatever you fill in appears on the receipts and statements this chama
                issues.
              </p>
              <FormField label="Postal address" htmlFor="chama-postal-address">
                <Input
                  id="chama-postal-address"
                  placeholder="e.g. P.O. Box 4021-00100, Nairobi"
                  value={form.postalAddress}
                  onChange={(e) => setForm({ ...form, postalAddress: e.target.value })}
                />
              </FormField>
              <FormField label="Physical address" htmlFor="chama-physical-address">
                <Input
                  id="chama-physical-address"
                  placeholder="e.g. Kenyatta Avenue, Nairobi"
                  value={form.physicalAddress}
                  onChange={(e) => setForm({ ...form, physicalAddress: e.target.value })}
                />
              </FormField>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <FormField label="Contact phone" htmlFor="chama-contact-phone">
                  <Input
                    id="chama-contact-phone"
                    value={form.contactPhone}
                    onChange={(e) => setForm({ ...form, contactPhone: e.target.value })}
                  />
                </FormField>
                <FormField label="Contact email" htmlFor="chama-contact-email">
                  <Input
                    id="chama-contact-email"
                    type="email"
                    value={form.contactEmail}
                    onChange={(e) => setForm({ ...form, contactEmail: e.target.value })}
                  />
                </FormField>
              </div>
              <FormField label="Registration number" htmlFor="chama-registration-number">
                <Input
                  id="chama-registration-number"
                  placeholder="e.g. CBO/2019/4021"
                  value={form.registrationNumber}
                  onChange={(e) => setForm({ ...form, registrationNumber: e.target.value })}
                />
              </FormField>
            </fieldset>

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
                  <PhoneInput id="chama-creator-phone" value={form.creatorPhone} onChange={(v) => setForm({ ...form, creatorPhone: v })} required />
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
