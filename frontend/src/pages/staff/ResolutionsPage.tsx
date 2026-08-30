import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  getResolutions,
  openResolution,
  castResolutionVote,
  closeResolution,
  type Resolution,
  type VoteChoice,
} from '../../api/resolutions'
import { getMeetings, type Meeting } from '../../api/meetings'
import { extractErrorMessage } from '../../api/client'
import { useMyMembership } from '../../hooks/useMyMembership'
import { usePagination } from '../../hooks/usePagination'
import { TablePageSkeleton } from '../../components/ui/SkeletonLayouts'
import LoadingButton from '../../components/ui/LoadingButton'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui/Table'
import Modal from '../../components/ui/Modal'
import TransientAlert from '../../components/ui/TransientAlert'
import FormField from '../../components/ui/FormField'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import Pagination from '../../components/ui/Pagination'

const EMPTY_FORM = { meetingId: '', title: '', description: '' }

function resolutionStatusVariant(status: Resolution['status']) {
  if (status === 'PASSED') return 'success' as const
  if (status === 'REJECTED') return 'danger' as const
  return 'primary' as const
}

export default function ResolutionsPage() {
  const { chamaId: chamaIdParam } = useParams<{ chamaId: string }>()
  const chamaId = Number(chamaIdParam)
  const { isSecretary, isChairperson, loading: roleLoading } = useMyMembership(chamaId)
  const canManage = isSecretary || isChairperson

  const [resolutions, setResolutions] = useState<Resolution[]>([])
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [loading, setLoading] = useState(true)
  const [notice, setNotice] = useState<{ variant: 'success' | 'error'; message: string } | null>(null)
  const [modalNotice, setModalNotice] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [showOpenModal, setShowOpenModal] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [votingId, setVotingId] = useState<number | null>(null)
  const [closingId, setClosingId] = useState<number | null>(null)
  const { page, totalPages, total, pageSize, pageItems, setPage } = usePagination(resolutions)

  const refresh = () => {
    if (roleLoading) return
    setLoading(true)
    Promise.all([getResolutions(chamaId), canManage ? getMeetings(chamaId) : Promise.resolve([])])
      .then(([r, m]) => {
        setResolutions(r)
        setMeetings(m)
      })
      .finally(() => setLoading(false))
  }

  useEffect(refresh, [chamaId, canManage, roleLoading])

  const openCreate = () => {
    setForm(EMPTY_FORM)
    setModalNotice(null)
    setShowOpenModal(true)
  }

  const handleOpen = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setModalNotice(null)
    try {
      await openResolution(chamaId, {
        meetingId: Number(form.meetingId),
        title: form.title,
        description: form.description || undefined,
      })
      setNotice({ variant: 'success', message: 'Resolution opened.' })
      setShowOpenModal(false)
      refresh()
    } catch (err) {
      setModalNotice(extractErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const handleVote = async (resolution: Resolution, choice: VoteChoice) => {
    setVotingId(resolution.id)
    try {
      await castResolutionVote(chamaId, resolution.id, choice)
      setNotice({ variant: 'success', message: 'Your vote has been recorded.' })
      refresh()
    } catch (err) {
      setNotice({ variant: 'error', message: extractErrorMessage(err) })
    } finally {
      setVotingId(null)
    }
  }

  const handleClose = async (resolution: Resolution) => {
    setClosingId(resolution.id)
    try {
      const closed = await closeResolution(chamaId, resolution.id)
      setNotice({ variant: 'success', message: `Resolution "${closed.title}" closed as ${closed.status}.` })
      refresh()
    } catch (err) {
      setNotice({ variant: 'error', message: extractErrorMessage(err) })
    } finally {
      setClosingId(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl font-bold text-ink">Resolutions</h1>
        {canManage && <Button onClick={openCreate}>+ Open Resolution</Button>}
      </div>

      <TransientAlert variant={notice?.variant ?? 'success'} message={notice?.message ?? null} onDismiss={() => setNotice(null)} />

      {loading || roleLoading ? (
        <TablePageSkeleton withFilter={false} />
      ) : (
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Title</TableHead>
              <TableHead>Opened by</TableHead>
              <TableHead>Votes (For / Against / Abstain)</TableHead>
              <TableHead>Status</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {resolutions.length === 0 && (
              <TableRow><TableCell colSpan={5} className="py-10 text-center text-sm text-muted">No resolutions yet.</TableCell></TableRow>
            )}
            {pageItems.map((resolution) => (
              <TableRow key={resolution.id}>
                <TableCell className="font-medium text-ink">
                  {resolution.title}
                  {resolution.description && (
                    <p className="mt-0.5 text-xs font-normal text-muted">{resolution.description}</p>
                  )}
                </TableCell>
                <TableCell className="text-muted">{resolution.openedByName}</TableCell>
                <TableCell className="font-mono text-muted">
                  {resolution.forVotes} / {resolution.againstVotes} / {resolution.abstainVotes}
                </TableCell>
                <TableCell><Badge label={resolution.status} variant={resolutionStatusVariant(resolution.status)} /></TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-3">
                    {resolution.status === 'OPEN' && (
                      <>
                        <button
                          onClick={() => handleVote(resolution, 'FOR')}
                          disabled={votingId === resolution.id}
                          className="text-success text-xs hover:underline disabled:opacity-50"
                        >
                          For
                        </button>
                        <button
                          onClick={() => handleVote(resolution, 'AGAINST')}
                          disabled={votingId === resolution.id}
                          className="text-danger text-xs hover:underline disabled:opacity-50"
                        >
                          Against
                        </button>
                        <button
                          onClick={() => handleVote(resolution, 'ABSTAIN')}
                          disabled={votingId === resolution.id}
                          className="text-muted text-xs hover:underline disabled:opacity-50"
                        >
                          Abstain
                        </button>
                        {canManage && (
                          <button
                            onClick={() => handleClose(resolution)}
                            disabled={closingId === resolution.id}
                            className="text-brand text-xs hover:underline disabled:opacity-50"
                          >
                            {closingId === resolution.id ? 'Closing…' : 'Close'}
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {!loading && !roleLoading && (
        <Pagination page={page} totalPages={totalPages} total={total} pageSize={pageSize} onPage={setPage} label="resolutions" />
      )}

      {showOpenModal && (
        <Modal title="Open Resolution" onClose={() => setShowOpenModal(false)}>
          <form onSubmit={handleOpen} className="space-y-4">
            {modalNotice && (
              <div className="bg-danger/10 border border-danger/25 text-danger text-sm rounded-lg px-3 py-2">{modalNotice}</div>
            )}
            <FormField label="Meeting" htmlFor="resolution-meeting" required>
              <Select id="resolution-meeting" required value={form.meetingId}
                onChange={(v) => setForm({ ...form, meetingId: v })}>
                <option value="" disabled>Select a meeting</option>
                {meetings.map((m) => <option key={m.id} value={m.id}>{m.meetingDate} — {m.agenda}</option>)}
              </Select>
            </FormField>
            <FormField label="Title" htmlFor="resolution-title" required>
              <Input id="resolution-title" required value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </FormField>
            <FormField label="Description" htmlFor="resolution-description">
              <Input id="resolution-description" value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </FormField>
            <LoadingButton type="submit" loading={saving} loadingText="Opening…" className="w-full">
              Open Resolution
            </LoadingButton>
          </form>
        </Modal>
      )}
    </div>
  )
}
