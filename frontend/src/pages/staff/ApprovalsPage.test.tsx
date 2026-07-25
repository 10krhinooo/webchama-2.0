import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import ApprovalsPage from './ApprovalsPage'

vi.mock('../../api/approvals', () => ({
  getApprovals: vi.fn(),
  requestApproval: vi.fn(),
  approveApproval: vi.fn(),
  rejectApproval: vi.fn(),
}))
vi.mock('../../api/members', () => ({
  getMembers: vi.fn(),
}))
vi.mock('../../api/loans', () => ({
  getLoans: vi.fn(),
}))
vi.mock('../../api/payouts', () => ({
  getPayouts: vi.fn(),
}))
vi.mock('../../hooks/useMyMembership', () => ({
  useMyMembership: vi.fn(),
}))

import { getApprovals, requestApproval, approveApproval, rejectApproval } from '../../api/approvals'
import { getMembers } from '../../api/members'
import { getLoans } from '../../api/loans'
import { getPayouts } from '../../api/payouts'
import { useMyMembership } from '../../hooks/useMyMembership'

const mockGetApprovals = getApprovals as ReturnType<typeof vi.fn>
const mockRequestApproval = requestApproval as ReturnType<typeof vi.fn>
const mockApproveApproval = approveApproval as ReturnType<typeof vi.fn>
const mockRejectApproval = rejectApproval as ReturnType<typeof vi.fn>
const mockGetMembers = getMembers as ReturnType<typeof vi.fn>
const mockGetLoans = getLoans as ReturnType<typeof vi.fn>
const mockGetPayouts = getPayouts as ReturnType<typeof vi.fn>
const mockUseMyMembership = useMyMembership as ReturnType<typeof vi.fn>

const pendingApproval = {
  id: 1,
  chamaId: 3,
  targetType: 'LOAN_DISBURSEMENT' as const,
  targetId: 9,
  memberId: 5,
  memberName: 'Jane Doe',
  amount: 150000,
  reason: 'School fees emergency',
  status: 'PENDING' as const,
  requestedByMemberId: 6,
  requestedByName: 'Treasurer One',
  requestedAt: '2026-07-01T00:00:00Z',
  firstApproverMemberId: null,
  firstApproverName: null,
  firstApprovedAt: null,
  secondApproverMemberId: null,
  secondApproverName: null,
  secondApprovedAt: null,
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/chamas/3/approvals']}>
      <Routes>
        <Route path="/chamas/:chamaId/approvals" element={<ApprovalsPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('ApprovalsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetMembers.mockResolvedValue([{ id: 5, fullName: 'Jane Doe' }])
    mockGetLoans.mockResolvedValue([{ id: 9, memberName: 'Jane Doe', principal: 150000 }])
    mockGetPayouts.mockResolvedValue([])
    mockUseMyMembership.mockReturnValue({ member: { id: 6 }, loading: false })
  })

  it('lists pending approvals showing amount, member, and reason', async () => {
    mockGetApprovals.mockResolvedValue([pendingApproval])
    renderPage()

    await waitFor(() => expect(screen.getByText('Jane Doe')).toBeTruthy())
    expect(screen.getByText('150,000')).toBeTruthy()
    expect(screen.getByText('School fees emergency')).toBeTruthy()
    expect(screen.getByText('Loan disbursement')).toBeTruthy()
    expect(screen.getByText('Pending')).toBeTruthy()
  })

  it('shows an empty state when there are no approval requests', async () => {
    mockGetApprovals.mockResolvedValue([])
    renderPage()

    await waitFor(() => expect(screen.getByText(/no approval requests yet/i)).toBeTruthy())
  })

  it('lets a manager open a new approval request', async () => {
    mockGetApprovals.mockResolvedValue([])
    mockRequestApproval.mockResolvedValue({ ...pendingApproval, id: 2 })
    renderPage()

    await waitFor(() => expect(screen.getByText(/no approval requests yet/i)).toBeTruthy())
    fireEvent.click(screen.getByText('+ Request Approval'))
    fireEvent.change(screen.getByLabelText(/^loan\b/i), { target: { value: '9' } })
    fireEvent.change(screen.getByLabelText(/member/i), { target: { value: '5' } })
    fireEvent.change(screen.getByLabelText(/amount/i), { target: { value: '150000' } })
    fireEvent.click(screen.getByText('Request Approval', { selector: 'button[type="submit"]' }))

    await waitFor(() => expect(mockRequestApproval).toHaveBeenCalledWith(3, {
      targetType: 'LOAN_DISBURSEMENT',
      targetId: 9,
      memberId: 5,
      amount: 150000,
      reason: undefined,
    }))
  })

  it('switches to a payout select when the type is changed to payout disbursement', async () => {
    mockGetApprovals.mockResolvedValue([])
    mockGetPayouts.mockResolvedValue([{ id: 4, memberName: 'Jane Doe', roundNumber: 2 }])
    mockRequestApproval.mockResolvedValue({ ...pendingApproval, id: 3, targetType: 'PAYOUT_DISBURSEMENT' })
    renderPage()

    await waitFor(() => expect(screen.getByText(/no approval requests yet/i)).toBeTruthy())
    fireEvent.click(screen.getByText('+ Request Approval'))
    fireEvent.change(screen.getByLabelText(/type/i), { target: { value: 'PAYOUT_DISBURSEMENT' } })
    fireEvent.change(screen.getByLabelText(/^payout\b/i), { target: { value: '4' } })
    fireEvent.change(screen.getByLabelText(/member/i), { target: { value: '5' } })
    fireEvent.change(screen.getByLabelText(/amount/i), { target: { value: '10000' } })
    fireEvent.click(screen.getByText('Request Approval', { selector: 'button[type="submit"]' }))

    await waitFor(() => expect(mockRequestApproval).toHaveBeenCalledWith(3, {
      targetType: 'PAYOUT_DISBURSEMENT',
      targetId: 4,
      memberId: 5,
      amount: 10000,
      reason: undefined,
    }))
  })

  it('shows the backend error message when requesting approval fails', async () => {
    mockGetApprovals.mockResolvedValue([])
    mockRequestApproval.mockRejectedValue(new Error('An approval request is already pending for this item'))
    renderPage()

    await waitFor(() => expect(screen.getByText(/no approval requests yet/i)).toBeTruthy())
    fireEvent.click(screen.getByText('+ Request Approval'))
    fireEvent.change(screen.getByLabelText(/^loan\b/i), { target: { value: '9' } })
    fireEvent.change(screen.getByLabelText(/member/i), { target: { value: '5' } })
    fireEvent.change(screen.getByLabelText(/amount/i), { target: { value: '150000' } })
    fireEvent.click(screen.getByText('Request Approval', { selector: 'button[type="submit"]' }))

    await waitFor(() => expect(screen.getByText('An approval request is already pending for this item')).toBeTruthy())
  })

  it('lets a signatory sign off a pending approval', async () => {
    mockGetApprovals.mockResolvedValue([pendingApproval])
    mockApproveApproval.mockResolvedValue({ ...pendingApproval, firstApproverMemberId: 6, firstApproverName: 'Treasurer One' })
    renderPage()

    await waitFor(() => expect(screen.getByText('Jane Doe')).toBeTruthy())
    fireEvent.click(screen.getByText('Sign off'))

    await waitFor(() => expect(mockApproveApproval).toHaveBeenCalledWith(3, 1))
  })

  it('disables signing off for the signatory who already signed', async () => {
    mockGetApprovals.mockResolvedValue([{ ...pendingApproval, firstApproverMemberId: 6, firstApproverName: 'Treasurer One' }])
    renderPage()

    await waitFor(() => expect(screen.getByText('Jane Doe')).toBeTruthy())
    expect(screen.getByText('Sign off')).toHaveProperty('disabled', true)
  })

  it('lets a signatory reject a pending approval', async () => {
    mockGetApprovals.mockResolvedValue([pendingApproval])
    mockRejectApproval.mockResolvedValue({ ...pendingApproval, status: 'REJECTED' })
    renderPage()

    await waitFor(() => expect(screen.getByText('Jane Doe')).toBeTruthy())
    fireEvent.click(screen.getByText('Reject'))

    await waitFor(() => expect(mockRejectApproval).toHaveBeenCalledWith(3, 1))
  })

  it('does not offer sign-off/reject actions once a request is no longer pending', async () => {
    mockGetApprovals.mockResolvedValue([{ ...pendingApproval, status: 'APPROVED' }])
    renderPage()

    await waitFor(() => expect(screen.getByText('Jane Doe')).toBeTruthy())
    expect(screen.queryByText('Sign off')).toBeNull()
    expect(screen.queryByText('Reject')).toBeNull()
  })
})
