import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'

vi.mock('../../api/penalties')
vi.mock('../../api/members')
vi.mock('../../hooks/useMyMembership')

import PenaltiesPage from './PenaltiesPage'
import {
  getPenalties,
  getMyPenalties,
  createPenalty,
  approvePenalty,
  waivePenalty,
  settlePenalty,
  type Penalty,
} from '../../api/penalties'
import { getMembers } from '../../api/members'
import { useMyMembership } from '../../hooks/useMyMembership'
import { selectOption } from '../../test-utils/selectOption'

const mockGetPenalties = getPenalties as ReturnType<typeof vi.fn>
const mockGetMyPenalties = getMyPenalties as ReturnType<typeof vi.fn>
const mockCreatePenalty = createPenalty as ReturnType<typeof vi.fn>
const mockApprove = approvePenalty as ReturnType<typeof vi.fn>
const mockWaive = waivePenalty as ReturnType<typeof vi.fn>
const mockSettle = settlePenalty as ReturnType<typeof vi.fn>
const mockGetMembers = getMembers as ReturnType<typeof vi.fn>
const mockUseMyMembership = useMyMembership as ReturnType<typeof vi.fn>

function penalty(overrides: Partial<Penalty> = {}): Penalty {
  return {
    id: 1,
    chamaId: 3,
    memberId: 4,
    memberName: 'Daniel Member',
    reason: 'LATE_CONTRIBUTION',
    amount: 500,
    status: 'PENDING',
    decidedByMemberId: null,
    decidedByName: null,
    decidedAt: null,
    waiverReason: null,
    imposedAt: '2026-08-01T10:00:00Z',
    ...overrides,
  }
}

function asManager() {
  mockUseMyMembership.mockReturnValue({
    member: { id: 2 },
    roles: ['TREASURER'],
    isSuperAdmin: false,
    isChairperson: false,
    isTreasurer: true,
    isSecretary: false,
    isManager: true,
    loading: false,
  })
}

function asPlainMember() {
  mockUseMyMembership.mockReturnValue({
    member: { id: 4 },
    roles: ['MEMBER'],
    isSuperAdmin: false,
    isChairperson: false,
    isTreasurer: false,
    isSecretary: false,
    isManager: false,
    loading: false,
  })
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/chamas/3/penalties']}>
      <Routes>
        <Route path="/chamas/:chamaId/penalties" element={<PenaltiesPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mockGetMembers.mockResolvedValue([{ id: 4, fullName: 'Daniel Member' }])
  mockGetPenalties.mockResolvedValue([])
  mockGetMyPenalties.mockResolvedValue([])
})

describe('PenaltiesPage', () => {
  it('lists every penalty for a treasurer', async () => {
    asManager()
    mockGetPenalties.mockResolvedValue([penalty()])
    renderPage()

    expect(await screen.findByText('Daniel Member')).toBeTruthy()
    expect(screen.getByText('Late contribution')).toBeTruthy()
    expect(mockGetPenalties).toHaveBeenCalledWith(3)
  })

  it('shows a plain member only their own penalties and no member column', async () => {
    asPlainMember()
    mockGetMyPenalties.mockResolvedValue([penalty()])
    renderPage()

    await screen.findByText('Late contribution')
    expect(mockGetMyPenalties).toHaveBeenCalledWith(3)
    expect(mockGetPenalties).not.toHaveBeenCalled()
    expect(screen.queryByText('Daniel Member')).toBeNull()
    expect(screen.queryByRole('button', { name: /issue penalty/i })).toBeNull()
  })

  it('summarises what is outstanding and what still needs a decision', async () => {
    asManager()
    mockGetPenalties.mockResolvedValue([
      penalty({ id: 1, status: 'APPROVED', amount: 500 }),
      penalty({ id: 2, status: 'APPROVED', amount: 250 }),
      penalty({ id: 3, status: 'PENDING', amount: 100 }),
      penalty({ id: 4, status: 'PAID', amount: 900 }),
    ])
    renderPage()

    // Only APPROVED counts as outstanding: PENDING is undecided and PAID is settled.
    expect(await screen.findByText('KES 750')).toBeTruthy()
    expect(screen.getByText('Awaiting decision')).toBeTruthy()
  })

  it('distinguishes a failed load from having no penalties', async () => {
    asManager()
    mockGetPenalties.mockRejectedValue(new Error('boom'))
    renderPage()

    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(screen.queryByTestId('empty-state')).toBeNull()
  })

  it('shows an empty state when there are genuinely none', async () => {
    asManager()
    renderPage()
    expect(await screen.findByTestId('empty-state')).toBeTruthy()
  })

  it('issues a penalty', async () => {
    asManager()
    mockCreatePenalty.mockResolvedValue(penalty())
    renderPage()
    await screen.findByTestId('empty-state')

    fireEvent.click(screen.getByRole('button', { name: /issue penalty/i }))
    await selectOption(/^Member/, 'Daniel Member')
    await selectOption(/^Reason/, 'Missed meeting')
    fireEvent.change(screen.getByLabelText(/amount/i), { target: { value: '500' } })
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /^issue penalty$/i }))

    await waitFor(() =>
      expect(mockCreatePenalty).toHaveBeenCalledWith(3, {
        memberId: 4,
        reason: 'MISSED_MEETING',
        amount: 500,
      }),
    )
  })

  it('surfaces a failure to issue inside the modal rather than closing it', async () => {
    asManager()
    mockCreatePenalty.mockRejectedValue(new Error('Amount must be positive'))
    renderPage()
    await screen.findByTestId('empty-state')

    fireEvent.click(screen.getByRole('button', { name: /issue penalty/i }))
    await selectOption(/^Member/, 'Daniel Member')
    fireEvent.change(screen.getByLabelText(/amount/i), { target: { value: '5' } })
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /^issue penalty$/i }))

    expect(await screen.findByTestId('form-error')).toBeTruthy()
  })

  it('approves a pending penalty', async () => {
    asManager()
    mockGetPenalties.mockResolvedValue([penalty({ status: 'PENDING' })])
    mockApprove.mockResolvedValue(penalty({ status: 'APPROVED' }))
    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: 'Approve' }))
    await waitFor(() => expect(mockApprove).toHaveBeenCalledWith(3, 1))
  })

  it('records payment of an approved penalty', async () => {
    asManager()
    mockGetPenalties.mockResolvedValue([penalty({ status: 'APPROVED' })])
    mockSettle.mockResolvedValue(penalty({ status: 'PAID' }))
    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: /record payment/i }))
    await waitFor(() => expect(mockSettle).toHaveBeenCalledWith(3, 1))
  })

  it('requires a reason to waive and sends it', async () => {
    asManager()
    mockGetPenalties.mockResolvedValue([penalty({ status: 'APPROVED' })])
    mockWaive.mockResolvedValue(penalty({ status: 'WAIVED' }))
    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: 'Waive' }))
    fireEvent.change(screen.getByLabelText(/reason for waiving/i), {
      target: { value: 'Bereavement' },
    })
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /^waive penalty$/i }))

    await waitFor(() => expect(mockWaive).toHaveBeenCalledWith(3, 1, 'Bereavement'))
  })

  it('reports a failed action without leaving the row stuck', async () => {
    asManager()
    mockGetPenalties.mockResolvedValue([penalty({ status: 'PENDING' })])
    mockApprove.mockRejectedValue(new Error('Already decided'))
    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: 'Approve' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Approve' })).toBeEnabled())
  })

  it('shows the recorded reason on a waived penalty', async () => {
    asManager()
    mockGetPenalties.mockResolvedValue([
      penalty({ status: 'WAIVED', waiverReason: 'Hardship agreed at the AGM' }),
    ])
    renderPage()
    expect(await screen.findByText('Hardship agreed at the AGM')).toBeTruthy()
  })

  it('offers no actions on a penalty that is already settled', async () => {
    asManager()
    mockGetPenalties.mockResolvedValue([penalty({ status: 'PAID' })])
    renderPage()

    await screen.findByText('PAID')
    expect(screen.queryByRole('button', { name: 'Approve' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Waive' })).toBeNull()
    expect(screen.queryByRole('button', { name: /record payment/i })).toBeNull()
  })

  it('closes the issue modal on cancel', async () => {
    asManager()
    renderPage()
    await screen.findByTestId('empty-state')

    fireEvent.click(screen.getByRole('button', { name: /issue penalty/i }))
    expect(screen.getByLabelText(/amount/i)).toBeTruthy()
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /cancel/i }))
    await waitFor(() => expect(screen.queryByLabelText(/amount/i)).toBeNull())
  })

  it('closes the waive modal on cancel without waiving', async () => {
    asManager()
    mockGetPenalties.mockResolvedValue([penalty({ status: 'APPROVED' })])
    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: 'Waive' }))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /cancel/i }))
    await waitFor(() => expect(screen.queryByLabelText(/reason for waiving/i)).toBeNull())
    expect(mockWaive).not.toHaveBeenCalled()
  })

  it('announces the outcome of an action in a live region', async () => {
    asManager()
    mockGetPenalties.mockResolvedValue([penalty({ status: 'PENDING' })])
    mockApprove.mockResolvedValue(penalty({ status: 'APPROVED' }))
    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: 'Approve' }))
    // role="status" rather than a visual banner check, so this fails if the announcement is ever
    // downgraded to something a screen reader would not read out.
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent(/penalty for daniel member approved/i),
    )
  })

  it('does not fetch until the role lookup has resolved', () => {
    mockUseMyMembership.mockReturnValue({
      member: null,
      roles: [],
      isSuperAdmin: false,
      isChairperson: false,
      isTreasurer: false,
      isSecretary: false,
      isManager: false,
      loading: true,
    })
    renderPage()
    expect(mockGetPenalties).not.toHaveBeenCalled()
    expect(mockGetMyPenalties).not.toHaveBeenCalled()
  })
})
