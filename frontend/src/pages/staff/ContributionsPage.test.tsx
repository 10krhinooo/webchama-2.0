import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import ContributionsPage from './ContributionsPage'

vi.mock('../../api/contributions', () => ({
  getContributions: vi.fn(),
  getMyContributions: vi.fn(),
  createContribution: vi.fn(),
  recordPayment: vi.fn(),
  deleteContribution: vi.fn(),
  payContributionWithMpesa: vi.fn(),
}))
vi.mock('../../api/members', () => ({
  getMembers: vi.fn(),
}))
vi.mock('../../hooks/useMyMembership', () => ({
  useMyMembership: vi.fn(),
}))

import {
  getContributions,
  getMyContributions,
  createContribution,
  recordPayment,
  deleteContribution,
  payContributionWithMpesa,
} from '../../api/contributions'
import { getMembers } from '../../api/members'
import { useMyMembership } from '../../hooks/useMyMembership'

const mockGetContributions = getContributions as ReturnType<typeof vi.fn>
const mockGetMyContributions = getMyContributions as ReturnType<typeof vi.fn>
const mockCreateContribution = createContribution as ReturnType<typeof vi.fn>
const mockRecordPayment = recordPayment as ReturnType<typeof vi.fn>
const mockDeleteContribution = deleteContribution as ReturnType<typeof vi.fn>
const mockPayContributionWithMpesa = payContributionWithMpesa as ReturnType<typeof vi.fn>
const mockGetMembers = getMembers as ReturnType<typeof vi.fn>
const mockUseMyMembership = useMyMembership as ReturnType<typeof vi.fn>

const contribution = {
  id: 1,
  chamaId: 3,
  memberId: 5,
  memberName: 'Jane Doe',
  period: '2026-07-01',
  amountDue: 500,
  amountPaid: 0,
  paymentMethod: null,
  status: 'PENDING' as const,
  paidAt: null,
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/chamas/3/contributions']}>
      <Routes>
        <Route path="/chamas/:chamaId/contributions" element={<ContributionsPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('ContributionsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetMembers.mockResolvedValue([{ id: 5, fullName: 'Jane Doe' }])
  })

  it('shows the member self-service view with no management controls', async () => {
    mockUseMyMembership.mockReturnValue({ isTreasurer: false, isChairperson: false, loading: false })
    mockGetMyContributions.mockResolvedValue([contribution])
    renderPage()

    await waitFor(() => expect(screen.getByText('My Contributions')).toBeTruthy())
    expect(screen.getByText('500')).toBeTruthy()
    expect(screen.queryByText('+ New Contribution')).toBeNull()
    expect(mockGetContributions).not.toHaveBeenCalled()
  })

  it('shows the treasurer management view with full controls', async () => {
    mockUseMyMembership.mockReturnValue({ isTreasurer: true, isChairperson: false, loading: false })
    mockGetContributions.mockResolvedValue([contribution])
    renderPage()

    await waitFor(() => expect(screen.getByText('Contributions')).toBeTruthy())
    expect(screen.getByText('+ New Contribution')).toBeTruthy()
    expect(screen.getByText('Jane Doe')).toBeTruthy()
    expect(screen.getByText('Record Payment')).toBeTruthy()
    expect(mockGetMyContributions).not.toHaveBeenCalled()
  })

  it('creates a new contribution through the modal', async () => {
    mockUseMyMembership.mockReturnValue({ isTreasurer: true, isChairperson: false, loading: false })
    mockGetContributions.mockResolvedValue([contribution])
    mockCreateContribution.mockResolvedValue({ ...contribution, id: 2 })
    renderPage()

    await waitFor(() => expect(screen.getByText('Jane Doe')).toBeTruthy())
    fireEvent.click(screen.getByText('+ New Contribution'))
    fireEvent.change(screen.getByLabelText(/member/i), { target: { value: '5' } })
    fireEvent.change(screen.getByLabelText(/period/i), { target: { value: '2026-08-01' } })
    fireEvent.change(screen.getByLabelText(/amount due/i), { target: { value: '750' } })
    fireEvent.click(screen.getByText('Create Contribution'))

    await waitFor(() => expect(mockCreateContribution).toHaveBeenCalledWith(3, { memberId: 5, period: '2026-08-01', amountDue: 750 }))
  })

  it('records a payment against an existing contribution', async () => {
    mockUseMyMembership.mockReturnValue({ isTreasurer: true, isChairperson: false, loading: false })
    mockGetContributions.mockResolvedValue([contribution])
    mockRecordPayment.mockResolvedValue({ ...contribution, amountPaid: 500, status: 'PAID' })
    renderPage()

    await waitFor(() => expect(screen.getByText('Jane Doe')).toBeTruthy())
    fireEvent.click(screen.getByText('Record Payment'))
    fireEvent.change(screen.getByLabelText(/amount \*/i), { target: { value: '500' } })
    fireEvent.click(screen.getByText('Record Payment', { selector: 'button[type="submit"]' }))

    await waitFor(() => expect(mockRecordPayment).toHaveBeenCalledWith(3, 1, 500, 'MPESA'))
  })

  it('deletes a contribution after confirmation', async () => {
    mockUseMyMembership.mockReturnValue({ isTreasurer: false, isChairperson: true, loading: false })
    mockGetContributions.mockResolvedValue([contribution])
    mockDeleteContribution.mockResolvedValue(undefined)
    renderPage()

    await waitFor(() => expect(screen.getByText('Jane Doe')).toBeTruthy())
    fireEvent.click(screen.getByText('Delete'))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(mockDeleteContribution).toHaveBeenCalledWith(3, 1))
  })

  it('shows an empty state when there are no contributions', async () => {
    mockUseMyMembership.mockReturnValue({ isTreasurer: false, isChairperson: false, loading: false })
    mockGetMyContributions.mockResolvedValue([])
    renderPage()
    await waitFor(() => expect(screen.getByText(/no contributions yet/i)).toBeTruthy())
  })

  it('renders every status badge variant and hides Record Payment once paid', async () => {
    mockUseMyMembership.mockReturnValue({ isTreasurer: true, isChairperson: false, loading: false })
    mockGetContributions.mockResolvedValue([
      { ...contribution, id: 1, status: 'PAID' as const },
      { ...contribution, id: 2, status: 'PARTIAL' as const, memberName: 'Bob' },
      { ...contribution, id: 3, status: 'OVERDUE' as const, memberName: 'Amina' },
    ])
    renderPage()

    await waitFor(() => expect(screen.getByText('PAID')).toBeTruthy())
    expect(screen.getByText('PARTIAL')).toBeTruthy()
    expect(screen.getByText('OVERDUE')).toBeTruthy()
    expect(screen.getAllByText('Record Payment')).toHaveLength(2)
  })

  it('shows a skeleton and skips fetching while the role lookup is still loading', async () => {
    mockUseMyMembership.mockReturnValue({ isTreasurer: false, isChairperson: false, loading: true })
    renderPage()
    expect(mockGetContributions).not.toHaveBeenCalled()
    expect(mockGetMyContributions).not.toHaveBeenCalled()
  })

  it('shows the backend error message when creating a contribution fails', async () => {
    mockUseMyMembership.mockReturnValue({ isTreasurer: true, isChairperson: false, loading: false })
    mockGetContributions.mockResolvedValue([contribution])
    mockCreateContribution.mockRejectedValue(new Error('member already has a contribution for this period'))
    renderPage()

    await waitFor(() => expect(screen.getByText('Jane Doe')).toBeTruthy())
    fireEvent.click(screen.getByText('+ New Contribution'))
    fireEvent.change(screen.getByLabelText(/member/i), { target: { value: '5' } })
    fireEvent.change(screen.getByLabelText(/period/i), { target: { value: '2026-08-01' } })
    fireEvent.change(screen.getByLabelText(/amount due/i), { target: { value: '750' } })
    fireEvent.click(screen.getByText('Create Contribution'))

    await waitFor(() => expect(screen.getByText('member already has a contribution for this period')).toBeTruthy())
  })

  it('shows the backend error message when recording a payment fails', async () => {
    mockUseMyMembership.mockReturnValue({ isTreasurer: true, isChairperson: false, loading: false })
    mockGetContributions.mockResolvedValue([contribution])
    mockRecordPayment.mockRejectedValue(new Error('amount exceeds balance'))
    renderPage()

    await waitFor(() => expect(screen.getByText('Jane Doe')).toBeTruthy())
    fireEvent.click(screen.getByText('Record Payment'))
    fireEvent.change(screen.getByLabelText(/amount \*/i), { target: { value: '99999' } })
    fireEvent.change(screen.getByLabelText(/method/i), { target: { value: 'CASH' } })
    fireEvent.click(screen.getByText('Record Payment', { selector: 'button[type="submit"]' }))

    await waitFor(() => expect(screen.getByText('amount exceeds balance')).toBeTruthy())
    expect(mockRecordPayment).toHaveBeenCalledWith(3, 1, 99999, 'CASH')
  })

  it('shows an error notice when deletion fails', async () => {
    mockUseMyMembership.mockReturnValue({ isTreasurer: true, isChairperson: false, loading: false })
    mockGetContributions.mockResolvedValue([contribution])
    mockDeleteContribution.mockRejectedValue(new Error('cannot delete a paid contribution'))
    renderPage()

    await waitFor(() => expect(screen.getByText('Jane Doe')).toBeTruthy())
    fireEvent.click(screen.getByText('Delete'))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(screen.getByText('cannot delete a paid contribution')).toBeTruthy())
  })

  it('does not delete when the confirmation is dismissed', async () => {
    mockUseMyMembership.mockReturnValue({ isTreasurer: true, isChairperson: false, loading: false })
    mockGetContributions.mockResolvedValue([contribution])
    renderPage()

    await waitFor(() => expect(screen.getByText('Jane Doe')).toBeTruthy())
    fireEvent.click(screen.getByText('Delete'))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' }))
    expect(mockDeleteContribution).not.toHaveBeenCalled()
  })

  it('shows the M-Pesa confirmation modal with amount and phone before sending a push', async () => {
    mockUseMyMembership.mockReturnValue({
      isTreasurer: false,
      isChairperson: false,
      member: { phone: '254700000002' },
      loading: false,
    })
    mockGetMyContributions.mockResolvedValue([{ ...contribution, amountDue: 500, amountPaid: 200 }])
    renderPage()

    await waitFor(() => expect(screen.getByText('Pay via M-Pesa')).toBeTruthy())
    fireEvent.click(screen.getByText('Pay via M-Pesa'))

    expect(screen.getByText('Confirm M-Pesa Payment')).toBeTruthy()
    expect(screen.getByText('KES 300')).toBeTruthy()
    expect(screen.getByText('To 254700000002')).toBeTruthy()
    expect(mockPayContributionWithMpesa).not.toHaveBeenCalled()
  })

  it('sends the STK push only after the member confirms', async () => {
    mockUseMyMembership.mockReturnValue({
      isTreasurer: false,
      isChairperson: false,
      member: { phone: '254700000002' },
      loading: false,
    })
    mockGetMyContributions.mockResolvedValue([contribution])
    mockPayContributionWithMpesa.mockResolvedValue({ ...contribution, status: 'PENDING' })
    renderPage()

    await waitFor(() => expect(screen.getByText('Pay via M-Pesa')).toBeTruthy())
    fireEvent.click(screen.getByText('Pay via M-Pesa'))
    fireEvent.click(screen.getByText('Send Prompt'))

    await waitFor(() => expect(mockPayContributionWithMpesa).toHaveBeenCalledWith(3, 1))
    await waitFor(() => expect(screen.getByText(/check your phone/i)).toBeTruthy())
  })

  it('does not send a push when the M-Pesa confirmation is cancelled', async () => {
    mockUseMyMembership.mockReturnValue({
      isTreasurer: false,
      isChairperson: false,
      member: { phone: '254700000002' },
      loading: false,
    })
    mockGetMyContributions.mockResolvedValue([contribution])
    renderPage()

    await waitFor(() => expect(screen.getByText('Pay via M-Pesa')).toBeTruthy())
    fireEvent.click(screen.getByText('Pay via M-Pesa'))
    fireEvent.click(screen.getByText('Cancel'))

    expect(screen.queryByText('Confirm M-Pesa Payment')).toBeNull()
    expect(mockPayContributionWithMpesa).not.toHaveBeenCalled()
  })

  it('shows the backend error message when the STK push fails', async () => {
    mockUseMyMembership.mockReturnValue({
      isTreasurer: false,
      isChairperson: false,
      member: { phone: '254700000002' },
      loading: false,
    })
    mockGetMyContributions.mockResolvedValue([contribution])
    mockPayContributionWithMpesa.mockRejectedValue(new Error('A payment is already in progress for this number.'))
    renderPage()

    await waitFor(() => expect(screen.getByText('Pay via M-Pesa')).toBeTruthy())
    fireEvent.click(screen.getByText('Pay via M-Pesa'))
    fireEvent.click(screen.getByText('Send Prompt'))

    await waitFor(() => expect(screen.getByText('A payment is already in progress for this number.')).toBeTruthy())
  })

  it('does not show a pay button once a contribution is fully paid', async () => {
    mockUseMyMembership.mockReturnValue({
      isTreasurer: false,
      isChairperson: false,
      member: { phone: '254700000002' },
      loading: false,
    })
    mockGetMyContributions.mockResolvedValue([{ ...contribution, status: 'PAID' as const, amountPaid: 500 }])
    renderPage()

    await waitFor(() => expect(screen.getByText('PAID')).toBeTruthy())
    expect(screen.queryByText('Pay via M-Pesa')).toBeNull()
  })
})
