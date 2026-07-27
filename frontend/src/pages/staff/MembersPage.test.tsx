import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import MembersPage from './MembersPage'

vi.mock('../../api/members', () => ({
  getMembers: vi.fn(),
  createMember: vi.fn(),
  updateMember: vi.fn(),
  updateMemberStatus: vi.fn(),
  deleteMember: vi.fn(),
}))
vi.mock('../../api/chamas', () => ({
  getChama: vi.fn(),
  regenerateJoinCode: vi.fn(),
  inviteToChama: vi.fn(),
}))
vi.mock('../../hooks/useMyMembership', () => ({
  useMyMembership: vi.fn(),
}))

import { getMembers, createMember, updateMember, updateMemberStatus, deleteMember } from '../../api/members'
import { getChama, regenerateJoinCode, inviteToChama } from '../../api/chamas'
import { useMyMembership } from '../../hooks/useMyMembership'

const mockGetMembers = getMembers as ReturnType<typeof vi.fn>
const mockCreateMember = createMember as ReturnType<typeof vi.fn>
const mockUpdateMember = updateMember as ReturnType<typeof vi.fn>
const mockUpdateMemberStatus = updateMemberStatus as ReturnType<typeof vi.fn>
const mockDeleteMember = deleteMember as ReturnType<typeof vi.fn>
const mockGetChama = getChama as ReturnType<typeof vi.fn>
const mockRegenerateJoinCode = regenerateJoinCode as ReturnType<typeof vi.fn>
const mockInviteToChama = inviteToChama as ReturnType<typeof vi.fn>
const mockUseMyMembership = useMyMembership as ReturnType<typeof vi.fn>

const member = {
  id: 1,
  chamaId: 3,
  fullName: 'Jane Doe',
  phone: '254700000000',
  nationalId: null,
  nextOfKin: null,
  joinDate: '2026-01-01',
  status: 'ACTIVE' as const,
  roles: ['MEMBER' as const],
}

function renderPage(path = '/chamas/3/members') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/chamas/:chamaId/members" element={<MembersPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('MembersPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetChama.mockResolvedValue({ id: 3, name: 'Tumaini', joinCode: 'AB12CD34' })
    mockGetMembers.mockResolvedValue([member])
  })

  it('shows the chama name and member list', async () => {
    mockUseMyMembership.mockReturnValue({ isChairperson: false, loading: false })
    renderPage()
    await waitFor(() => expect(screen.getByText('Jane Doe')).toBeTruthy())
    expect(screen.getByText('Tumaini')).toBeTruthy()
  })

  it('hides management actions for a non-chairperson', async () => {
    mockUseMyMembership.mockReturnValue({ isChairperson: false, loading: false })
    renderPage()
    await waitFor(() => expect(screen.getByText('Jane Doe')).toBeTruthy())
    expect(screen.queryByText('+ Invite Member')).toBeNull()
    expect(screen.queryByText('Edit')).toBeNull()
  })

  it('shows management actions for a chairperson', async () => {
    mockUseMyMembership.mockReturnValue({ isChairperson: true, loading: false })
    renderPage()
    await waitFor(() => expect(screen.getByText('Jane Doe')).toBeTruthy())
    expect(screen.getByText('+ Invite Member')).toBeTruthy()
    expect(screen.getByText('Edit')).toBeTruthy()
    expect(screen.getByText('Suspend')).toBeTruthy()
  })

  it('invites a new member and shows the temporary password when a new account was provisioned', async () => {
    mockUseMyMembership.mockReturnValue({ isChairperson: true, loading: false })
    mockCreateMember.mockResolvedValue({ member: { ...member, id: 2 }, temporaryPassword: 'Temp1234!' })
    renderPage()
    await waitFor(() => expect(screen.getByText('Jane Doe')).toBeTruthy())

    fireEvent.click(screen.getByText('+ Invite Member'))
    fireEvent.change(screen.getByLabelText(/^email/i), { target: { value: 'new.member@example.com' } })
    fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: 'New Member' } })
    fireEvent.click(screen.getByText('Add Member'))

    await waitFor(() => expect(mockCreateMember).toHaveBeenCalled())
    expect(mockCreateMember.mock.calls[0][1]).toMatchObject({ email: 'new.member@example.com', fullName: 'New Member', roles: ['MEMBER'] })

    await waitFor(() => expect(screen.getByText('Member Invited')).toBeTruthy())
    expect(screen.getByText('Temp1234!')).toBeTruthy()

    fireEvent.click(screen.getByText('Done'))
    expect(screen.queryByText('Member Invited')).toBeNull()
  })

  it('invites a member whose email already has an account without showing a temporary password', async () => {
    mockUseMyMembership.mockReturnValue({ isChairperson: true, loading: false })
    mockCreateMember.mockResolvedValue({ member: { ...member, id: 2 }, temporaryPassword: null })
    renderPage()
    await waitFor(() => expect(screen.getByText('Jane Doe')).toBeTruthy())

    fireEvent.click(screen.getByText('+ Invite Member'))
    fireEvent.change(screen.getByLabelText(/^email/i), { target: { value: 'existing@example.com' } })
    fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: 'Existing Person' } })
    fireEvent.click(screen.getByText('Add Member'))

    await waitFor(() => expect(mockCreateMember).toHaveBeenCalled())
    expect(screen.queryByText('Member Invited')).toBeNull()
    expect(screen.queryByText(/^New Member$/)).toBeNull()
  })

  it('edits a member without asking for an email', async () => {
    mockUseMyMembership.mockReturnValue({ isChairperson: true, loading: false })
    mockUpdateMember.mockResolvedValue({ ...member, fullName: 'Jane Renamed' })
    renderPage()
    await waitFor(() => expect(screen.getByText('Jane Doe')).toBeTruthy())

    fireEvent.click(screen.getByText('Edit'))
    expect(screen.queryByLabelText(/^email/i)).toBeNull()
    fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: 'Jane Renamed' } })
    fireEvent.click(screen.getByText('Save Changes'))

    await waitFor(() => expect(mockUpdateMember).toHaveBeenCalledWith(3, 1, expect.objectContaining({ fullName: 'Jane Renamed' })))
  })

  it('suspends an active member', async () => {
    mockUseMyMembership.mockReturnValue({ isChairperson: true, loading: false })
    mockUpdateMemberStatus.mockResolvedValue({ ...member, status: 'SUSPENDED' })
    renderPage()
    await waitFor(() => expect(screen.getByText('Jane Doe')).toBeTruthy())

    fireEvent.click(screen.getByText('Suspend'))
    await waitFor(() => expect(mockUpdateMemberStatus).toHaveBeenCalledWith(3, 1, 'SUSPENDED'))
  })

  it('removes a member after confirmation', async () => {
    mockUseMyMembership.mockReturnValue({ isChairperson: true, loading: false })
    mockDeleteMember.mockResolvedValue(undefined)
    renderPage()
    await waitFor(() => expect(screen.getByText('Jane Doe')).toBeTruthy())

    fireEvent.click(screen.getByText('Remove'))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Remove' }))
    await waitFor(() => expect(mockDeleteMember).toHaveBeenCalledWith(3, 1))
  })

  it('shows an empty state when there are no members', async () => {
    mockUseMyMembership.mockReturnValue({ isChairperson: false, loading: false })
    mockGetMembers.mockResolvedValue([])
    renderPage()
    await waitFor(() => expect(screen.getByText(/no members yet/i)).toBeTruthy())
  })

  it('activates a suspended member and offers marking active members exited', async () => {
    mockUseMyMembership.mockReturnValue({ isChairperson: true, loading: false })
    mockGetMembers.mockResolvedValue([{ ...member, status: 'SUSPENDED' as const }])
    mockUpdateMemberStatus.mockResolvedValue({ ...member, status: 'ACTIVE' })
    renderPage()

    await waitFor(() => expect(screen.getByText('Jane Doe')).toBeTruthy())
    expect(screen.getByText('Activate')).toBeTruthy()
    fireEvent.click(screen.getByText('Activate'))
    await waitFor(() => expect(mockUpdateMemberStatus).toHaveBeenCalledWith(3, 1, 'ACTIVE'))
  })

  it('marks an active member exited and no longer offers exiting an already-exited member', async () => {
    mockUseMyMembership.mockReturnValue({ isChairperson: true, loading: false })
    mockGetMembers.mockResolvedValueOnce([member]).mockResolvedValueOnce([{ ...member, status: 'EXITED' as const }])
    mockUpdateMemberStatus.mockResolvedValue({ ...member, status: 'EXITED' })
    renderPage()

    await waitFor(() => expect(screen.getByText('Jane Doe')).toBeTruthy())
    fireEvent.click(screen.getByText('Mark exited'))
    await waitFor(() => expect(mockUpdateMemberStatus).toHaveBeenCalledWith(3, 1, 'EXITED'))
    await waitFor(() => expect(screen.queryByText('Mark exited')).toBeNull())
  })

  it('toggles a role checkbox on and off in the invite form', async () => {
    mockUseMyMembership.mockReturnValue({ isChairperson: true, loading: false })
    mockCreateMember.mockResolvedValue({ member: { ...member, id: 2 }, temporaryPassword: null })
    renderPage()

    await waitFor(() => expect(screen.getByText('Jane Doe')).toBeTruthy())
    fireEvent.click(screen.getByText('+ Invite Member'))

    const memberCheckbox = screen.getByRole('checkbox', { name: 'MEMBER' })
    const treasurerCheckbox = screen.getByRole('checkbox', { name: 'TREASURER' })
    expect(memberCheckbox).toBeChecked()

    fireEvent.click(memberCheckbox)
    fireEvent.click(treasurerCheckbox)

    fireEvent.change(screen.getByLabelText(/^email/i), { target: { value: 'new.member@example.com' } })
    fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: 'New Member' } })
    fireEvent.change(screen.getByLabelText(/national id/i), { target: { value: '12345' } })
    fireEvent.change(screen.getByLabelText(/next of kin/i), { target: { value: 'Someone' } })
    fireEvent.click(screen.getByText('Add Member'))

    await waitFor(() => expect(mockCreateMember).toHaveBeenCalled())
    expect(mockCreateMember.mock.calls[0][1]).toMatchObject({
      roles: ['TREASURER'],
      nationalId: '12345',
      nextOfKin: 'Someone',
    })
  })

  it('shows the backend error message when updating a member status fails', async () => {
    mockUseMyMembership.mockReturnValue({ isChairperson: true, loading: false })
    mockUpdateMemberStatus.mockRejectedValue(new Error('cannot suspend the last chairperson'))
    renderPage()

    await waitFor(() => expect(screen.getByText('Jane Doe')).toBeTruthy())
    fireEvent.click(screen.getByText('Suspend'))
    await waitFor(() => expect(screen.getByText('cannot suspend the last chairperson')).toBeTruthy())
  })

  it('shows an error notice when removing a member fails', async () => {
    mockUseMyMembership.mockReturnValue({ isChairperson: true, loading: false })
    mockDeleteMember.mockRejectedValue(new Error('cannot remove the last chairperson'))
    renderPage()

    await waitFor(() => expect(screen.getByText('Jane Doe')).toBeTruthy())
    fireEvent.click(screen.getByText('Remove'))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Remove' }))
    await waitFor(() => expect(screen.getByText('cannot remove the last chairperson')).toBeTruthy())
  })

  it('does not remove a member when the confirmation is dismissed', async () => {
    mockUseMyMembership.mockReturnValue({ isChairperson: true, loading: false })
    renderPage()

    await waitFor(() => expect(screen.getByText('Jane Doe')).toBeTruthy())
    fireEvent.click(screen.getByText('Remove'))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' }))
    expect(mockDeleteMember).not.toHaveBeenCalled()
  })

  it('hides the join code panel for a non-chairperson', async () => {
    mockUseMyMembership.mockReturnValue({ isChairperson: false, loading: false })
    renderPage()
    await waitFor(() => expect(screen.getByText('Jane Doe')).toBeTruthy())
    expect(screen.queryByText('Join code')).toBeNull()
  })

  it('shows the chama join code to a chairperson and copies it to the clipboard', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, { clipboard: { writeText } })
    mockUseMyMembership.mockReturnValue({ isChairperson: true, loading: false })
    renderPage()
    await waitFor(() => expect(screen.getByText('Jane Doe')).toBeTruthy())

    expect(screen.getByDisplayValue('AB12CD34')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Copy' }))

    await waitFor(() => expect(writeText).toHaveBeenCalledWith('AB12CD34'))
    expect(screen.getByRole('button', { name: 'Copied' })).toBeTruthy()
  })

  it('regenerates the join code and reflects the new value', async () => {
    mockUseMyMembership.mockReturnValue({ isChairperson: true, loading: false })
    mockRegenerateJoinCode.mockResolvedValue({ id: 3, name: 'Tumaini', joinCode: 'ZZ99YY88' })
    renderPage()
    await waitFor(() => expect(screen.getByText('Jane Doe')).toBeTruthy())

    fireEvent.click(screen.getByRole('button', { name: /regenerate code/i }))

    await waitFor(() => expect(mockRegenerateJoinCode).toHaveBeenCalledWith(3))
    await waitFor(() => expect(screen.getByDisplayValue('ZZ99YY88')).toBeTruthy())
  })

  it('sends a join-code invite by email', async () => {
    mockUseMyMembership.mockReturnValue({ isChairperson: true, loading: false })
    mockInviteToChama.mockResolvedValue(undefined)
    renderPage()
    await waitFor(() => expect(screen.getByText('Jane Doe')).toBeTruthy())

    fireEvent.change(screen.getByLabelText(/invite by email/i), { target: { value: 'prospect@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: /send invite/i }))

    await waitFor(() =>
      expect(mockInviteToChama).toHaveBeenCalledWith(3, { email: 'prospect@example.com' }),
    )
    await waitFor(() => expect(screen.getByText(/invite sent to prospect@example.com/i)).toBeTruthy())
  })

  it('shows an error when the join-code invite fails', async () => {
    mockUseMyMembership.mockReturnValue({ isChairperson: true, loading: false })
    mockInviteToChama.mockRejectedValue(new Error('mail server unavailable'))
    renderPage()
    await waitFor(() => expect(screen.getByText('Jane Doe')).toBeTruthy())

    fireEvent.change(screen.getByLabelText(/invite by email/i), { target: { value: 'prospect@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: /send invite/i }))

    await waitFor(() => expect(screen.getByText('mail server unavailable')).toBeTruthy())
  })
})
