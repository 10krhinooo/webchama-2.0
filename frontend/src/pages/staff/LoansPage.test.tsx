import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import LoansPage from './LoansPage'
import { selectOption } from '../../test-utils/selectOption'

vi.mock('../../api/loans', () => ({
  getLoans: vi.fn(),
  getMyLoans: vi.fn(),
  createLoan: vi.fn(),
  approveLoan: vi.fn(),
  rejectLoan: vi.fn(),
  getLoanRepayments: vi.fn(),
  recordLoanRepayment: vi.fn(),
  disburseLoan: vi.fn(),
}))
vi.mock('../../api/members', () => ({
  getMembers: vi.fn(),
  getCreditScores: vi.fn(),
  CREDIT_SCORE_BAND_LABELS: {
    INSUFFICIENT_HISTORY: 'Not enough history',
    POOR: 'Poor',
    FAIR: 'Fair',
    GOOD: 'Good',
    EXCELLENT: 'Excellent',
  },
}))
vi.mock('../../api/chamas', () => ({
  getChama: vi.fn(),
}))
vi.mock('../../hooks/useMyMembership', () => ({
  useMyMembership: vi.fn(),
}))

import { getLoans, getMyLoans, createLoan, approveLoan, rejectLoan, getLoanRepayments, recordLoanRepayment, disburseLoan } from '../../api/loans'
import type { Loan } from '../../api/loans'
import { getMembers, getCreditScores, type CreditScore } from '../../api/members'
import { getChama } from '../../api/chamas'
import { useMyMembership } from '../../hooks/useMyMembership'

const mockDisburseLoan = disburseLoan as ReturnType<typeof vi.fn>
const mockGetChama = getChama as ReturnType<typeof vi.fn>
const mockGetLoans = getLoans as ReturnType<typeof vi.fn>
const mockGetMyLoans = getMyLoans as ReturnType<typeof vi.fn>
const mockCreateLoan = createLoan as ReturnType<typeof vi.fn>
const mockApproveLoan = approveLoan as ReturnType<typeof vi.fn>
const mockRejectLoan = rejectLoan as ReturnType<typeof vi.fn>
const mockGetLoanRepayments = getLoanRepayments as ReturnType<typeof vi.fn>
const mockRecordLoanRepayment = recordLoanRepayment as ReturnType<typeof vi.fn>
const mockGetMembers = getMembers as ReturnType<typeof vi.fn>
const mockGetCreditScores = getCreditScores as ReturnType<typeof vi.fn>
const mockUseMyMembership = useMyMembership as ReturnType<typeof vi.fn>

const loan = {
  id: 1,
  chamaId: 3,
  memberId: 5,
  memberName: 'Jane Doe',
  principal: 10000,
  interestRate: 12,
  interestMethod: 'FLAT' as const,
  termMonths: 6,
  status: 'REQUESTED' as const,
  approvedByMemberId: null,
  approvedByName: null,
  requestedAt: '2026-07-01T00:00:00Z',
  approvedAt: null,
  disbursedAt: null,
}

function aCreditScore(overrides: Partial<CreditScore> = {}): CreditScore {
  return {
    memberId: 5,
    score: 82,
    band: 'GOOD',
    confidence: 0.9,
    contributionConsistency: 0.88,
    contributionTimeliness: 0.8,
    loanRepaymentRate: 0.9,
    meetingAttendanceRate: 0.7,
    penaltyDeduction: 0,
    outstandingDebt: '0.00',
    totalSavings: '12000.00',
    hasDefaultedLoan: false,
    contributionsConsidered: 12,
    meetingsConsidered: 6,
    loanRepaymentsConsidered: 4,
    strengths: [],
    weaknesses: [],
    ...overrides,
  }
}

const repayment = {
  id: 10,
  loanId: 1,
  installmentNumber: 1,
  scheduledDate: '2026-08-01',
  amountDue: 1766.67,
  amountPaid: 0,
  status: 'PENDING' as const,
}

/**
 * Builds a loan from the shared fixture, for tests that vary one field.
 *
 * Typed against Loan rather than `typeof loan`, because the fixture pins its status with
 * `as const` and would otherwise reject every other status.
 */
function aLoan(overrides: Partial<Loan> = {}): Loan {
  return { ...loan, ...overrides }
}

const asManager = () =>
  mockUseMyMembership.mockReturnValue({ isTreasurer: true, isChairperson: false, member: null, loading: false })

const asMember = () =>
  mockUseMyMembership.mockReturnValue({ isTreasurer: false, isChairperson: false, member: { id: 5 }, loading: false })

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/chamas/3/loans']}>
      <Routes>
        <Route path="/chamas/:chamaId/loans" element={<LoansPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('LoansPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetMembers.mockResolvedValue([{ id: 5, fullName: 'Jane Doe' }])
    mockGetCreditScores.mockResolvedValue([aCreditScore()])
    mockGetChama.mockResolvedValue({ id: 3, name: 'Umoja', approvalThreshold: 50000 })
  })

  it('lists all loans for a treasurer/chairperson', async () => {
    mockUseMyMembership.mockReturnValue({ isTreasurer: true, isChairperson: false, member: null, loading: false })
    mockGetLoans.mockResolvedValue([loan])
    renderPage()

    await waitFor(() => expect(screen.getByText('Jane Doe')).toBeTruthy())
    expect(screen.getByText('Loans')).toBeTruthy()
    expect(mockGetMyLoans).not.toHaveBeenCalled()
  })

  it("shows the loan member's credit score to a manager", async () => {
    mockUseMyMembership.mockReturnValue({ isTreasurer: true, isChairperson: false, member: null, loading: false })
    mockGetLoans.mockResolvedValue([loan])
    renderPage()

    // One request for the whole chama, not one per member on the page.
    await waitFor(() => expect(mockGetCreditScores).toHaveBeenCalledWith(3))
    await waitFor(() => expect(screen.getByText('82')).toBeTruthy())
  })

  it('marks a thinly evidenced score rather than presenting it as settled', async () => {
    mockUseMyMembership.mockReturnValue({ isTreasurer: true, isChairperson: false, member: null, loading: false })
    mockGetLoans.mockResolvedValue([loan])
    mockGetCreditScores.mockResolvedValue([aCreditScore({ score: 82, confidence: 0.2 })])
    renderPage()

    await waitFor(() => expect(screen.getByText('82?')).toBeTruthy())
    expect(screen.getByText(/based on limited history/)).toBeTruthy()
  })

  it('shows a member with no history as new instead of inventing a number', async () => {
    mockUseMyMembership.mockReturnValue({ isTreasurer: true, isChairperson: false, member: null, loading: false })
    mockGetLoans.mockResolvedValue([loan])
    mockGetCreditScores.mockResolvedValue([
      aCreditScore({ score: null, band: 'INSUFFICIENT_HISTORY', confidence: 0 }),
    ])
    renderPage()

    await waitFor(() => expect(screen.getByText('New')).toBeTruthy())
    expect(screen.getByText(/nothing to score yet/)).toBeTruthy()
  })

  it('leaves the score blank when the lookup fails, without emptying the loans table', async () => {
    mockUseMyMembership.mockReturnValue({ isTreasurer: true, isChairperson: false, member: null, loading: false })
    mockGetLoans.mockResolvedValue([loan])
    mockGetCreditScores.mockRejectedValue(new Error('offline'))
    renderPage()

    await waitFor(() => expect(screen.getByText('Jane Doe')).toBeTruthy())
    expect(screen.getByText('\u2014')).toBeTruthy()
  })

  it("does not show a credit score column to a plain member", async () => {
    mockUseMyMembership.mockReturnValue({ isTreasurer: false, isChairperson: false, member: { id: 5 }, loading: false })
    mockGetMyLoans.mockResolvedValue([loan])
    renderPage()

    await waitFor(() => expect(screen.getByText('View Schedule')).toBeTruthy())
    expect(mockGetCreditScores).not.toHaveBeenCalled()
    expect(screen.queryByText('Credit Score')).toBeNull()
  })

  it("lists only the caller's own loans for a plain member", async () => {
    mockUseMyMembership.mockReturnValue({ isTreasurer: false, isChairperson: false, member: { id: 5, phone: '+254700000000' }, loading: false })
    mockGetMyLoans.mockResolvedValue([loan])
    renderPage()

    await waitFor(() => expect(screen.getByText('My Loans')).toBeTruthy())
    expect(mockGetLoans).not.toHaveBeenCalled()
    expect(screen.queryByText('Jane Doe')).toBeNull()
  })

  it('shows an empty state when there are no loans', async () => {
    mockUseMyMembership.mockReturnValue({ isTreasurer: true, isChairperson: false, member: null, loading: false })
    mockGetLoans.mockResolvedValue([])
    renderPage()

    await waitFor(() => expect(screen.getByText(/no loans yet/i)).toBeTruthy())
  })

  it('lets a manager request a loan on behalf of a member', async () => {
    mockUseMyMembership.mockReturnValue({ isTreasurer: true, isChairperson: false, member: null, loading: false })
    mockGetLoans.mockResolvedValue([])
    mockCreateLoan.mockResolvedValue({ ...loan, id: 2 })
    renderPage()

    await waitFor(() => expect(screen.getByText(/no loans yet/i)).toBeTruthy())
    fireEvent.click(screen.getByText('+ Request Loan'))
    selectOption(/member/i, 'Jane Doe')
    fireEvent.change(screen.getByLabelText(/principal/i), { target: { value: '10000' } })
    fireEvent.change(screen.getByLabelText(/interest rate/i), { target: { value: '12' } })
    fireEvent.change(screen.getByLabelText(/term/i), { target: { value: '6' } })
    fireEvent.click(screen.getByText('Request Loan', { selector: 'button[type="submit"]' }))

    await waitFor(() => expect(mockCreateLoan).toHaveBeenCalled())
    expect(mockCreateLoan.mock.calls[0]).toEqual([3, {
      memberId: 5,
      principal: 10000,
      interestRate: 12,
      interestMethod: 'FLAT',
      termMonths: 6,
    }])
  })

  it('lets a plain member request a loan for themselves without a member picker', async () => {
    mockUseMyMembership.mockReturnValue({ isTreasurer: false, isChairperson: false, member: { id: 5, phone: '+254700000000' }, loading: false })
    mockGetMyLoans.mockResolvedValue([])
    mockCreateLoan.mockResolvedValue({ ...loan, id: 2 })
    renderPage()

    await waitFor(() => expect(screen.getByText(/no loans yet/i)).toBeTruthy())
    fireEvent.click(screen.getByText('+ Request Loan'))
    expect(screen.queryByLabelText(/^member/i)).toBeNull()
    fireEvent.change(screen.getByLabelText(/principal/i), { target: { value: '5000' } })
    fireEvent.change(screen.getByLabelText(/interest rate/i), { target: { value: '10' } })
    fireEvent.change(screen.getByLabelText(/term/i), { target: { value: '3' } })
    fireEvent.click(screen.getByText('Request Loan', { selector: 'button[type="submit"]' }))

    await waitFor(() => expect(mockCreateLoan).toHaveBeenCalled())
    expect(mockCreateLoan.mock.calls[0][1]).toMatchObject({ memberId: 5 })
  })

  it('shows the backend error message when requesting a loan fails', async () => {
    mockUseMyMembership.mockReturnValue({ isTreasurer: true, isChairperson: false, member: null, loading: false })
    mockGetLoans.mockResolvedValue([])
    mockCreateLoan.mockRejectedValue(new Error('principal exceeds chama limit'))
    renderPage()

    await waitFor(() => expect(screen.getByText(/no loans yet/i)).toBeTruthy())
    fireEvent.click(screen.getByText('+ Request Loan'))
    selectOption(/member/i, 'Jane Doe')
    fireEvent.change(screen.getByLabelText(/principal/i), { target: { value: '10000' } })
    fireEvent.change(screen.getByLabelText(/interest rate/i), { target: { value: '12' } })
    fireEvent.change(screen.getByLabelText(/term/i), { target: { value: '6' } })
    fireEvent.click(screen.getByText('Request Loan', { selector: 'button[type="submit"]' }))

    await waitFor(() => expect(screen.getByText('principal exceeds chama limit')).toBeTruthy())
  })

  it('opens the repayment schedule and records a payment against an installment', async () => {
    mockUseMyMembership.mockReturnValue({ isTreasurer: true, isChairperson: false, member: null, loading: false })
    mockGetLoans.mockResolvedValue([loan])
    mockGetLoanRepayments.mockResolvedValue([repayment])
    mockRecordLoanRepayment.mockResolvedValue({ ...repayment, amountPaid: 1766.67, status: 'PAID' })
    renderPage()

    await waitFor(() => expect(screen.getByText('Jane Doe')).toBeTruthy())
    fireEvent.click(screen.getByText('View Schedule'))
    await waitFor(() => expect(screen.getByText('Record Payment')).toBeTruthy())

    fireEvent.click(screen.getByText('Record Payment'))
    fireEvent.change(screen.getByLabelText(/amount/i), { target: { value: '1766.67' } })
    fireEvent.click(screen.getByText('Record Payment', { selector: 'button[type="submit"]' }))

    await waitFor(() => expect(mockRecordLoanRepayment).toHaveBeenCalledWith(3, 1, 10, 1766.67))
  })

  it('lets a manager approve a requested loan', async () => {
    mockUseMyMembership.mockReturnValue({ isTreasurer: true, isChairperson: false, member: null, loading: false })
    mockGetLoans.mockResolvedValue([loan])
    mockApproveLoan.mockResolvedValue({ ...loan, status: 'APPROVED' })
    renderPage()

    await waitFor(() => expect(screen.getByText('Jane Doe')).toBeTruthy())
    fireEvent.click(screen.getByText('Approve'))

    await waitFor(() => expect(mockApproveLoan).toHaveBeenCalledWith(3, 1))
    await waitFor(() => expect(screen.getByText(/approved/i)).toBeTruthy())
  })

  it('lets a manager reject a requested loan', async () => {
    mockUseMyMembership.mockReturnValue({ isTreasurer: true, isChairperson: false, member: null, loading: false })
    mockGetLoans.mockResolvedValue([loan])
    mockRejectLoan.mockResolvedValue({ ...loan, status: 'REJECTED' })
    renderPage()

    await waitFor(() => expect(screen.getByText('Jane Doe')).toBeTruthy())
    fireEvent.click(screen.getByText('Reject'))

    await waitFor(() => expect(mockRejectLoan).toHaveBeenCalledWith(3, 1))
    await waitFor(() => expect(screen.getByText(/rejected/i)).toBeTruthy())
  })

  it('does not offer Approve/Reject actions once a loan is past REQUESTED', async () => {
    mockUseMyMembership.mockReturnValue({ isTreasurer: true, isChairperson: false, member: null, loading: false })
    mockGetLoans.mockResolvedValue([{ ...loan, status: 'APPROVED' }])
    renderPage()

    await waitFor(() => expect(screen.getByText('Jane Doe')).toBeTruthy())
    expect(screen.queryByText('Approve')).toBeNull()
    expect(screen.queryByText('Reject')).toBeNull()
  })

  it('does not offer Approve/Reject to a plain member', async () => {
    mockUseMyMembership.mockReturnValue({ isTreasurer: false, isChairperson: false, member: { id: 5 }, loading: false })
    mockGetMyLoans.mockResolvedValue([loan])
    renderPage()

    await waitFor(() => expect(screen.getByText('View Schedule')).toBeTruthy())
    expect(screen.queryByText('Approve')).toBeNull()
    expect(screen.queryByText('Reject')).toBeNull()
  })

  it("does not offer Record Payment to a plain member viewing their own schedule", async () => {
    mockUseMyMembership.mockReturnValue({ isTreasurer: false, isChairperson: false, member: { id: 5 }, loading: false })
    mockGetMyLoans.mockResolvedValue([loan])
    mockGetLoanRepayments.mockResolvedValue([repayment])
    renderPage()

    await waitFor(() => expect(screen.getByText('View Schedule')).toBeTruthy())
    fireEvent.click(screen.getByText('View Schedule'))
    await waitFor(() => expect(mockGetLoanRepayments).toHaveBeenCalledWith(3, 1))
    expect(screen.queryByText('Record Payment')).toBeNull()
  })

  it('offers disbursement only on an approved loan', async () => {
    asManager()
    mockGetLoans.mockResolvedValue([
      aLoan({ id: 1, status: 'REQUESTED' }),
      aLoan({ id: 2, status: 'APPROVED' }),
      aLoan({ id: 3, status: 'DISBURSED' }),
    ])
    renderPage()

    await screen.findByText('APPROVED')
    expect(screen.getAllByRole('button', { name: 'Disburse' })).toHaveLength(1)
  })

  it('hides disbursement from a plain member', async () => {
    asMember()
    mockGetMyLoans.mockResolvedValue([aLoan({ status: 'APPROVED' })])
    renderPage()

    await screen.findByText('APPROVED')
    expect(screen.queryByRole('button', { name: 'Disburse' })).toBeNull()
  })

  it('disburses an approved loan after confirmation', async () => {
    asManager()
    mockGetLoans.mockResolvedValue([aLoan({ id: 2, status: 'APPROVED', principal: 10000 })])
    mockDisburseLoan.mockResolvedValue({ id: 1, loanId: 2, status: 'COMPLETED' })
    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: 'Disburse' }))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Disburse' }))

    await waitFor(() => expect(mockDisburseLoan).toHaveBeenCalledWith(3, 2))
  })

  it('warns that a large payout needs a second sign-off before it is attempted', async () => {
    asManager()
    // Above the chama's 50000 threshold.
    mockGetLoans.mockResolvedValue([aLoan({ id: 2, status: 'APPROVED', principal: 90000 })])
    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: 'Disburse' }))
    expect(screen.getByRole('dialog')).toHaveTextContent(/second sign-off/i)
  })

  it('does not warn about sign-off for an amount under the threshold', async () => {
    asManager()
    mockGetLoans.mockResolvedValue([aLoan({ id: 2, status: 'APPROVED', principal: 1000 })])
    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: 'Disburse' }))
    const dialog = screen.getByRole('dialog')
    expect(dialog).not.toHaveTextContent(/second sign-off/i)
    expect(dialog).toHaveTextContent(/moves real money/i)
  })

  it('still allows disbursement when the threshold could not be read', async () => {
    asManager()
    mockGetChama.mockRejectedValue(new Error('nope'))
    mockGetLoans.mockResolvedValue([aLoan({ id: 2, status: 'APPROVED', principal: 90000 })])
    mockDisburseLoan.mockResolvedValue({ id: 1, loanId: 2, status: 'PENDING' })
    renderPage()

    // The backend enforces the rule regardless, so a failed threshold lookup must not block the
    // list or the action.
    fireEvent.click(await screen.findByRole('button', { name: 'Disburse' }))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Disburse' }))
    await waitFor(() => expect(mockDisburseLoan).toHaveBeenCalledWith(3, 2))
  })

  it('says the payout is still settling when the provider has not confirmed', async () => {
    asManager()
    mockGetLoans.mockResolvedValue([aLoan({ id: 2, status: 'APPROVED' })])
    mockDisburseLoan.mockResolvedValue({ id: 1, loanId: 2, status: 'PENDING' })
    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: 'Disburse' }))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Disburse' }))

    expect(await screen.findByRole('status')).toHaveTextContent(/will settle once the provider confirms/i)
  })

  it('reports a rejected disbursement', async () => {
    asManager()
    mockGetLoans.mockResolvedValue([aLoan({ id: 2, status: 'APPROVED' })])
    mockDisburseLoan.mockRejectedValue(new Error('Dual sign-off approval has not cleared yet'))
    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: 'Disburse' }))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Disburse' }))

    expect(await screen.findByRole('status')).toHaveTextContent(/has not cleared yet/i)
  })

  it('shows a payout already in flight rather than offering to send another', async () => {
    asManager()
    mockGetLoans.mockResolvedValue([aLoan({ id: 2, status: 'DISBURSEMENT_PENDING' })])
    renderPage()

    expect(await screen.findByText(/payout in flight/i)).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Disburse' })).toBeNull()
  })

  it('closes the confirmation without disbursing', async () => {
    asManager()
    mockGetLoans.mockResolvedValue([aLoan({ id: 2, status: 'APPROVED' })])
    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: 'Disburse' }))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /cancel/i }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(mockDisburseLoan).not.toHaveBeenCalled()
  })
})
