import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import PayoutsPage from './PayoutsPage'
import { selectOption } from '../../test-utils/selectOption'

vi.mock('../../api/payouts', () => ({
  getPayoutSchedule: vi.fn(),
  generatePayoutSchedule: vi.fn(),
  getPayouts: vi.fn(),
  getMyPayouts: vi.fn(),
  createPayout: vi.fn(),
  disbursePayout: vi.fn(),
}))
vi.mock('../../api/members', () => ({
  getMembers: vi.fn(),
}))
vi.mock('../../api/chamas', () => ({
  getChama: vi.fn(),
  updateAutoPushSettings: vi.fn(),
}))
vi.mock('../../hooks/useMyMembership', () => ({
  useMyMembership: vi.fn(),
}))

import {
  getPayoutSchedule,
  generatePayoutSchedule,
  getPayouts,
  getMyPayouts,
  createPayout,
  disbursePayout,
} from '../../api/payouts'
import { getMembers } from '../../api/members'
import { getChama, updateAutoPushSettings } from '../../api/chamas'
import { useMyMembership } from '../../hooks/useMyMembership'

const mockGetPayoutSchedule = getPayoutSchedule as ReturnType<typeof vi.fn>
const mockGeneratePayoutSchedule = generatePayoutSchedule as ReturnType<typeof vi.fn>
const mockGetPayouts = getPayouts as ReturnType<typeof vi.fn>
const mockGetMyPayouts = getMyPayouts as ReturnType<typeof vi.fn>
const mockCreatePayout = createPayout as ReturnType<typeof vi.fn>
const mockDisbursePayout = disbursePayout as ReturnType<typeof vi.fn>
const mockGetMembers = getMembers as ReturnType<typeof vi.fn>
const mockGetChama = getChama as ReturnType<typeof vi.fn>
const mockUpdateAutoPushSettings = updateAutoPushSettings as ReturnType<typeof vi.fn>
const mockUseMyMembership = useMyMembership as ReturnType<typeof vi.fn>

const scheduleEntry = {
  id: 1,
  chamaId: 3,
  memberId: 5,
  memberName: 'Jane Doe',
  rotationOrderType: 'SENIORITY' as const,
  sequencePosition: 1,
  status: 'ACTIVE' as const,
}

const payout = {
  id: 1,
  chamaId: 3,
  memberId: 5,
  memberName: 'Jane Doe',
  roundNumber: 1,
  scheduledDate: '2026-08-01',
  amount: 2000,
  status: 'SCHEDULED' as const,
  disbursedAt: null,
  createdAt: '2026-07-01T00:00:00Z',
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/chamas/3/payouts']}>
      <Routes>
        <Route path="/chamas/:chamaId/payouts" element={<PayoutsPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('PayoutsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetMembers.mockResolvedValue([{ id: 5, fullName: 'Jane Doe', status: 'ACTIVE' }])
    mockGetChama.mockResolvedValue({ id: 3, name: 'Tumaini', autoPushEnabled: true, autoPushRetryHours: 24 })
  })

  it('shows the full schedule and ledger for a treasurer/chairperson', async () => {
    mockUseMyMembership.mockReturnValue({ isTreasurer: true, isChairperson: false, member: null, loading: false })
    mockGetPayoutSchedule.mockResolvedValue([scheduleEntry])
    mockGetPayouts.mockResolvedValue([payout])
    renderPage()

    await waitFor(() => expect(screen.getAllByText('Jane Doe').length).toBeGreaterThan(0))
    expect(screen.getByText('Payouts', { selector: 'h2' })).toBeTruthy()
    expect(mockGetMyPayouts).not.toHaveBeenCalled()
  })

  it("shows only the caller's own payouts for a plain member", async () => {
    mockUseMyMembership.mockReturnValue({ isTreasurer: false, isChairperson: false, member: { id: 5 }, loading: false })
    mockGetPayoutSchedule.mockResolvedValue([scheduleEntry])
    mockGetMyPayouts.mockResolvedValue([payout])
    renderPage()

    await waitFor(() => expect(screen.getByText('My Payouts')).toBeTruthy())
    expect(mockGetPayouts).not.toHaveBeenCalled()
  })

  it('shows empty states when there is no schedule or payouts', async () => {
    mockUseMyMembership.mockReturnValue({ isTreasurer: true, isChairperson: false, member: null, loading: false })
    mockGetPayoutSchedule.mockResolvedValue([])
    mockGetPayouts.mockResolvedValue([])
    renderPage()

    await waitFor(() => expect(screen.getByText(/no rotation schedule generated yet/i)).toBeTruthy())
    expect(screen.getByText(/no payouts yet/i)).toBeTruthy()
  })

  it('does not offer manage actions to a plain member', async () => {
    mockUseMyMembership.mockReturnValue({ isTreasurer: false, isChairperson: false, member: { id: 5 }, loading: false })
    mockGetPayoutSchedule.mockResolvedValue([scheduleEntry])
    mockGetMyPayouts.mockResolvedValue([payout])
    renderPage()

    await waitFor(() => expect(screen.getByText('My Payouts')).toBeTruthy())
    expect(screen.queryByText('Generate Schedule')).toBeNull()
    expect(screen.queryByText('Create Next Payout')).toBeNull()
    expect(screen.queryByText('Disburse')).toBeNull()
  })

  it('lets a manager generate a SENIORITY rotation schedule', async () => {
    mockUseMyMembership.mockReturnValue({ isTreasurer: true, isChairperson: false, member: null, loading: false })
    mockGetPayoutSchedule.mockResolvedValue([])
    mockGetPayouts.mockResolvedValue([])
    mockGeneratePayoutSchedule.mockResolvedValue([scheduleEntry])
    renderPage()

    await waitFor(() => expect(screen.getByText(/no rotation schedule generated yet/i)).toBeTruthy())
    fireEvent.click(screen.getByText('Generate Schedule'))
    fireEvent.click(screen.getByText('Generate Schedule', { selector: 'button[type="submit"]' }))

    await waitFor(() =>
      expect(mockGeneratePayoutSchedule).toHaveBeenCalledWith(3, { rotationOrderType: 'SENIORITY', agreedMemberIds: undefined }),
    )
  })

  it('lets a manager generate an AGREED order with a reordered member list', async () => {
    mockUseMyMembership.mockReturnValue({ isTreasurer: true, isChairperson: false, member: null, loading: false })
    mockGetMembers.mockResolvedValue([
      { id: 5, fullName: 'Jane Doe', status: 'ACTIVE' },
      { id: 6, fullName: 'John Roe', status: 'ACTIVE' },
    ])
    mockGetPayoutSchedule.mockResolvedValue([])
    mockGetPayouts.mockResolvedValue([])
    mockGeneratePayoutSchedule.mockResolvedValue([])
    renderPage()

    await waitFor(() => expect(screen.getByText(/no rotation schedule generated yet/i)).toBeTruthy())
    fireEvent.click(screen.getByText('Generate Schedule'))
    selectOption(/rotation order/i, 'Agreed order')

    await waitFor(() => expect(screen.getByText(/1\. Jane Doe/)).toBeTruthy())
    fireEvent.click(screen.getAllByText('↓')[0])
    fireEvent.click(screen.getByText('Generate Schedule', { selector: 'button[type="submit"]' }))

    await waitFor(() =>
      expect(mockGeneratePayoutSchedule).toHaveBeenCalledWith(3, { rotationOrderType: 'AGREED', agreedMemberIds: [6, 5] }),
    )
  })

  it('shows the backend error message when generating a schedule fails', async () => {
    mockUseMyMembership.mockReturnValue({ isTreasurer: true, isChairperson: false, member: null, loading: false })
    mockGetPayoutSchedule.mockResolvedValue([])
    mockGetPayouts.mockResolvedValue([])
    mockGeneratePayoutSchedule.mockRejectedValue(new Error('Chama has no active members to schedule'))
    renderPage()

    await waitFor(() => expect(screen.getByText(/no rotation schedule generated yet/i)).toBeTruthy())
    fireEvent.click(screen.getByText('Generate Schedule'))
    fireEvent.click(screen.getByText('Generate Schedule', { selector: 'button[type="submit"]' }))

    await waitFor(() => expect(screen.getByText('Chama has no active members to schedule')).toBeTruthy())
  })

  it('lets a manager create the next payout', async () => {
    mockUseMyMembership.mockReturnValue({ isTreasurer: true, isChairperson: false, member: null, loading: false })
    mockGetPayoutSchedule.mockResolvedValue([scheduleEntry])
    mockGetPayouts.mockResolvedValue([])
    mockCreatePayout.mockResolvedValue(payout)
    renderPage()

    await waitFor(() => expect(screen.getByText(/no payouts yet/i)).toBeTruthy())
    fireEvent.click(screen.getByText('Create Next Payout'))
    fireEvent.change(screen.getByLabelText(/scheduled date/i), { target: { value: '2026-08-01' } })
    fireEvent.click(screen.getByText('Create Payout', { selector: 'button[type="submit"]' }))

    await waitFor(() => expect(mockCreatePayout).toHaveBeenCalledWith(3, { scheduledDate: '2026-08-01' }))
  })

  it('lets a manager disburse a scheduled payout after confirming', async () => {
    mockUseMyMembership.mockReturnValue({ isTreasurer: true, isChairperson: false, member: null, loading: false })
    mockGetPayoutSchedule.mockResolvedValue([scheduleEntry])
    mockGetPayouts.mockResolvedValue([payout])
    mockDisbursePayout.mockResolvedValue({ ...payout, status: 'DISBURSED', disbursedAt: '2026-08-01T00:00:00Z' })
    renderPage()

    await waitFor(() => expect(screen.getByText('Disburse')).toBeTruthy())
    fireEvent.click(screen.getByText('Disburse'))
    fireEvent.click(screen.getByText('Mark Disbursed'))

    await waitFor(() => expect(mockDisbursePayout).toHaveBeenCalledWith(3, 1))
  })

  it('does not offer Disburse for an already-disbursed payout', async () => {
    mockUseMyMembership.mockReturnValue({ isTreasurer: true, isChairperson: false, member: null, loading: false })
    mockGetPayoutSchedule.mockResolvedValue([scheduleEntry])
    mockGetPayouts.mockResolvedValue([{ ...payout, status: 'DISBURSED', disbursedAt: '2026-08-01T00:00:00Z' }])
    renderPage()

    await waitFor(() => expect(screen.getAllByText('Jane Doe').length).toBeGreaterThan(0))
    expect(screen.queryByText('Disburse')).toBeNull()
  })

  it('does not show auto-push settings to a plain member', async () => {
    mockUseMyMembership.mockReturnValue({ isTreasurer: false, isChairperson: false, member: { id: 5 }, loading: false })
    mockGetPayoutSchedule.mockResolvedValue([scheduleEntry])
    mockGetMyPayouts.mockResolvedValue([payout])
    renderPage()

    await waitFor(() => expect(screen.getByText('My Payouts')).toBeTruthy())
    expect(screen.queryByText('Auto-push settings')).toBeNull()
    expect(mockGetChama).not.toHaveBeenCalled()
  })

  it('preloads auto-push settings for a manager and saves changes', async () => {
    mockUseMyMembership.mockReturnValue({ isTreasurer: true, isChairperson: false, member: null, loading: false })
    mockGetPayoutSchedule.mockResolvedValue([scheduleEntry])
    mockGetPayouts.mockResolvedValue([payout])
    mockUpdateAutoPushSettings.mockResolvedValue({ id: 3, name: 'Tumaini', autoPushEnabled: false, autoPushRetryHours: 48 })
    renderPage()

    await waitFor(() => expect(screen.getByText('Auto-push settings')).toBeTruthy())
    expect(screen.getByLabelText('Enable auto-push')).toBeChecked()
    expect(screen.getByLabelText(/retry after/i)).toHaveValue(24)

    fireEvent.click(screen.getByLabelText('Enable auto-push'))
    fireEvent.change(screen.getByLabelText(/retry after/i), { target: { value: '48' } })
    fireEvent.click(screen.getByText('Save Auto-Push Settings'))

    await waitFor(() =>
      expect(mockUpdateAutoPushSettings).toHaveBeenCalledWith(3, { autoPushEnabled: false, autoPushRetryHours: 48 }),
    )
    await waitFor(() => expect(screen.getByText('Auto-push settings saved.')).toBeTruthy())
  })

  it('shows an error when saving auto-push settings fails', async () => {
    mockUseMyMembership.mockReturnValue({ isTreasurer: true, isChairperson: false, member: null, loading: false })
    mockGetPayoutSchedule.mockResolvedValue([scheduleEntry])
    mockGetPayouts.mockResolvedValue([payout])
    mockUpdateAutoPushSettings.mockRejectedValue(new Error('could not save settings'))
    renderPage()

    await waitFor(() => expect(screen.getByText('Auto-push settings')).toBeTruthy())
    fireEvent.click(screen.getByText('Save Auto-Push Settings'))

    await waitFor(() => expect(screen.getByText('could not save settings')).toBeTruthy())
  })

  it('disables the retry-hours field while auto-push is off', async () => {
    mockUseMyMembership.mockReturnValue({ isTreasurer: true, isChairperson: false, member: null, loading: false })
    mockGetPayoutSchedule.mockResolvedValue([scheduleEntry])
    mockGetPayouts.mockResolvedValue([payout])
    mockGetChama.mockResolvedValue({ id: 3, name: 'Tumaini', autoPushEnabled: false, autoPushRetryHours: 24 })
    renderPage()

    await waitFor(() => expect(screen.getByText('Auto-push settings')).toBeTruthy())
    expect(screen.getByLabelText(/retry after/i)).toBeDisabled()
  })

  it('distinguishes a failed load from an empty list', async () => {
    mockUseMyMembership.mockReturnValue({ isTreasurer: true, isChairperson: false, member: null, loading: false })
    mockGetPayouts.mockResolvedValue([])
    mockGetPayoutSchedule.mockRejectedValue(new Error('Service unavailable'))
    renderPage()

    expect(await screen.findByTestId('load-failed')).toBeTruthy()
    expect(screen.getByText('Service unavailable')).toBeTruthy()
    // A request that failed is not an account with nothing in it. Saying the second when the first
    // happened states something false and then invites the reader to act on it.
    expect(screen.queryByTestId('empty-state')).toBeNull()
  })
})
