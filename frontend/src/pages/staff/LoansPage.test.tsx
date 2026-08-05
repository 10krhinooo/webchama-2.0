import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
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
}))
vi.mock('../../api/members', () => ({
  getMembers: vi.fn(),
  getCreditScore: vi.fn(),
}))
vi.mock('../../hooks/useMyMembership', () => ({
  useMyMembership: vi.fn(),
}))

import { getLoans, getMyLoans, createLoan, approveLoan, rejectLoan, getLoanRepayments, recordLoanRepayment } from '../../api/loans'
import { getMembers, getCreditScore } from '../../api/members'
import { useMyMembership } from '../../hooks/useMyMembership'

const mockGetLoans = getLoans as ReturnType<typeof vi.fn>
const mockGetMyLoans = getMyLoans as ReturnType<typeof vi.fn>
const mockCreateLoan = createLoan as ReturnType<typeof vi.fn>
const mockApproveLoan = approveLoan as ReturnType<typeof vi.fn>
const mockRejectLoan = rejectLoan as ReturnType<typeof vi.fn>
const mockGetLoanRepayments = getLoanRepayments as ReturnType<typeof vi.fn>
const mockRecordLoanRepayment = recordLoanRepayment as ReturnType<typeof vi.fn>
const mockGetMembers = getMembers as ReturnType<typeof vi.fn>
const mockGetCreditScore = getCreditScore as ReturnType<typeof vi.fn>
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

const repayment = {
  id: 10,
  loanId: 1,
  installmentNumber: 1,
  scheduledDate: '2026-08-01',
  amountDue: 1766.67,
  amountPaid: 0,
  status: 'PENDING' as const,
}

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
    mockGetCreditScore.mockResolvedValue({ memberId: 5, score: 82 })
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

    await waitFor(() => expect(mockGetCreditScore).toHaveBeenCalledWith(3, 5))
    await waitFor(() => expect(screen.getByText('82')).toBeTruthy())
  })

  it("does not show a credit score column to a plain member", async () => {
    mockUseMyMembership.mockReturnValue({ isTreasurer: false, isChairperson: false, member: { id: 5 }, loading: false })
    mockGetMyLoans.mockResolvedValue([loan])
    renderPage()

    await waitFor(() => expect(screen.getByText('View Schedule')).toBeTruthy())
    expect(mockGetCreditScore).not.toHaveBeenCalled()
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
})
