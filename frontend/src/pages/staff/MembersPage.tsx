import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  getMembers,
  createMember,
  updateMember,
  updateMemberStatus,
  deleteMember,
  type Member,
  type MemberRoleType,
  type MemberStatus,
  type MemberInvitationResult,
} from '../../api/members'
import { getChama, type Chama } from '../../api/chamas'
import { extractErrorMessage } from '../../api/client'
import { useMyMembership } from '../../hooks/useMyMembership'
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
import Pagination from '../../components/ui/Pagination'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui/Table'
import { usePagination } from '../../hooks/usePagination'

const ALL_ROLES: MemberRoleType[] = ['CHAIRPERSON', 'TREASURER', 'SECRETARY', 'MEMBER']

const EMPTY_FORM = {
  email: '',
  fullName: '',
  phone: '',
  nationalId: '',
  nextOfKin: '',
  roles: ['MEMBER'] as MemberRoleType[],
}

function statusVariant(status: MemberStatus) {
  if (status === 'ACTIVE') return 'success' as const
  if (status === 'SUSPENDED') return 'warning' as const
  return 'muted' as const
}

export default function MembersPage() {
  const { chamaId: chamaIdParam } = useParams<{ chamaId: string }>()
  const chamaId = Number(chamaIdParam)
  const { isChairperson, loading: roleLoading } = useMyMembership(chamaId)

  const [chama, setChama] = useState<Chama | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [notice, setNotice] = useState<{ variant: 'success' | 'error'; message: string } | null>(null)
  const [modalNotice, setModalNotice] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Member | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [statusUpdating, setStatusUpdating] = useState<number | null>(null)
  const [inviteResult, setInviteResult] = useState<MemberInvitationResult | null>(null)
  const [removing, setRemoving] = useState<Member | null>(null)
  const [removeLoading, setRemoveLoading] = useState(false)
  const { page, totalPages, total, pageSize, pageItems, setPage } = usePagination(members)

  const refresh = () => {
    setLoading(true)
    Promise.all([getChama(chamaId), getMembers(chamaId)])
      .then(([c, m]) => {
        setChama(c)
        setMembers(m)
      })
      .finally(() => setLoading(false))
  }

  useEffect(refresh, [chamaId])

  const openCreate = () => {
    setEditing(null)
    setForm(EMPTY_FORM)
    setModalNotice(null)
    setInviteResult(null)
    setShowModal(true)
  }

  const openEdit = (member: Member) => {
    setEditing(member)
    setForm({
      email: '',
      fullName: member.fullName,
      phone: member.phone,
      nationalId: member.nationalId ?? '',
      nextOfKin: member.nextOfKin ?? '',
      roles: member.roles.length > 0 ? member.roles : ['MEMBER'],
    })
    setModalNotice(null)
    setShowModal(true)
  }

  const toggleRole = (role: MemberRoleType) => {
    setForm((f) => ({
      ...f,
      roles: f.roles.includes(role) ? f.roles.filter((r) => r !== role) : [...f.roles, role],
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setModalNotice(null)
    try {
      if (editing) {
        await updateMember(chamaId, editing.id, {
          fullName: form.fullName,
          phone: form.phone,
          nationalId: form.nationalId || undefined,
          nextOfKin: form.nextOfKin || undefined,
          roles: form.roles,
        })
        setNotice({ variant: 'success', message: `${form.fullName} updated.` })
      } else {
        const result = await createMember(chamaId, {
          email: form.email,
          fullName: form.fullName,
          phone: form.phone,
          nationalId: form.nationalId || undefined,
          nextOfKin: form.nextOfKin || undefined,
          roles: form.roles,
        })
        if (result.temporaryPassword) {
          setInviteResult(result)
        } else {
          setNotice({ variant: 'success', message: `${form.fullName} added to the chama.` })
          setShowModal(false)
        }
        refresh()
        return
      }
      setShowModal(false)
      refresh()
    } catch (err) {
      setModalNotice(extractErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const closeInviteResult = () => {
    setInviteResult(null)
    setShowModal(false)
  }

  const handleStatusChange = async (member: Member, status: MemberStatus) => {
    setStatusUpdating(member.id)
    try {
      await updateMemberStatus(chamaId, member.id, status)
      setNotice({ variant: 'success', message: `${member.fullName} is now ${status.toLowerCase()}.` })
      refresh()
    } catch (err) {
      setNotice({ variant: 'error', message: extractErrorMessage(err) })
    } finally {
      setStatusUpdating(null)
    }
  }

  const handleDelete = async () => {
    if (!removing) return
    setRemoveLoading(true)
    try {
      await deleteMember(chamaId, removing.id)
      setNotice({ variant: 'success', message: `${removing.fullName} removed.` })
      setRemoving(null)
      refresh()
    } catch (err) {
      setNotice({ variant: 'error', message: extractErrorMessage(err) })
    } finally {
      setRemoveLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-ink">Members</h1>
          {chama && <p className="text-sm text-muted">{chama.name}</p>}
        </div>
        {isChairperson && <Button onClick={openCreate}>+ Invite Member</Button>}
      </div>

      <TransientAlert variant={notice?.variant ?? 'success'} message={notice?.message ?? null} onDismiss={() => setNotice(null)} />

      {loading || roleLoading ? (
        <TablePageSkeleton withFilter={false} withButton={isChairperson} />
      ) : (
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Name</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Roles</TableHead>
              <TableHead>Status</TableHead>
              {isChairperson && <TableHead />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.length === 0 && (
              <TableRow><TableCell colSpan={5} className="py-10 text-center text-sm text-muted">No members yet.</TableCell></TableRow>
            )}
            {pageItems.map((m) => (
              <TableRow key={m.id}>
                <TableCell className="font-medium text-ink">{m.fullName}</TableCell>
                <TableCell className="font-mono text-muted">{m.phone}</TableCell>
                <TableCell className="space-x-1">
                  {m.roles.map((r) => <Badge key={r} label={r} variant="primary" />)}
                </TableCell>
                <TableCell><Badge label={m.status} variant={statusVariant(m.status)} /></TableCell>
                {isChairperson && (
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => openEdit(m)} className="rounded px-2 py-1.5 text-primary text-xs hover:bg-primary/10">Edit</button>
                      {m.status === 'ACTIVE' ? (
                        <button disabled={statusUpdating === m.id} onClick={() => handleStatusChange(m, 'SUSPENDED')}
                          className="rounded px-2 py-1.5 text-warning text-xs hover:bg-warning/10 disabled:opacity-40">Suspend</button>
                      ) : (
                        <button disabled={statusUpdating === m.id} onClick={() => handleStatusChange(m, 'ACTIVE')}
                          className="rounded px-2 py-1.5 text-success text-xs hover:bg-success/10 disabled:opacity-40">Activate</button>
                      )}
                      {m.status !== 'EXITED' && (
                        <button disabled={statusUpdating === m.id} onClick={() => handleStatusChange(m, 'EXITED')}
                          className="rounded px-2 py-1.5 text-muted text-xs hover:bg-paper-dim disabled:opacity-40">Mark exited</button>
                      )}
                      <span className="mx-1 h-4 w-px bg-black/10" aria-hidden="true" />
                      <button onClick={() => setRemoving(m)} className="rounded px-2 py-1.5 text-danger text-xs hover:bg-danger/10">Remove</button>
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {!loading && !roleLoading && (
        <Pagination page={page} totalPages={totalPages} total={total} pageSize={pageSize} onPage={setPage} label="members" />
      )}

      {showModal && !inviteResult && (
        <Modal title={editing ? 'Edit Member' : 'Invite Member'} onClose={() => setShowModal(false)}>
          <form onSubmit={handleSubmit} className="space-y-4">
            {modalNotice && (
              <div className="bg-danger/10 border border-danger/25 text-danger text-sm rounded-lg px-3 py-2">{modalNotice}</div>
            )}
            {!editing && (
              <FormField label="Email" htmlFor="member-email" required hint="We will create their account and email them sign-in instructions.">
                <Input id="member-email" required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </FormField>
            )}
            <FormField label="Full name" htmlFor="member-full-name" required>
              <Input id="member-full-name" required value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
            </FormField>
            <FormField label="Phone" htmlFor="member-phone" required>
              <PhoneInput value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} required />
            </FormField>
            <FormField label="National ID" htmlFor="member-national-id">
              <Input id="member-national-id" value={form.nationalId} onChange={(e) => setForm({ ...form, nationalId: e.target.value })} />
            </FormField>
            <FormField label="Next of kin" htmlFor="member-next-of-kin">
              <Input id="member-next-of-kin" value={form.nextOfKin} onChange={(e) => setForm({ ...form, nextOfKin: e.target.value })} />
            </FormField>
            <fieldset>
              <legend className="block text-sm font-medium text-ink/80 mb-1">Roles *</legend>
              <div className="flex flex-wrap gap-3">
                {ALL_ROLES.map((role) => (
                  <label key={role} className="inline-flex items-center gap-1.5 text-sm text-ink/80">
                    <input type="checkbox" checked={form.roles.includes(role)} onChange={() => toggleRole(role)} />
                    {role}
                  </label>
                ))}
              </div>
            </fieldset>

            <LoadingButton type="submit" loading={saving} loadingText="Saving…" disabled={form.roles.length === 0} className="w-full">
              {editing ? 'Save Changes' : 'Add Member'}
            </LoadingButton>
          </form>
        </Modal>
      )}

      {inviteResult && (
        <Modal title="Member Invited" onClose={closeInviteResult}>
          <div className="space-y-4">
            <p className="text-sm text-ink/80">
              An email with sign-in instructions was sent to <strong>{inviteResult.member.fullName}</strong>.
              If it does not arrive, you can share this temporary password directly.
            </p>
            <div className="bg-paper-dim border border-black/10 rounded-lg px-4 py-3 space-y-1.5 text-sm">
              <div><span className="text-muted">Email:</span> {form.email}</div>
              <div>
                <span className="text-muted">Temporary password:</span>{' '}
                <span className="font-mono bg-white border border-black/10 rounded px-2 py-0.5">
                  {inviteResult.temporaryPassword}
                </span>
              </div>
            </div>
            <Button onClick={closeInviteResult} className="w-full">Done</Button>
          </div>
        </Modal>
      )}

      {removing && (
        <ConfirmDialog
          title="Remove member"
          message={`Remove ${removing.fullName} from this chama?`}
          confirmLabel="Remove"
          loading={removeLoading}
          onConfirm={handleDelete}
          onCancel={() => setRemoving(null)}
        />
      )}
    </div>
  )
}
