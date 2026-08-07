import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import DashboardPage from './DashboardPage'

vi.mock('../../api/chamas', () => ({
  getChama: vi.fn(),
  getSavingsProgress: vi.fn(),
  updateChama: vi.fn(),
}))
vi.mock('../../api/members', () => ({
  getMembers: vi.fn(),
}))
vi.mock('../../api/welfareFund', () => ({
  getWelfareFund: vi.fn(),
  updateWelfareFundTarget: vi.fn(),
}))
vi.mock('../../api/contributions', () => ({
  getContributions: vi.fn(),
  getMyContributions: vi.fn(),
}))
vi.mock('../../api/loans', () => ({
  getLoans: vi.fn(),
  getMyLoans: vi.fn(),
  getLoanRepayments: vi.fn(),
}))
vi.mock('../../api/payouts', () => ({
  getPayouts: vi.fn(),
  getMyPayouts: vi.fn(),
}))
vi.mock('../../api/approvals', () => ({
  getPendingApprovals: vi.fn(),
}))
vi.mock('../../api/meetings', () => ({
  getMeetings: vi.fn(),
}))
vi.mock('../../api/resolutions', () => ({
  getResolutions: vi.fn(),
}))
vi.mock('../../hooks/useMyMembership', () => ({
  useMyMembership: vi.fn(),
}))
vi.mock('../../hooks/useActivityFeed', () => ({
  useActivityFeed: vi.fn(),
}))

import { getChama, getSavingsProgress, updateChama } from '../../api/chamas'
import { getMembers } from '../../api/members'
import { getWelfareFund, updateWelfareFundTarget } from '../../api/welfareFund'
import { getContributions, getMyContributions } from '../../api/contributions'
import { getLoans, getMyLoans, getLoanRepayments } from '../../api/loans'
import { getPayouts, getMyPayouts } from '../../api/payouts'
import { getPendingApprovals } from '../../api/approvals'
import { getMeetings } from '../../api/meetings'
import { getResolutions } from '../../api/resolutions'
import { useMyMembership } from '../../hooks/useMyMembership'
import { useActivityFeed } from '../../hooks/useActivityFeed'

const mockGetChama = getChama as ReturnType<typeof vi.fn>
const mockGetSavingsProgress = getSavingsProgress as ReturnType<typeof vi.fn>
const mockUpdateChama = updateChama as ReturnType<typeof vi.fn>
const mockGetMembers = getMembers as ReturnType<typeof vi.fn>
const mockGetWelfareFund = getWelfareFund as ReturnType<typeof vi.fn>
const mockUpdateWelfareFundTarget = updateWelfareFundTarget as ReturnType<typeof vi.fn>
const mockGetContributions = getContributions as ReturnType<typeof vi.fn>
const mockGetMyContributions = getMyContributions as ReturnType<typeof vi.fn>
const mockGetLoans = getLoans as ReturnType<typeof vi.fn>
const mockGetMyLoans = getMyLoans as ReturnType<typeof vi.fn>
const mockGetLoanRepayments = getLoanRepayments as ReturnType<typeof vi.fn>
const mockGetPayouts = getPayouts as ReturnType<typeof vi.fn>
const mockGetMyPayouts = getMyPayouts as ReturnType<typeof vi.fn>
const mockGetPendingApprovals = getPendingApprovals as ReturnType<typeof vi.fn>
const mockGetMeetings = getMeetings as ReturnType<typeof vi.fn>
const mockGetResolutions = getResolutions as ReturnType<typeof vi.fn>
const mockUseMyMembership = useMyMembership as ReturnType<typeof vi.fn>
const mockUseActivityFeed = useActivityFeed as ReturnType<typeof vi.fn>

const chama = { id: 3, name: 'Tumaini Chama', currency: 'KES' }
const members = [{ id: 1 }, { id: 2 }, { id: 3 }]

function contribution(amountDue: number, amountPaid: number, status: string) {
  return { id: Math.random(), chamaId: 3, memberId: 1, memberName: 'X', period: '2026-07', amountDue, amountPaid, paymentMethod: null, status, paidAt: null }
}

function loan(principal: number, status: string) {
  return { id: Math.random(), chamaId: 3, memberId: 1, memberName: 'X', principal, interestRate: 10, interestMethod: 'FLAT', termMonths: 6, status, approvedByMemberId: null, approvedByName: null, requestedAt: '2026-01-01', approvedAt: null, disbursedAt: null }
}

function payout(status: string, scheduledDate: string, roundNumber = 1, amount = 500) {
  return { id: Math.random(), chamaId: 3, memberId: 1, memberName: 'X', roundNumber, scheduledDate, amount, status, disbursedAt: null, createdAt: '2026-01-01' }
}

function renderAt(path = '/chamas/3/dashboard') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/chamas/:chamaId/dashboard" element={<DashboardPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('DashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetChama.mockResolvedValue(chama)
    mockGetSavingsProgress.mockResolvedValue({ target: null, totalPaid: 0 })
    mockGetMembers.mockResolvedValue(members)
    mockGetLoans.mockResolvedValue([])
    mockGetMyLoans.mockResolvedValue([])
    mockGetLoanRepayments.mockResolvedValue([])
    mockGetPayouts.mockResolvedValue([])
    mockGetMyPayouts.mockResolvedValue([])
    mockGetPendingApprovals.mockResolvedValue([])
    mockGetMeetings.mockResolvedValue([])
    mockGetResolutions.mockResolvedValue([])
    mockGetWelfareFund.mockResolvedValue({ chamaId: 3, balance: 0, target: null })
    mockUpdateChama.mockResolvedValue(chama)
    mockUpdateWelfareFundTarget.mockResolvedValue({ chamaId: 3, balance: 0, target: null })
    mockUseActivityFeed.mockReturnValue({ entries: [], loading: false })
  })

  it('shows the chama-wide collection progress for a chairperson/treasurer', async () => {
    mockUseMyMembership.mockReturnValue({ isChairperson: true, isTreasurer: false, loading: false })
    mockGetContributions.mockResolvedValue([contribution(1000, 1000, 'PAID'), contribution(1000, 500, 'PARTIAL')])

    renderAt()

    await waitFor(() => expect(screen.getByText('Tumaini Chama')).toBeTruthy())
    expect(mockGetContributions).toHaveBeenCalledWith(3)
    expect(mockGetMyContributions).not.toHaveBeenCalled()
    expect(screen.getByText('This cycle across all members')).toBeTruthy()
    expect(screen.getByText('3')).toBeTruthy()
    expect(screen.getByText('1')).toBeTruthy()
  })

  it("shows only the member's own contribution progress for a plain member", async () => {
    mockUseMyMembership.mockReturnValue({ isChairperson: false, isTreasurer: false, loading: false })
    mockGetMyContributions.mockResolvedValue([contribution(1000, 400, 'PARTIAL')])

    renderAt()

    await waitFor(() => expect(screen.getByText('Tumaini Chama')).toBeTruthy())
    expect(mockGetMyContributions).toHaveBeenCalledWith(3)
    expect(mockGetContributions).not.toHaveBeenCalled()
    expect(screen.getByText('Your contribution this cycle')).toBeTruthy()
  })

  it('shows an error notice when loading fails', async () => {
    mockUseMyMembership.mockReturnValue({ isChairperson: true, isTreasurer: false, loading: false })
    mockGetContributions.mockRejectedValue(new Error('network down'))

    renderAt()

    await waitFor(() => expect(screen.getByText('network down')).toBeTruthy())
  })

  it('waits for the role check before fetching', () => {
    mockUseMyMembership.mockReturnValue({ isChairperson: false, isTreasurer: false, loading: true })

    renderAt()

    expect(mockGetChama).not.toHaveBeenCalled()
  })

  it('shows the outstanding loan total and next payout for a manager', async () => {
    mockUseMyMembership.mockReturnValue({ isChairperson: true, isTreasurer: false, loading: false })
    mockGetContributions.mockResolvedValue([])
    mockGetLoans.mockResolvedValue([loan(5000, 'REPAYING'), loan(2000, 'REQUESTED')])
    mockGetPayouts.mockResolvedValue([payout('SCHEDULED', '2026-08-01', 2, 1500), payout('SCHEDULED', '2026-07-15', 1, 1200)])

    renderAt()

    await waitFor(() => expect(screen.getByText('Outstanding loans')).toBeTruthy())
    expect(screen.getByText('KES 5,000')).toBeTruthy()
    expect(screen.getByText('1 active loan')).toBeTruthy()
    expect(screen.getByText('Next payout')).toBeTruthy()
    expect(screen.getByText('X')).toBeTruthy()
  })

  it('lets a chairperson set a savings goal for the first time', async () => {
    mockUseMyMembership.mockReturnValue({ isChairperson: true, isTreasurer: false, loading: false })
    mockGetContributions.mockResolvedValue([])
    mockUpdateChama.mockResolvedValue({ ...chama, savingsTarget: 50000 })

    renderAt()

    await waitFor(() => expect(screen.getByText('No savings goal set yet.')).toBeTruthy())
    fireEvent.click(screen.getByText('Edit savings goal'))
    fireEvent.change(screen.getByLabelText('Savings goal'), { target: { value: '50000' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(mockUpdateChama).toHaveBeenCalledWith(3, expect.objectContaining({ savingsTarget: 50000 })))
    await waitFor(() => expect(screen.queryByText('Edit Savings Goal')).toBeNull())
  })

  it('shows an error notice when saving the savings goal fails', async () => {
    mockUseMyMembership.mockReturnValue({ isChairperson: true, isTreasurer: false, loading: false })
    mockGetContributions.mockResolvedValue([])
    mockUpdateChama.mockRejectedValue(new Error('could not save goal'))

    renderAt()

    await waitFor(() => expect(screen.getByText('Edit savings goal')).toBeTruthy())
    fireEvent.click(screen.getByText('Edit savings goal'))
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(screen.getByText('could not save goal')).toBeTruthy())
  })

  it('shows the welfare fund KPI and lets a chairperson edit its goal', async () => {
    mockUseMyMembership.mockReturnValue({ isChairperson: true, isTreasurer: false, loading: false })
    mockGetContributions.mockResolvedValue([])
    mockGetWelfareFund.mockResolvedValue({ chamaId: 3, balance: 4000, target: 10000 })
    mockUpdateWelfareFundTarget.mockResolvedValue({ chamaId: 3, balance: 4000, target: 20000 })

    renderAt()

    await waitFor(() => expect(screen.getByText('Welfare fund')).toBeTruthy())
    expect(mockGetWelfareFund).toHaveBeenCalledWith(3)
    expect(screen.getByText('KES 4,000')).toBeTruthy()
    expect(screen.getByText('of KES 10,000 goal')).toBeTruthy()

    fireEvent.click(screen.getByText('Edit goal'))
    fireEvent.change(screen.getByLabelText('Welfare fund goal'), { target: { value: '20000' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(mockUpdateWelfareFundTarget).toHaveBeenCalledWith(3, { target: 20000 }))
    await waitFor(() => expect(screen.getByText('of KES 20,000 goal')).toBeTruthy())
  })

  it('shows an error notice when saving the welfare fund goal fails', async () => {
    mockUseMyMembership.mockReturnValue({ isChairperson: true, isTreasurer: false, loading: false })
    mockGetContributions.mockResolvedValue([])
    mockGetWelfareFund.mockResolvedValue({ chamaId: 3, balance: 4000, target: null })
    mockUpdateWelfareFundTarget.mockRejectedValue(new Error('could not save welfare goal'))

    renderAt()

    await waitFor(() => expect(screen.getByText('Edit goal')).toBeTruthy())
    fireEvent.click(screen.getByText('Edit goal'))
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(screen.getByText('could not save welfare goal')).toBeTruthy())
  })

  it('does not show the welfare fund KPI for a plain member', async () => {
    mockUseMyMembership.mockReturnValue({ isChairperson: false, isTreasurer: false, loading: false })
    mockGetMyContributions.mockResolvedValue([])

    renderAt()

    await waitFor(() => expect(screen.getByText('Tumaini Chama')).toBeTruthy())
    expect(mockGetWelfareFund).not.toHaveBeenCalled()
    expect(screen.queryByText('Welfare fund')).toBeNull()
  })

  it("computes the member's own loan balance from repayment schedules", async () => {
    mockUseMyMembership.mockReturnValue({ isChairperson: false, isTreasurer: false, loading: false })
    mockGetMyContributions.mockResolvedValue([])
    mockGetMyLoans.mockResolvedValue([loan(3000, 'DISBURSED')])
    mockGetLoanRepayments.mockResolvedValue([
      { id: 1, loanId: 1, installmentNumber: 1, scheduledDate: '2026-08-01', amountDue: 500, amountPaid: 200, status: 'PARTIAL' },
      { id: 2, loanId: 1, installmentNumber: 2, scheduledDate: '2026-09-01', amountDue: 500, amountPaid: 0, status: 'PENDING' },
    ])
    mockGetMyPayouts.mockResolvedValue([])

    renderAt()

    await waitFor(() => expect(screen.getByText('My loan balance')).toBeTruthy())
    expect(screen.getByText('KES 800')).toBeTruthy()
    expect(screen.getByText('My payout position')).toBeTruthy()
    expect(screen.getByText('No payout scheduled yet')).toBeTruthy()
  })

  it('shows a recent-activity panel for a manager', async () => {
    mockUseMyMembership.mockReturnValue({ isChairperson: true, isTreasurer: false, loading: false })
    mockGetContributions.mockResolvedValue([])
    mockUseActivityFeed.mockReturnValue({
      entries: [{ id: 1, chamaId: 3, eventType: 'CONTRIBUTION_PAID', description: 'Grace paid KES 500', createdAt: '2026-07-24T10:00:00Z' }],
      loading: false,
    })

    renderAt()

    await waitFor(() => expect(screen.getByText('Recent activity')).toBeTruthy())
    expect(screen.getByText('Grace paid KES 500')).toBeTruthy()
  })

  it('does not show a recent-activity panel for a plain member', async () => {
    mockUseMyMembership.mockReturnValue({ isChairperson: false, isTreasurer: false, loading: false })
    mockGetMyContributions.mockResolvedValue([])

    renderAt()

    await waitFor(() => expect(screen.getByText('Contributions by status')).toBeTruthy())
    expect(screen.queryByText('Recent activity')).toBeNull()
  })

  it('shows a savings goal card when the chama has a target set', async () => {
    mockUseMyMembership.mockReturnValue({ isChairperson: true, isTreasurer: false, loading: false })
    mockGetContributions.mockResolvedValue([])
    mockGetSavingsProgress.mockResolvedValue({ target: 500000, totalPaid: 320000 })

    renderAt()

    await waitFor(() => expect(screen.getByText('Savings goal')).toBeTruthy())
    expect(screen.getByText('KES 320,000 of KES 500,000 saved')).toBeTruthy()
  })

  it('omits the savings goal card when no target is set', async () => {
    mockUseMyMembership.mockReturnValue({ isChairperson: true, isTreasurer: false, loading: false })
    mockGetContributions.mockResolvedValue([])
    mockGetSavingsProgress.mockResolvedValue({ target: null, totalPaid: 0 })

    renderAt()

    await waitFor(() => expect(screen.getByText('Tumaini Chama')).toBeTruthy())
    expect(screen.queryByText('Savings goal')).toBeNull()
  })

  it('shows the chairperson pending sign-offs and loans awaiting decision', async () => {
    mockUseMyMembership.mockReturnValue({ member: { id: 6 }, isChairperson: true, isTreasurer: false, isSecretary: false, loading: false })
    mockGetContributions.mockResolvedValue([])
    mockGetLoans.mockResolvedValue([loan(2000, 'REQUESTED'), loan(3000, 'REQUESTED'), loan(5000, 'DISBURSED')])
    mockGetPendingApprovals.mockResolvedValue([{ id: 1, requestedByMemberId: 6 }, { id: 2, requestedByMemberId: 7 }])

    renderAt()

    await waitFor(() => expect(screen.getByText('Awaiting your sign-off')).toBeTruthy())
    expect(screen.getAllByText('2')).toHaveLength(2)
    expect(screen.getByText('Loans awaiting decision')).toBeTruthy()
  })

  it("shows the treasurer's overdue contributions and their own pending requests", async () => {
    mockUseMyMembership.mockReturnValue({ member: { id: 6 }, isChairperson: false, isTreasurer: true, isSecretary: false, loading: false })
    mockGetContributions.mockResolvedValue([contribution(1000, 0, 'OVERDUE'), contribution(1000, 1000, 'PAID')])
    mockGetPendingApprovals.mockResolvedValue([{ id: 1, requestedByMemberId: 6 }, { id: 2, requestedByMemberId: 7 }])

    renderAt()

    await waitFor(() => expect(screen.getByText('Overdue contributions')).toBeTruthy())
    expect(screen.getByText('Your pending requests')).toBeTruthy()
  })

  it('shows the secretary the next meeting and open resolution count', async () => {
    mockUseMyMembership.mockReturnValue({ member: { id: 6 }, isChairperson: false, isTreasurer: false, isSecretary: true, loading: false })
    mockGetMyContributions.mockResolvedValue([])
    mockGetMeetings.mockResolvedValue([
      { id: 1, chamaId: 3, meetingDate: '2099-01-01', agenda: 'Annual review', minutes: null, createdAt: '2026-01-01' },
    ])
    mockGetResolutions.mockResolvedValue([
      { id: 1, status: 'OPEN' },
      { id: 2, status: 'PASSED' },
    ])

    renderAt()

    await waitFor(() => expect(screen.getByText('Next meeting')).toBeTruthy())
    expect(screen.getByText('2099-01-01')).toBeTruthy()
    expect(screen.getByText('Annual review')).toBeTruthy()
    expect(screen.getByText('Open resolutions')).toBeTruthy()
    expect(screen.getByText('1')).toBeTruthy()
  })

  it('shows a no-meeting message for the secretary when nothing is scheduled', async () => {
    mockUseMyMembership.mockReturnValue({ member: { id: 6 }, isChairperson: false, isTreasurer: false, isSecretary: true, loading: false })
    mockGetMyContributions.mockResolvedValue([])
    mockGetMeetings.mockResolvedValue([])
    mockGetResolutions.mockResolvedValue([])

    renderAt()

    await waitFor(() => expect(screen.getByText('No meeting scheduled yet')).toBeTruthy())
  })

  it('does not show any role-focus tiles for a plain member', async () => {
    mockUseMyMembership.mockReturnValue({ member: { id: 6 }, isChairperson: false, isTreasurer: false, isSecretary: false, loading: false })
    mockGetMyContributions.mockResolvedValue([])

    renderAt()

    await waitFor(() => expect(screen.getByText('Tumaini Chama')).toBeTruthy())
    expect(screen.queryByText('Awaiting your sign-off')).toBeNull()
    expect(screen.queryByText('Overdue contributions')).toBeNull()
    expect(screen.queryByText('Next meeting')).toBeNull()
  })
})
