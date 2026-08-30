import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import WelfareFundPage from './WelfareFundPage'
import { selectOption } from '../../test-utils/selectOption'

vi.mock('../../api/welfareFund', () => ({
  getWelfareFund: vi.fn(),
  getWelfareContributions: vi.fn(),
  getMyWelfareContributions: vi.fn(),
  recordWelfareContribution: vi.fn(),
  payWelfareContributionWithMpesa: vi.fn(),
  getWelfareWithdrawals: vi.fn(),
  createWelfareWithdrawal: vi.fn(),
  disburseWelfareWithdrawal: vi.fn(),
}))
vi.mock('../../api/members', () => ({
  getMembers: vi.fn(),
}))
vi.mock('../../hooks/useMyMembership', () => ({
  useMyMembership: vi.fn(),
}))

import {
  getWelfareFund,
  getWelfareContributions,
  getMyWelfareContributions,
  recordWelfareContribution,
  payWelfareContributionWithMpesa,
  getWelfareWithdrawals,
  createWelfareWithdrawal,
  disburseWelfareWithdrawal,
  type WelfareWithdrawal,
} from '../../api/welfareFund'
import { getMembers } from '../../api/members'
import { useMyMembership } from '../../hooks/useMyMembership'

const mockGetWelfareFund = getWelfareFund as ReturnType<typeof vi.fn>
const mockGetWelfareContributions = getWelfareContributions as ReturnType<typeof vi.fn>
const mockGetMyWelfareContributions = getMyWelfareContributions as ReturnType<typeof vi.fn>
const mockRecordWelfareContribution = recordWelfareContribution as ReturnType<typeof vi.fn>
const mockPayWelfareContributionWithMpesa = payWelfareContributionWithMpesa as ReturnType<typeof vi.fn>
const mockGetWelfareWithdrawals = getWelfareWithdrawals as ReturnType<typeof vi.fn>
const mockCreateWelfareWithdrawal = createWelfareWithdrawal as ReturnType<typeof vi.fn>
const mockDisburseWelfareWithdrawal = disburseWelfareWithdrawal as ReturnType<typeof vi.fn>
const mockGetMembers = getMembers as ReturnType<typeof vi.fn>
const mockUseMyMembership = useMyMembership as ReturnType<typeof vi.fn>

function aWithdrawal(overrides: Partial<WelfareWithdrawal> = {}): WelfareWithdrawal {
  return {
    id: 4,
    chamaId: 3,
    amount: 200,
    reason: 'Medical emergency',
    status: 'PENDING_APPROVAL',
    requestedByMemberId: 6,
    requestedByName: 'Treasurer One',
    requestedAt: '2026-08-01T00:00:00Z',
    disbursedByMemberId: null,
    disbursedByName: null,
    disbursedAt: null,
    ...overrides,
  }
}

const contribution = {
  id: 1,
  chamaId: 3,
  memberId: 5,
  memberName: 'Jane Doe',
  amount: 300,
  paymentMethod: 'CASH' as const,
  status: 'PAID' as const,
  paidAt: '2026-07-01T00:00:00Z',
  createdAt: '2026-07-01T00:00:00Z',
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/chamas/3/welfare-fund']}>
      <Routes>
        <Route path="/chamas/:chamaId/welfare-fund" element={<WelfareFundPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('WelfareFundPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetMembers.mockResolvedValue([{ id: 5, fullName: 'Jane Doe' }])
    mockGetMyWelfareContributions.mockResolvedValue([])
  })

  it('shows the fund balance and contribution/withdrawal lists for a manager', async () => {
    mockUseMyMembership.mockReturnValue({ isManager: true, member: { id: 6, phone: '254700000001' }, loading: false })
    mockGetWelfareFund.mockResolvedValue({ chamaId: 3, balance: 5000 })
    mockGetWelfareContributions.mockResolvedValue([contribution])
    mockGetWelfareWithdrawals.mockResolvedValue([])

    renderPage()

    await waitFor(() => expect(screen.getByText('Jane Doe')).toBeTruthy())
    expect(screen.getByText('5,000')).toBeTruthy()
  })

  it("shows only the caller's own contributions for a plain member, without a fund balance", async () => {
    mockUseMyMembership.mockReturnValue({ isManager: false, member: { id: 5, phone: '254700000001' }, loading: false })
    mockGetMyWelfareContributions.mockResolvedValue([contribution])

    renderPage()

    await waitFor(() => expect(screen.getByText('300')).toBeTruthy())
    expect(screen.queryByText('Jane Doe')).toBeNull()
    expect(mockGetWelfareFund).not.toHaveBeenCalled()
    expect(mockGetWelfareContributions).not.toHaveBeenCalled()
  })

  it('lets a member contribute via M-Pesa', async () => {
    mockUseMyMembership.mockReturnValue({ isManager: false, member: { id: 5, phone: '254700000001' }, loading: false })
    mockPayWelfareContributionWithMpesa.mockResolvedValue(undefined)

    renderPage()

    await waitFor(() => expect(screen.getByText(/no welfare contributions yet/i)).toBeTruthy())
    fireEvent.click(screen.getByText('+ Contribute'))
    fireEvent.change(screen.getByLabelText(/amount/i), { target: { value: '300' } })
    fireEvent.click(screen.getByText('Send M-Pesa Prompt'))

    await waitFor(() => expect(mockPayWelfareContributionWithMpesa).toHaveBeenCalledWith(3, 300))
  })

  it('does not offer Record Contribution or Withdrawal to a plain member', async () => {
    mockUseMyMembership.mockReturnValue({ isManager: false, member: { id: 5, phone: '254700000001' }, loading: false })

    renderPage()

    await waitFor(() => expect(screen.getByText(/no welfare contributions yet/i)).toBeTruthy())
    expect(screen.queryByText('+ Record Contribution')).toBeNull()
    expect(screen.queryByText('+ Withdrawal')).toBeNull()
  })

  it('lets a manager record a manual contribution', async () => {
    mockUseMyMembership.mockReturnValue({ isManager: true, member: { id: 6, phone: '254700000001' }, loading: false })
    mockGetWelfareFund.mockResolvedValue({ chamaId: 3, balance: 0 })
    mockGetWelfareContributions.mockResolvedValue([])
    mockGetWelfareWithdrawals.mockResolvedValue([])
    mockRecordWelfareContribution.mockResolvedValue({ ...contribution, id: 2 })

    renderPage()

    await waitFor(() => expect(screen.getByText(/no welfare contributions yet/i)).toBeTruthy())
    fireEvent.click(screen.getByText('+ Record Contribution'))
    selectOption(/member/i, 'Jane Doe')
    fireEvent.change(screen.getByLabelText(/amount/i), { target: { value: '300' } })
    fireEvent.click(screen.getByText('Record Contribution', { selector: 'button[type="submit"]' }))

    await waitFor(() => expect(mockRecordWelfareContribution).toHaveBeenCalledWith(3, {
      memberId: 5,
      amount: 300,
      method: 'CASH',
    }))
  })

  it('lets a manager record a withdrawal', async () => {
    mockUseMyMembership.mockReturnValue({ isManager: true, member: { id: 6, phone: '254700000001' }, loading: false })
    mockGetWelfareFund.mockResolvedValue({ chamaId: 3, balance: 1000 })
    mockGetWelfareContributions.mockResolvedValue([])
    mockGetWelfareWithdrawals.mockResolvedValue([])
    mockCreateWelfareWithdrawal.mockResolvedValue(aWithdrawal({ id: 4, amount: 200, reason: 'Medical emergency' }))

    renderPage()

    await waitFor(() => expect(screen.getByText('1,000')).toBeTruthy())
    fireEvent.click(screen.getByText('+ Withdrawal'))
    fireEvent.change(screen.getByLabelText(/amount/i), { target: { value: '200' } })
    fireEvent.change(screen.getByLabelText(/reason/i), { target: { value: 'Medical emergency' } })
    fireEvent.click(screen.getByText('Record Withdrawal', { selector: 'button[type="submit"]' }))

    await waitFor(() => expect(mockCreateWelfareWithdrawal).toHaveBeenCalledWith(3, { amount: 200, reason: 'Medical emergency' }))
  })

  it('says the money moved when a small withdrawal disburses in one step', async () => {
    mockUseMyMembership.mockReturnValue({ isManager: true, member: { id: 6, phone: '254700000001' }, loading: false })
    mockGetWelfareFund.mockResolvedValue({ chamaId: 3, balance: 1000 })
    mockGetWelfareContributions.mockResolvedValue([])
    mockGetWelfareWithdrawals.mockResolvedValue([])
    mockCreateWelfareWithdrawal.mockResolvedValue(aWithdrawal({ status: 'DISBURSED' }))

    renderPage()
    await waitFor(() => expect(screen.getByText('1,000')).toBeTruthy())
    fireEvent.click(screen.getByText('+ Withdrawal'))
    fireEvent.change(screen.getByLabelText(/amount/i), { target: { value: '200' } })
    fireEvent.change(screen.getByLabelText(/reason/i), { target: { value: 'Medical emergency' } })
    fireEvent.click(screen.getByText('Record Withdrawal', { selector: 'button[type="submit"]' }))

    expect(await screen.findByText(/disbursed from the fund/i)).toBeTruthy()
  })

  it('says the money has not moved when a large withdrawal needs sign-off', async () => {
    mockUseMyMembership.mockReturnValue({ isManager: true, member: { id: 6, phone: '254700000001' }, loading: false })
    mockGetWelfareFund.mockResolvedValue({ chamaId: 3, balance: 100000 })
    mockGetWelfareContributions.mockResolvedValue([])
    mockGetWelfareWithdrawals.mockResolvedValue([])
    mockCreateWelfareWithdrawal.mockResolvedValue(aWithdrawal({ status: 'PENDING_APPROVAL' }))

    renderPage()
    await waitFor(() => expect(screen.getByText('100,000')).toBeTruthy())
    fireEvent.click(screen.getByText('+ Withdrawal'))
    fireEvent.change(screen.getByLabelText(/amount/i), { target: { value: '50000' } })
    fireEvent.change(screen.getByLabelText(/reason/i), { target: { value: 'Medical emergency' } })
    fireEvent.click(screen.getByText('Record Withdrawal', { selector: 'button[type="submit"]' }))

    // Telling the treasurer the fund was debited when it was not is the failure that matters here.
    expect(await screen.findByText(/needs two sign-offs/i)).toBeTruthy()
  })

  it('offers Disburse only on a withdrawal that is still awaiting sign-off', async () => {
    mockUseMyMembership.mockReturnValue({ isManager: true, member: { id: 6, phone: '254700000001' }, loading: false })
    mockGetWelfareFund.mockResolvedValue({ chamaId: 3, balance: 1000 })
    mockGetWelfareContributions.mockResolvedValue([])
    mockGetWelfareWithdrawals.mockResolvedValue([
      aWithdrawal({ id: 4, reason: 'Awaiting', status: 'PENDING_APPROVAL' }),
      aWithdrawal({ id: 5, reason: 'Already out', status: 'DISBURSED', disbursedByName: 'Treasurer One' }),
    ])

    renderPage()
    await waitFor(() => expect(screen.getByText('Awaiting')).toBeTruthy())

    expect(screen.getAllByText('Disburse')).toHaveLength(1)
    expect(screen.getByText('Awaiting sign-off')).toBeTruthy()
    expect(screen.getByText('Disbursed')).toBeTruthy()
  })

  it('confirms before releasing the money, and reports a refusal on the page', async () => {
    mockUseMyMembership.mockReturnValue({ isManager: true, member: { id: 6, phone: '254700000001' }, loading: false })
    mockGetWelfareFund.mockResolvedValue({ chamaId: 3, balance: 1000 })
    mockGetWelfareContributions.mockResolvedValue([])
    mockGetWelfareWithdrawals.mockResolvedValue([aWithdrawal({ id: 4, status: 'PENDING_APPROVAL' })])
    mockDisburseWelfareWithdrawal.mockRejectedValue(new Error('Dual sign-off approval has not cleared yet'))

    renderPage()
    await waitFor(() => expect(screen.getByText('Disburse')).toBeTruthy())
    fireEvent.click(screen.getByText('Disburse'))

    // The dialog names the amount and reason, since this debits the fund irreversibly.
    expect(await screen.findByText(/cannot be undone/i)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Disburse' }))

    await waitFor(() => expect(mockDisburseWelfareWithdrawal).toHaveBeenCalledWith(3, 4))
    expect(await screen.findByText(/has not cleared yet/i)).toBeTruthy()
  })

  it('lets a manager cancel out of the disburse confirmation', async () => {
    mockUseMyMembership.mockReturnValue({ isManager: true, member: { id: 6, phone: '254700000001' }, loading: false })
    mockGetWelfareFund.mockResolvedValue({ chamaId: 3, balance: 1000 })
    mockGetWelfareContributions.mockResolvedValue([])
    mockGetWelfareWithdrawals.mockResolvedValue([aWithdrawal({ id: 4, status: 'PENDING_APPROVAL' })])

    renderPage()
    await waitFor(() => expect(screen.getByText('Disburse')).toBeTruthy())
    fireEvent.click(screen.getByText('Disburse'))
    fireEvent.click(await screen.findByRole('button', { name: /cancel/i }))

    await waitFor(() => expect(screen.queryByText(/cannot be undone/i)).toBeNull())
    expect(mockDisburseWelfareWithdrawal).not.toHaveBeenCalled()
  })

  it('lets a manager close the record-contribution and withdrawal modals, and change the payment method', async () => {
    mockUseMyMembership.mockReturnValue({ isManager: true, member: { id: 6, phone: '254700000001' }, loading: false })
    mockGetWelfareFund.mockResolvedValue({ chamaId: 3, balance: 0 })
    mockGetWelfareContributions.mockResolvedValue([])
    mockGetWelfareWithdrawals.mockResolvedValue([])

    renderPage()

    await waitFor(() => expect(screen.getByText(/no welfare contributions yet/i)).toBeTruthy())

    fireEvent.click(screen.getByText('+ Record Contribution'))
    selectOption(/method/i, 'Bank')
    fireEvent.click(screen.getByLabelText(/close/i))
    expect(screen.queryByText('Record Contribution', { selector: 'h2, [role="heading"]' })).toBeNull()

    fireEvent.click(screen.getByText('+ Withdrawal'))
    fireEvent.click(screen.getByLabelText(/close/i))
  })

  it('shows the backend error message when a contribution fails', async () => {
    mockUseMyMembership.mockReturnValue({ isManager: false, member: { id: 5, phone: '254700000001' }, loading: false })
    mockPayWelfareContributionWithMpesa.mockRejectedValue(new Error('insufficient STK push quota'))

    renderPage()

    await waitFor(() => expect(screen.getByText(/no welfare contributions yet/i)).toBeTruthy())
    fireEvent.click(screen.getByText('+ Contribute'))
    fireEvent.change(screen.getByLabelText(/amount/i), { target: { value: '300' } })
    fireEvent.click(screen.getByText('Send M-Pesa Prompt'))

    await waitFor(() => expect(screen.getByText('insufficient STK push quota')).toBeTruthy())
  })

  it('distinguishes a failed load from an empty list', async () => {
    mockUseMyMembership.mockReturnValue({ isManager: false, member: null, loading: false })
    mockGetMyWelfareContributions.mockRejectedValue(new Error('Service unavailable'))
    renderPage()

    expect(await screen.findByTestId('load-failed')).toBeTruthy()
    expect(screen.getByText('Service unavailable')).toBeTruthy()
    // A request that failed is not an account with nothing in it. Saying the second when the first
    // happened states something false and then invites the reader to act on it.
    expect(screen.queryByTestId('empty-state')).toBeNull()
  })
})
