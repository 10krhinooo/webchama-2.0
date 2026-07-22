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
import Badge from '../../components/ui/Badge'
import Modal from '../../components/ui/Modal'
import TransientAlert from '../../components/ui/TransientAlert'
import PhoneInput from '../../components/ui/PhoneInput'

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

  const handleDelete = async (member: Member) => {
    if (!confirm(`Remove ${member.fullName} from this chama?`)) return
    try {
      await deleteMember(chamaId, member.id)
      setNotice({ variant: 'success', message: `${member.fullName} removed.` })
      refresh()
    } catch (err) {
      setNotice({ variant: 'error', message: extractErrorMessage(err) })
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-ink">Members</h1>
          {chama && <p className="text-sm text-muted">{chama.name}</p>}
        </div>
        {isChairperson && (
          <button
            onClick={openCreate}
            className="bg-primary text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-primary-dark"
          >
            + Invite Member
          </button>
        )}
      </div>

      <TransientAlert variant={notice?.variant ?? 'success'} message={notice?.message ?? null} onDismiss={() => setNotice(null)} />

      {loading || roleLoading ? (
        <TablePageSkeleton withFilter={false} withButton={isChairperson} />
      ) : (
        <div className="bg-white rounded-2xl shadow-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-paper-dim border-b border-black/10">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-ink/80">Name</th>
                <th className="text-left px-4 py-3 font-medium text-ink/80">Phone</th>
                <th className="text-left px-4 py-3 font-medium text-ink/80">Roles</th>
                <th className="text-left px-4 py-3 font-medium text-ink/80">Status</th>
                {isChairperson && <th />}
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5">
              {members.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-10 text-center text-muted text-sm">No members yet.</td></tr>
              )}
              {members.map((m) => (
                <tr key={m.id} className="hover:bg-paper-dim/30">
                  <td className="px-4 py-3 font-medium text-ink">{m.fullName}</td>
                  <td className="px-4 py-3 font-mono text-muted">{m.phone}</td>
                  <td className="px-4 py-3 space-x-1">
                    {m.roles.map((r) => <Badge key={r} label={r} variant="primary" />)}
                  </td>
                  <td className="px-4 py-3"><Badge label={m.status} variant={statusVariant(m.status)} /></td>
                  {isChairperson && (
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-3">
                        <button onClick={() => openEdit(m)} className="text-primary text-xs hover:underline">Edit</button>
                        {m.status === 'ACTIVE' ? (
                          <button disabled={statusUpdating === m.id} onClick={() => handleStatusChange(m, 'SUSPENDED')}
                            className="text-warning text-xs hover:underline disabled:opacity-40">Suspend</button>
                        ) : (
                          <button disabled={statusUpdating === m.id} onClick={() => handleStatusChange(m, 'ACTIVE')}
                            className="text-success text-xs hover:underline disabled:opacity-40">Activate</button>
                        )}
                        {m.status !== 'EXITED' && (
                          <button disabled={statusUpdating === m.id} onClick={() => handleStatusChange(m, 'EXITED')}
                            className="text-muted text-xs hover:underline disabled:opacity-40">Mark exited</button>
                        )}
                        <button onClick={() => handleDelete(m)} className="text-danger text-xs hover:underline">Remove</button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && !inviteResult && (
        <Modal title={editing ? 'Edit Member' : 'Invite Member'} onClose={() => setShowModal(false)}>
          <form onSubmit={handleSubmit} className="space-y-4">
            {modalNotice && (
              <div className="bg-danger/10 border border-danger/25 text-danger text-sm rounded-lg px-3 py-2">{modalNotice}</div>
            )}
            {!editing && (
              <div>
                <label htmlFor="member-email" className="block text-sm font-medium text-ink/80 mb-1">Email *</label>
                <input id="member-email" required type="email" value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full border border-black/15 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                <p className="text-xs text-muted mt-1">
                  We will create their account and email them sign-in instructions.
                </p>
              </div>
            )}
            <div>
              <label htmlFor="member-full-name" className="block text-sm font-medium text-ink/80 mb-1">Full name *</label>
              <input id="member-full-name" required value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                className="w-full border border-black/15 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
            </div>
            <div>
              <label htmlFor="member-phone" className="block text-sm font-medium text-ink/80 mb-1">Phone *</label>
              <PhoneInput value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} required />
            </div>
            <div>
              <label htmlFor="member-national-id" className="block text-sm font-medium text-ink/80 mb-1">National ID</label>
              <input id="member-national-id" value={form.nationalId} onChange={(e) => setForm({ ...form, nationalId: e.target.value })}
                className="w-full border border-black/15 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
            </div>
            <div>
              <label htmlFor="member-next-of-kin" className="block text-sm font-medium text-ink/80 mb-1">Next of kin</label>
              <input id="member-next-of-kin" value={form.nextOfKin} onChange={(e) => setForm({ ...form, nextOfKin: e.target.value })}
                className="w-full border border-black/15 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
            </div>
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

            <LoadingButton type="submit" loading={saving} loadingText="Saving…" disabled={form.roles.length === 0}
              className="w-full bg-primary text-white font-semibold py-2.5 rounded-xl hover:bg-primary-dark disabled:opacity-50">
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
            <button onClick={closeInviteResult}
              className="w-full bg-primary text-white font-semibold py-2.5 rounded-xl hover:bg-primary-dark">
              Done
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
