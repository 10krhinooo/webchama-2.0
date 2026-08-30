import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'

vi.mock('../../api/meetings')
vi.mock('../../api/members')
vi.mock('../../hooks/useMyMembership')

import MeetingsPage from './MeetingsPage'
import {
  getMeetings,
  createMeeting,
  updateMeetingMinutes,
  getMeetingAttendance,
  recordAttendance,
  type Meeting,
} from '../../api/meetings'
import { getMembers } from '../../api/members'
import { useMyMembership } from '../../hooks/useMyMembership'

const mockGetMeetings = getMeetings as ReturnType<typeof vi.fn>
const mockCreate = createMeeting as ReturnType<typeof vi.fn>
const mockUpdateMinutes = updateMeetingMinutes as ReturnType<typeof vi.fn>
const mockGetAttendance = getMeetingAttendance as ReturnType<typeof vi.fn>
const mockRecordAttendance = recordAttendance as ReturnType<typeof vi.fn>
const mockGetMembers = getMembers as ReturnType<typeof vi.fn>
const mockUseMyMembership = useMyMembership as ReturnType<typeof vi.fn>

function meeting(overrides: Partial<Meeting> = {}): Meeting {
  return {
    id: 1,
    chamaId: 9,
    meetingDate: '2026-09-01',
    agenda: 'Monthly review',
    minutes: null,
    createdAt: '2026-08-01T10:00:00Z',
    ...overrides,
  }
}

function membership(overrides: Record<string, unknown> = {}) {
  mockUseMyMembership.mockReturnValue({
    member: { id: 3 },
    roles: ['MEMBER'],
    isSuperAdmin: false,
    isChairperson: false,
    isTreasurer: false,
    isSecretary: false,
    isManager: false,
    loading: false,
    ...overrides,
  })
}

const asSecretary = () => membership({ roles: ['SECRETARY'], isSecretary: true })
const asPlainMember = () => membership()

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/chamas/9/meetings']}>
      <Routes>
        <Route path="/chamas/:chamaId/meetings" element={<MeetingsPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mockGetMeetings.mockResolvedValue([])
  mockGetMembers.mockResolvedValue([
    { id: 3, fullName: 'Carol Secretary' },
    { id: 4, fullName: 'Daniel Member' },
  ])
  mockGetAttendance.mockResolvedValue([])
})

describe('MeetingsPage', () => {
  it('lists scheduled meetings', async () => {
    asSecretary()
    mockGetMeetings.mockResolvedValue([meeting()])
    renderPage()
    expect(await screen.findByText('Monthly review')).toBeTruthy()
  })

  it('shows whether minutes have been recorded', async () => {
    asSecretary()
    mockGetMeetings.mockResolvedValue([
      meeting({ id: 1, minutes: null }),
      meeting({ id: 2, minutes: 'Agreed the budget' }),
    ])
    renderPage()
    expect(await screen.findByText('NOT RECORDED')).toBeTruthy()
    expect(screen.getByText('RECORDED')).toBeTruthy()
  })

  it('explains that a meeting is a prerequisite for voting when there are none', async () => {
    asSecretary()
    renderPage()
    const empty = await screen.findByTestId('empty-state')
    expect(empty).toHaveTextContent(/resolutions are opened against a meeting/i)
  })

  it('distinguishes a failed load from having no meetings', async () => {
    asSecretary()
    mockGetMeetings.mockRejectedValue(new Error('boom'))
    renderPage()
    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(screen.queryByTestId('empty-state')).toBeNull()
  })

  it('hides scheduling and minutes from a plain member', async () => {
    asPlainMember()
    mockGetMeetings.mockResolvedValue([meeting()])
    renderPage()
    await screen.findByText('Monthly review')
    expect(screen.queryByRole('button', { name: /schedule meeting/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /record minutes/i })).toBeNull()
    expect(screen.getByRole('button', { name: /attendance/i })).toBeTruthy()
  })

  it('does not fetch the member list for a plain member', async () => {
    asPlainMember()
    mockGetMeetings.mockResolvedValue([meeting()])
    renderPage()
    await screen.findByText('Monthly review')
    expect(mockGetMembers).not.toHaveBeenCalled()
  })

  it('schedules a meeting', async () => {
    asSecretary()
    mockCreate.mockResolvedValue(meeting())
    renderPage()
    await screen.findByTestId('empty-state')

    fireEvent.click(screen.getByRole('button', { name: /schedule meeting/i }))
    const dialog = screen.getByRole('dialog')
    fireEvent.change(within(dialog).getByLabelText(/^date/i), { target: { value: '2026-09-01' } })
    fireEvent.change(within(dialog).getByLabelText(/^agenda/i), {
      target: { value: 'Monthly review' },
    })
    fireEvent.click(within(dialog).getByRole('button', { name: /^schedule$/i }))

    await waitFor(() =>
      expect(mockCreate).toHaveBeenCalledWith(9, {
        meetingDate: '2026-09-01',
        agenda: 'Monthly review',
      }),
    )
  })

  it('reports a scheduling failure inside the modal', async () => {
    asSecretary()
    mockCreate.mockRejectedValue(new Error('Date is in the past'))
    renderPage()
    await screen.findByTestId('empty-state')

    fireEvent.click(screen.getByRole('button', { name: /schedule meeting/i }))
    const dialog = screen.getByRole('dialog')
    fireEvent.change(within(dialog).getByLabelText(/^date/i), { target: { value: '2020-01-01' } })
    fireEvent.change(within(dialog).getByLabelText(/^agenda/i), { target: { value: 'Old' } })
    fireEvent.click(within(dialog).getByRole('button', { name: /^schedule$/i }))

    expect(await screen.findByTestId('form-error')).toBeTruthy()
  })

  it('records minutes against a meeting', async () => {
    asSecretary()
    mockGetMeetings.mockResolvedValue([meeting()])
    mockUpdateMinutes.mockResolvedValue(meeting({ minutes: 'Agreed the budget' }))
    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: /record minutes/i }))
    const dialog = screen.getByRole('dialog')
    fireEvent.change(within(dialog).getByLabelText(/^minutes/i), {
      target: { value: 'Agreed the budget' },
    })
    fireEvent.click(within(dialog).getByRole('button', { name: /save minutes/i }))

    await waitFor(() => expect(mockUpdateMinutes).toHaveBeenCalledWith(9, 1, 'Agreed the budget'))
  })

  it('prefills existing minutes for editing rather than starting blank', async () => {
    asSecretary()
    mockGetMeetings.mockResolvedValue([meeting({ minutes: 'Existing text' })])
    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: /edit minutes/i }))
    // Scoped to the dialog: the modal title is also "Minutes".
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByLabelText(/^minutes/i)).toHaveValue('Existing text')
  })

  it('marks a member present', async () => {
    asSecretary()
    mockGetMeetings.mockResolvedValue([meeting()])
    mockRecordAttendance.mockResolvedValue({
      id: 5,
      meetingId: 1,
      memberId: 4,
      memberName: 'Daniel Member',
      status: 'PRESENT',
    })
    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: /attendance/i }))
    const group = await screen.findByRole('group', { name: /attendance for daniel member/i })
    fireEvent.click(within(group).getByRole('button', { name: 'Present' }))

    await waitFor(() => expect(mockRecordAttendance).toHaveBeenCalledWith(9, 1, 4, 'PRESENT'))
  })

  it('marks a member excused, which the credit score treats differently from absent', async () => {
    asSecretary()
    mockGetMeetings.mockResolvedValue([meeting()])
    mockRecordAttendance.mockResolvedValue({
      id: 6,
      meetingId: 1,
      memberId: 4,
      memberName: 'Daniel Member',
      status: 'EXCUSED',
    })
    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: /attendance/i }))
    const group = await screen.findByRole('group', { name: /attendance for daniel member/i })
    fireEvent.click(within(group).getByRole('button', { name: 'Excused' }))

    await waitFor(() => expect(mockRecordAttendance).toHaveBeenCalledWith(9, 1, 4, 'EXCUSED'))
    await waitFor(() =>
      expect(within(group).getByRole('button', { name: 'Excused' })).toHaveAttribute(
        'aria-pressed',
        'true',
      ),
    )
  })

  it('updates an existing mark in place rather than adding a second one', async () => {
    asSecretary()
    mockGetMeetings.mockResolvedValue([meeting()])
    mockGetAttendance.mockResolvedValue([
      { id: 7, meetingId: 1, memberId: 4, memberName: 'Daniel Member', status: 'ABSENT' },
    ])
    mockRecordAttendance.mockResolvedValue({
      id: 7,
      meetingId: 1,
      memberId: 4,
      memberName: 'Daniel Member',
      status: 'PRESENT',
    })
    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: /attendance/i }))
    const group = await screen.findByRole('group', { name: /attendance for daniel member/i })
    expect(within(group).getByRole('button', { name: 'Absent' })).toHaveAttribute('aria-pressed', 'true')

    fireEvent.click(within(group).getByRole('button', { name: 'Present' }))
    await waitFor(() =>
      expect(within(group).getByRole('button', { name: 'Present' })).toHaveAttribute('aria-pressed', 'true'),
    )
    expect(within(group).getByRole('button', { name: 'Absent' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('reports a failure to record attendance', async () => {
    asSecretary()
    mockGetMeetings.mockResolvedValue([meeting()])
    mockRecordAttendance.mockRejectedValue(new Error('Meeting is closed'))
    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: /attendance/i }))
    const group = await screen.findByRole('group', { name: /attendance for daniel member/i })
    fireEvent.click(within(group).getByRole('button', { name: 'Present' }))

    expect(await screen.findByTestId('form-error')).toBeTruthy()
  })

  it('reports a failure to load attendance', async () => {
    asSecretary()
    mockGetMeetings.mockResolvedValue([meeting()])
    mockGetAttendance.mockRejectedValue(new Error('nope'))
    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: /attendance/i }))
    expect(await screen.findByTestId('form-error')).toBeTruthy()
  })

  it('shows a plain member the recorded attendance read only', async () => {
    asPlainMember()
    mockGetMeetings.mockResolvedValue([meeting()])
    mockGetAttendance.mockResolvedValue([
      { id: 8, meetingId: 1, memberId: 4, memberName: 'Daniel Member', status: 'PRESENT' },
    ])
    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: /attendance/i }))
    expect(await screen.findByText('PRESENT')).toBeTruthy()
    expect(screen.queryByRole('group', { name: /attendance for/i })).toBeNull()
  })

  it('tells a plain member when nothing has been recorded yet', async () => {
    asPlainMember()
    mockGetMeetings.mockResolvedValue([meeting()])
    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: /attendance/i }))
    expect(await screen.findByText(/no attendance has been recorded/i)).toBeTruthy()
  })

  it('closes each modal without acting', async () => {
    asSecretary()
    mockGetMeetings.mockResolvedValue([meeting()])
    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: /attendance/i }))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Done' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())

    fireEvent.click(screen.getByRole('button', { name: /record minutes/i }))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /cancel/i }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(mockUpdateMinutes).not.toHaveBeenCalled()
  })

  it('does not fetch until the role lookup has resolved', () => {
    membership({ loading: true })
    renderPage()
    expect(mockGetMeetings).not.toHaveBeenCalled()
  })
})
