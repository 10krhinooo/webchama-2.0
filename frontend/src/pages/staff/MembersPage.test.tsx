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
  resendInvite: vi.fn(),
}))
vi.mock('../../api/chamas', () => ({
  getChama: vi.fn(),
  regenerateJoinCode: vi.fn(),
  inviteToChama: vi.fn(),
}))
vi.mock('../../api/memberImport', async () => {
  const actual = await vi.importActual<typeof import('../../api/memberImport')>('../../api/memberImport')
  return { ...actual, importMembers: vi.fn() }
})
vi.mock('../../hooks/useMyMembership', () => ({
  useMyMembership: vi.fn(),
}))

import { getMembers, createMember, updateMember, updateMemberStatus, deleteMember, resendInvite } from '../../api/members'
import { getChama, regenerateJoinCode, inviteToChama } from '../../api/chamas'
import { useMyMembership } from '../../hooks/useMyMembership'
import { importMembers } from '../../api/memberImport'

const mockGetMembers = getMembers as ReturnType<typeof vi.fn>
const mockCreateMember = createMember as ReturnType<typeof vi.fn>
const mockUpdateMember = updateMember as ReturnType<typeof vi.fn>
const mockUpdateMemberStatus = updateMemberStatus as ReturnType<typeof vi.fn>
const mockDeleteMember = deleteMember as ReturnType<typeof vi.fn>
const mockResendInvite = resendInvite as ReturnType<typeof vi.fn>
const mockGetChama = getChama as ReturnType<typeof vi.fn>
const mockRegenerateJoinCode = regenerateJoinCode as ReturnType<typeof vi.fn>
const mockInviteToChama = inviteToChama as ReturnType<typeof vi.fn>
const mockUseMyMembership = useMyMembership as ReturnType<typeof vi.fn>
const mockImportMembers = importMembers as ReturnType<typeof vi.fn>

function anImportResult(overrides: Partial<import('../../api/memberImport').MemberImportResult> = {}) {
  return {
    dryRun: true,
    totalRows: 2,
    created: 0,
    ready: 2,
    skipped: 0,
    failed: 0,
    structuralErrors: [],
    rows: [],
    ...overrides,
  }
}

/**
 * Drives the file input the way a person does, since the modal reads the file itself.
 *
 * Waits for Preview to become enabled rather than for the file name, because FileReader resolves
 * asynchronously and the name is set before the contents have been read.
 */
async function chooseFile(csv: string) {
  const input = screen.getByLabelText(/^File/) as HTMLInputElement
  const file = new File([csv], 'members.csv', { type: 'text/csv' })
  Object.defineProperty(input, 'files', { value: [file] })
  fireEvent.change(input)
  await waitFor(() => expect(screen.getByText('Preview')).toBeEnabled())
}

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

  it('does not offer import to anyone but a chairperson', async () => {
    mockUseMyMembership.mockReturnValue({ isChairperson: false, loading: false })
    renderPage()
    await waitFor(() => expect(screen.getByText('Jane Doe')).toBeTruthy())

    expect(screen.queryByText('Import from file')).toBeNull()
  })

  it('previews a file before creating anything', async () => {
    mockUseMyMembership.mockReturnValue({ isChairperson: true, loading: false })
    mockImportMembers.mockResolvedValue(anImportResult())
    renderPage()

    await waitFor(() => expect(screen.getByText('Import from file')).toBeTruthy())
    fireEvent.click(screen.getByText('Import from file'))
    await chooseFile('email,fullName,phone\njane@example.com,Jane,254700000001\n')
    fireEvent.click(screen.getByText('Preview'))

    await waitFor(() => expect(mockImportMembers).toHaveBeenCalled())
    // The third argument is the dry run flag: a preview must never provision accounts.
    expect(mockImportMembers.mock.calls[0][2]).toBe(true)
    expect(await screen.findByText(/2 of 2 rows are ready/)).toBeTruthy()
  })

  it('will not import until a preview has been run', async () => {
    mockUseMyMembership.mockReturnValue({ isChairperson: true, loading: false })
    renderPage()

    await waitFor(() => expect(screen.getByText('Import from file')).toBeTruthy())
    fireEvent.click(screen.getByText('Import from file'))
    await chooseFile('email,fullName,phone\njane@example.com,Jane,254700000001\n')

    // Importing sight unseen would provision Keycloak accounts nobody had looked at.
    expect(screen.getByText(/^Import 0$/)).toBeDisabled()
  })

  it('imports after a preview and reports how many landed', async () => {
    mockUseMyMembership.mockReturnValue({ isChairperson: true, loading: false })
    mockImportMembers.mockResolvedValueOnce(anImportResult())
    mockImportMembers.mockResolvedValueOnce(anImportResult({ dryRun: false, created: 2, ready: 0 }))
    renderPage()

    await waitFor(() => expect(screen.getByText('Import from file')).toBeTruthy())
    fireEvent.click(screen.getByText('Import from file'))
    await chooseFile('email,fullName,phone\njane@example.com,Jane,254700000001\n')
    fireEvent.click(screen.getByText('Preview'))

    await waitFor(() => expect(screen.getByText(/^Import 2$/)).toBeEnabled())
    fireEvent.click(screen.getByText(/^Import 2$/))

    await waitFor(() => expect(mockImportMembers.mock.calls[1][2]).toBe(false))
    expect(await screen.findByText('2 members imported.')).toBeTruthy()
  })

  it('shows why individual rows were rejected', async () => {
    mockUseMyMembership.mockReturnValue({ isChairperson: true, loading: false })
    mockImportMembers.mockResolvedValue(anImportResult({
      ready: 1,
      skipped: 1,
      rows: [
        { lineNumber: 2, email: 'jane@example.com', fullName: 'Jane', outcome: 'READY', problems: [], temporaryPassword: null },
        { lineNumber: 3, email: 'bad', fullName: '', outcome: 'SKIPPED', problems: ['Email must be a well-formed email address'], temporaryPassword: null },
      ],
    }))
    renderPage()

    await waitFor(() => expect(screen.getByText('Import from file')).toBeTruthy())
    fireEvent.click(screen.getByText('Import from file'))
    await chooseFile('csv')
    fireEvent.click(screen.getByText('Preview'))

    // The line number is what lets someone find the row in their spreadsheet.
    expect(await screen.findByText(/Line 3: bad/)).toBeTruthy()
    expect(screen.getByText('Email must be a well-formed email address')).toBeTruthy()
    // A row with nothing wrong with it is not listed; only the ones needing attention are.
    expect(screen.queryByText(/Line 2:/)).toBeNull()
  })

  it('reports a file the parser could not read at all', async () => {
    mockUseMyMembership.mockReturnValue({ isChairperson: true, loading: false })
    mockImportMembers.mockResolvedValue(anImportResult({
      totalRows: 0, ready: 0, structuralErrors: ['Missing required column: phone'],
    }))
    renderPage()

    await waitFor(() => expect(screen.getByText('Import from file')).toBeTruthy())
    fireEvent.click(screen.getByText('Import from file'))
    await chooseFile('email,fullName\n')
    fireEvent.click(screen.getByText('Preview'))

    expect(await screen.findByText('This file could not be read.')).toBeTruthy()
    expect(screen.getByText('Missing required column: phone')).toBeTruthy()
    expect(screen.getByText(/^Import 0$/)).toBeDisabled()
  })

  it('reports a failed upload without closing the modal', async () => {
    mockUseMyMembership.mockReturnValue({ isChairperson: true, loading: false })
    mockImportMembers.mockRejectedValue(new Error('Request failed'))
    renderPage()

    await waitFor(() => expect(screen.getByText('Import from file')).toBeTruthy())
    fireEvent.click(screen.getByText('Import from file'))
    await chooseFile('csv')
    fireEvent.click(screen.getByText('Preview'))

    expect(await screen.findByTestId('form-error')).toBeTruthy()
    expect(screen.getByText('Preview')).toBeTruthy()
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

  it('reissues an invite and shows the new temporary password', async () => {
    mockUseMyMembership.mockReturnValue({ isChairperson: true, loading: false })
    mockResendInvite.mockResolvedValue({ member, temporaryPassword: 'NewTemp123!' })
    renderPage()
    await waitFor(() => expect(screen.getByText('Jane Doe')).toBeTruthy())

    fireEvent.click(screen.getByText('Reissue invite'))
    await waitFor(() => expect(mockResendInvite).toHaveBeenCalledWith(3, 1))
    expect(screen.getByText('NewTemp123!')).toBeTruthy()

    fireEvent.click(screen.getByText('Done'))
    await waitFor(() => expect(screen.queryByText('NewTemp123!')).toBeNull())
  })

  it('shows an error notice when reissuing an invite fails', async () => {
    mockUseMyMembership.mockReturnValue({ isChairperson: true, loading: false })
    mockResendInvite.mockRejectedValue(new Error('could not reset password'))
    renderPage()
    await waitFor(() => expect(screen.getByText('Jane Doe')).toBeTruthy())

    fireEvent.click(screen.getByText('Reissue invite'))
    await waitFor(() => expect(screen.getByText('could not reset password')).toBeTruthy())
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

  it('distinguishes a failed load from an empty list', async () => {
    mockUseMyMembership.mockReturnValue({ isChairperson: true, loading: false })
    mockGetMembers.mockRejectedValue(new Error('Service unavailable'))
    renderPage()

    expect(await screen.findByTestId('load-failed')).toBeTruthy()
    expect(screen.getByText('Service unavailable')).toBeTruthy()
    // A request that failed is not an account with nothing in it. Saying the second when the first
    // happened states something false and then invites the reader to act on it.
    expect(screen.queryByTestId('empty-state')).toBeNull()
  })
})
