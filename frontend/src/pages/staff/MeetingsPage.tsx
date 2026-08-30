import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  getMeetings,
  createMeeting,
  updateMeetingMinutes,
  getMeetingAttendance,
  recordAttendance,
  type Meeting,
  type MeetingAttendance,
  type AttendanceStatus,
} from '../../api/meetings'
import { getMembers, type Member } from '../../api/members'
import { extractErrorMessage } from '../../api/client'
import { useMyMembership } from '../../hooks/useMyMembership'
import { usePagination } from '../../hooks/usePagination'
import { TablePageSkeleton } from '../../components/ui/SkeletonLayouts'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui/Table'
import LoadingButton from '../../components/ui/LoadingButton'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import Modal from '../../components/ui/Modal'
import FormError from '../../components/ui/FormError'
import FormField from '../../components/ui/FormField'
import Input from '../../components/ui/Input'
import Textarea from '../../components/ui/Textarea'
import Pagination from '../../components/ui/Pagination'
import TransientAlert from '../../components/ui/TransientAlert'
import EmptyState from '../../components/ui/EmptyState'
import Reveal from '../../components/ui/Reveal'

const EMPTY_FORM = { meetingDate: '', agenda: '' }

const ATTENDANCE_OPTIONS: AttendanceStatus[] = ['PRESENT', 'ABSENT', 'EXCUSED']

function attendanceVariant(status: AttendanceStatus) {
  if (status === 'PRESENT') return 'success' as const
  if (status === 'ABSENT') return 'danger' as const
  return 'muted' as const
}

export default function MeetingsPage() {
  const { chamaId: chamaIdParam } = useParams<{ chamaId: string }>()
  const chamaId = Number(chamaIdParam)
  const { isSecretary, isChairperson, loading: roleLoading } = useMyMembership(chamaId)
  const canManage = isSecretary || isChairperson

  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [notice, setNotice] = useState<{ variant: 'success' | 'error'; message: string } | null>(null)

  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [modalNotice, setModalNotice] = useState<string | null>(null)

  const [minutesFor, setMinutesFor] = useState<Meeting | null>(null)
  const [minutesText, setMinutesText] = useState('')
  const [minutesSaving, setMinutesSaving] = useState(false)
  const [minutesNotice, setMinutesNotice] = useState<string | null>(null)

  const [attendanceFor, setAttendanceFor] = useState<Meeting | null>(null)
  const [attendance, setAttendance] = useState<MeetingAttendance[]>([])
  const [attendanceLoading, setAttendanceLoading] = useState(false)
  const [attendanceNotice, setAttendanceNotice] = useState<string | null>(null)
  const [markingMemberId, setMarkingMemberId] = useState<number | null>(null)

  const { page, totalPages, total, pageSize, pageItems, setPage } = usePagination(meetings)

  const refresh = () => {
    if (roleLoading) return
    setLoading(true)
    setLoadError(null)
    Promise.all([getMeetings(chamaId), canManage ? getMembers(chamaId) : Promise.resolve([])])
      .then(([m, mem]) => {
        setMeetings(m)
        setMembers(mem)
      })
      .catch((err) => setLoadError(extractErrorMessage(err)))
      .finally(() => setLoading(false))
  }

  useEffect(refresh, [chamaId, canManage, roleLoading])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setModalNotice(null)
    try {
      await createMeeting(chamaId, form)
      setNotice({ variant: 'success', message: 'Meeting scheduled. Members have been notified.' })
      setShowCreate(false)
      refresh()
    } catch (err) {
      setModalNotice(extractErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const openMinutes = (meeting: Meeting) => {
    setMinutesText(meeting.minutes ?? '')
    setMinutesNotice(null)
    setMinutesFor(meeting)
  }

  const handleSaveMinutes = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!minutesFor) return
    setMinutesSaving(true)
    setMinutesNotice(null)
    try {
      await updateMeetingMinutes(chamaId, minutesFor.id, minutesText)
      setNotice({ variant: 'success', message: 'Minutes recorded.' })
      setMinutesFor(null)
      refresh()
    } catch (err) {
      setMinutesNotice(extractErrorMessage(err))
    } finally {
      setMinutesSaving(false)
    }
  }

  const openAttendance = (meeting: Meeting) => {
    setAttendanceFor(meeting)
    setAttendance([])
    setAttendanceNotice(null)
    setAttendanceLoading(true)
    getMeetingAttendance(chamaId, meeting.id)
      .then(setAttendance)
      .catch((err) => setAttendanceNotice(extractErrorMessage(err)))
      .finally(() => setAttendanceLoading(false))
  }

  const mark = async (memberId: number, status: AttendanceStatus) => {
    if (!attendanceFor) return
    setMarkingMemberId(memberId)
    setAttendanceNotice(null)
    try {
      const updated = await recordAttendance(chamaId, attendanceFor.id, memberId, status)
      setAttendance((current) => {
        const existing = current.find((a) => a.memberId === memberId)
        return existing
          ? current.map((a) => (a.memberId === memberId ? updated : a))
          : [...current, updated]
      })
    } catch (err) {
      setAttendanceNotice(extractErrorMessage(err))
    } finally {
      setMarkingMemberId(null)
    }
  }

  const statusFor = (memberId: number): AttendanceStatus | null =>
    attendance.find((a) => a.memberId === memberId)?.status ?? null

  return (
    <div data-testid="page-meetings" className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold text-ink">Meetings</h1>
          <p className="text-sm text-muted">
            Scheduled meetings, their minutes, and who attended.
          </p>
        </div>
        {canManage && <Button onClick={() => { setForm(EMPTY_FORM); setModalNotice(null); setShowCreate(true) }}>Schedule meeting</Button>}
      </div>

      {notice && (
        <TransientAlert variant={notice.variant} message={notice.message} onDismiss={() => setNotice(null)} />
      )}

      {loading ? (
        <TablePageSkeleton />
      ) : loadError ? (
        <FormError message={loadError} />
      ) : meetings.length === 0 ? (
        <EmptyState
          title="No meetings yet"
          description={
            canManage
              ? 'Schedule one to record minutes and attendance against it. Resolutions are opened against a meeting, so a chama needs at least one before it can vote.'
              : 'Meetings scheduled by the secretary will appear here.'
          }
        />
      ) : (
        <Reveal>
          <Table data-testid="meetings-table">
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Agenda</TableHead>
                <TableHead>Minutes</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageItems.map((meeting) => (
                <TableRow key={meeting.id} data-testid={`meeting-row-${meeting.id}`}>
                  <TableCell className="font-mono text-ink">
                    {new Date(meeting.meetingDate).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="max-w-md">{meeting.agenda}</TableCell>
                  <TableCell>
                    {meeting.minutes ? (
                      <Badge label="RECORDED" variant="success" />
                    ) : (
                      <Badge label="NOT RECORDED" variant="muted" />
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-3">
                      <button
                        onClick={() => openAttendance(meeting)}
                        className="text-xs text-brand hover:underline"
                      >
                        Attendance
                      </button>
                      {canManage && (
                        <button
                          onClick={() => openMinutes(meeting)}
                          className="text-xs text-brand hover:underline"
                        >
                          {meeting.minutes ? 'Edit minutes' : 'Record minutes'}
                        </button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Pagination
            page={page}
            totalPages={totalPages}
            total={total}
            pageSize={pageSize}
            onPage={setPage}
            label="meetings"
          />
        </Reveal>
      )}

      {showCreate && (
        <Modal title="Schedule meeting" onClose={() => setShowCreate(false)}>
          <form onSubmit={handleCreate} className="space-y-4">
            <FormError message={modalNotice} />
            <FormField label="Date" htmlFor="meeting-date" required>
              <Input
                id="meeting-date"
                type="date"
                value={form.meetingDate}
                onChange={(e) => setForm({ ...form, meetingDate: e.target.value })}
                required
              />
            </FormField>
            <FormField
              label="Agenda"
              htmlFor="meeting-agenda"
              required
              hint="Included in the notification sent to members."
            >
              <Textarea
                id="meeting-agenda"
                value={form.agenda}
                onChange={(e) => setForm({ ...form, agenda: e.target.value })}
                rows={3}
                required
              />
            </FormField>
            <div className="flex gap-3">
              <LoadingButton type="submit" loading={saving} loadingText="Scheduling…" className="flex-1">
                Schedule
              </LoadingButton>
              <Button variant="secondary" onClick={() => setShowCreate(false)} className="flex-1">
                Cancel
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {minutesFor && (
        <Modal title="Minutes" onClose={() => setMinutesFor(null)}>
          <form onSubmit={handleSaveMinutes} className="space-y-4">
            <FormError message={minutesNotice} />
            <p className="text-sm text-muted">{minutesFor.agenda}</p>
            <FormField label="Minutes" htmlFor="meeting-minutes" required>
              <Textarea
                id="meeting-minutes"
                value={minutesText}
                onChange={(e) => setMinutesText(e.target.value)}
                rows={10}
                required
              />
            </FormField>
            <div className="flex gap-3">
              <LoadingButton type="submit" loading={minutesSaving} loadingText="Saving…" className="flex-1">
                Save minutes
              </LoadingButton>
              <Button variant="secondary" onClick={() => setMinutesFor(null)} className="flex-1">
                Cancel
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {attendanceFor && (
        <Modal title="Attendance" onClose={() => setAttendanceFor(null)}>
          <div className="space-y-4">
            <FormError message={attendanceNotice} />
            <p className="text-sm text-muted">
              {new Date(attendanceFor.meetingDate).toLocaleDateString()} · {attendanceFor.agenda}
            </p>

            {attendanceLoading ? (
              <p className="text-sm text-muted">Loading attendance…</p>
            ) : canManage ? (
              <ul className="divide-y divide-border">
                {members.map((member) => (
                  <li key={member.id} className="flex flex-wrap items-center justify-between gap-3 py-2">
                    <span className="text-sm font-medium text-ink">{member.fullName}</span>
                    <div className="flex gap-1" role="group" aria-label={`Attendance for ${member.fullName}`}>
                      {ATTENDANCE_OPTIONS.map((option) => {
                        const active = statusFor(member.id) === option
                        return (
                          <button
                            key={option}
                            onClick={() => mark(member.id, option)}
                            disabled={markingMemberId === member.id}
                            aria-pressed={active}
                            className={`rounded-lg px-2 py-1 text-xs font-medium transition-colors disabled:opacity-50 ${
                              active
                                ? 'bg-primary text-white'
                                : 'border border-border text-muted hover:bg-paper-dim'
                            }`}
                          >
                            {option.charAt(0) + option.slice(1).toLowerCase()}
                          </button>
                        )
                      })}
                    </div>
                  </li>
                ))}
              </ul>
            ) : attendance.length === 0 ? (
              <p className="text-sm text-muted">No attendance has been recorded for this meeting.</p>
            ) : (
              <ul className="divide-y divide-border">
                {attendance.map((entry) => (
                  <li key={entry.id} className="flex items-center justify-between gap-3 py-2">
                    <span className="text-sm text-ink">{entry.memberName}</span>
                    <Badge label={entry.status} variant={attendanceVariant(entry.status)} />
                  </li>
                ))}
              </ul>
            )}

            {/* "Done" rather than "Close": marks are saved as they are made, so this dismisses a
                finished task rather than discarding anything. It also avoids colliding with the
                dismiss control the modal provides. */}
            <Button variant="secondary" onClick={() => setAttendanceFor(null)} className="w-full">
              Done
            </Button>
          </div>
        </Modal>
      )}
    </div>
  )
}
