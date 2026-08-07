import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import ContributionsPage from './ContributionsPage'
import { selectOption } from '../../test-utils/selectOption'

vi.mock('../../api/contributions', () => ({
  getContributions: vi.fn(),
  getMyContributions: vi.fn(),
  getMyContributionStreak: vi.fn(),
  createContribution: vi.fn(),
  recordPayment: vi.fn(),
  deleteContribution: vi.fn(),
  payContributionWithMpesa: vi.fn(),
  initiateCardPayment: vi.fn(),
  getPayments: vi.fn(),
  getMyPayments: vi.fn(),
}))
vi.mock('../../api/members', () => ({
  getMembers: vi.fn(),
  updateMyAutoPay: vi.fn(),
  exportMyData: vi.fn(),
}))
vi.mock('../../hooks/useMyMembership', () => ({
  useMyMembership: vi.fn(),
}))
vi.mock('../../lib/cardPaymentSession', () => ({
  savePendingCardPayment: vi.fn(),
}))

import {
  getContributions,
  getMyContributions,
  getMyContributionStreak,
  createContribution,
  recordPayment,
  deleteContribution,
  payContributionWithMpesa,
  initiateCardPayment,
  getPayments,
  getMyPayments,
} from '../../api/contributions'
import { getMembers, updateMyAutoPay, exportMyData } from '../../api/members'
import { useMyMembership } from '../../hooks/useMyMembership'
import { savePendingCardPayment } from '../../lib/cardPaymentSession'

const mockGetContributions = getContributions as ReturnType<typeof vi.fn>
const mockGetMyContributions = getMyContributions as ReturnType<typeof vi.fn>
const mockGetMyContributionStreak = getMyContributionStreak as ReturnType<typeof vi.fn>
const mockCreateContribution = createContribution as ReturnType<typeof vi.fn>
const mockRecordPayment = recordPayment as ReturnType<typeof vi.fn>
const mockDeleteContribution = deleteContribution as ReturnType<typeof vi.fn>
const mockPayContributionWithMpesa = payContributionWithMpesa as ReturnType<typeof vi.fn>
const mockInitiateCardPayment = initiateCardPayment as ReturnType<typeof vi.fn>
const mockGetPayments = getPayments as ReturnType<typeof vi.fn>
const mockGetMyPayments = getMyPayments as ReturnType<typeof vi.fn>
const mockGetMembers = getMembers as ReturnType<typeof vi.fn>
const mockUpdateMyAutoPay = updateMyAutoPay as ReturnType<typeof vi.fn>
const mockExportMyData = exportMyData as ReturnType<typeof vi.fn>
const mockUseMyMembership = useMyMembership as ReturnType<typeof vi.fn>
const mockSavePendingCardPayment = savePendingCardPayment as ReturnType<typeof vi.fn>

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
    mockGetMyContributionStreak.mockResolvedValue(0)
    mockGetPayments.mockResolvedValue([])
    mockGetMyPayments.mockResolvedValue([])
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

  it('does not show the auto-pay toggle for a treasurer managing contributions', async () => {
    mockUseMyMembership.mockReturnValue({ isTreasurer: true, isChairperson: false, loading: false })
    mockGetContributions.mockResolvedValue([contribution])
    renderPage()

    await waitFor(() => expect(screen.getByText('Contributions')).toBeTruthy())
    expect(screen.queryByLabelText('Auto-pay via M-Pesa')).toBeNull()
    expect(mockGetMyContributionStreak).not.toHaveBeenCalled()
  })

  it('does not show a streak badge when the streak is zero', async () => {
    mockUseMyMembership.mockReturnValue({ isTreasurer: false, isChairperson: false, loading: false })
    mockGetMyContributions.mockResolvedValue([contribution])
    mockGetMyContributionStreak.mockResolvedValue(0)
    renderPage()

    await waitFor(() => expect(screen.getByText('My Contributions')).toBeTruthy())
    expect(screen.queryByTestId('contribution-streak')).toBeNull()
  })

  it('shows the on-time streak badge for a member with a positive streak', async () => {
    mockUseMyMembership.mockReturnValue({ isTreasurer: false, isChairperson: false, loading: false })
    mockGetMyContributions.mockResolvedValue([contribution])
    mockGetMyContributionStreak.mockResolvedValue(3)
    renderPage()

    await waitFor(() => expect(screen.getByTestId('contribution-streak')).toBeTruthy())
    expect(screen.getByTestId('contribution-streak').textContent).toContain('3')
  })

  it('shows the auto-pay toggle reflecting the member current opt-in state', async () => {
    mockUseMyMembership.mockReturnValue({
      isTreasurer: false,
      isChairperson: false,
      loading: false,
      member: { phone: '254700000002', autoPayEnabled: true },
    })
    mockGetMyContributions.mockResolvedValue([contribution])
    renderPage()

    await waitFor(() => expect(screen.getByLabelText('Auto-pay via M-Pesa')).toBeTruthy())
    expect(screen.getByLabelText('Auto-pay via M-Pesa')).toBeChecked()
  })

  it('toggles auto-pay on and shows a confirmation message', async () => {
    mockUseMyMembership.mockReturnValue({
      isTreasurer: false,
      isChairperson: false,
      loading: false,
      member: { phone: '254700000002', autoPayEnabled: false },
    })
    mockGetMyContributions.mockResolvedValue([contribution])
    mockUpdateMyAutoPay.mockResolvedValue({ id: 5, autoPayEnabled: true })
    renderPage()

    const toggle = await screen.findByLabelText('Auto-pay via M-Pesa')
    expect(toggle).not.toBeChecked()
    fireEvent.click(toggle)

    await waitFor(() => expect(mockUpdateMyAutoPay).toHaveBeenCalledWith(3, true))
    await waitFor(() => expect(toggle).toBeChecked())
    expect(screen.getByText(/Auto-pay enabled/)).toBeTruthy()
  })

  it('shows an error notice when toggling auto-pay fails', async () => {
    mockUseMyMembership.mockReturnValue({
      isTreasurer: false,
      isChairperson: false,
      loading: false,
      member: { phone: '254700000002', autoPayEnabled: false },
    })
    mockGetMyContributions.mockResolvedValue([contribution])
    mockUpdateMyAutoPay.mockRejectedValue(new Error('Could not save preference'))
    renderPage()

    const toggle = await screen.findByLabelText('Auto-pay via M-Pesa')
    fireEvent.click(toggle)

    await waitFor(() => expect(screen.getByText('Could not save preference')).toBeTruthy())
    expect(toggle).not.toBeChecked()
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

  it('shows a dash in the payment column when a contribution has no payment attempts', async () => {
    mockUseMyMembership.mockReturnValue({ isTreasurer: true, isChairperson: false, loading: false })
    mockGetContributions.mockResolvedValue([contribution])
    renderPage()

    await waitFor(() => expect(screen.getByText('Jane Doe')).toBeTruthy())
    expect(screen.getByText('—')).toBeTruthy()
  })

  it('shows the latest payment attempt badge for a contribution, most recent first', async () => {
    mockUseMyMembership.mockReturnValue({ isTreasurer: true, isChairperson: false, loading: false })
    mockGetContributions.mockResolvedValue([contribution])
    mockGetPayments.mockResolvedValue([
      {
        id: 1,
        chamaId: 3,
        memberId: 5,
        contributionId: 1,
        welfareContributionId: null,
        purpose: 'CONTRIBUTION',
        amount: 500,
        method: 'MPESA',
        status: 'FAILED',
        providerReference: 'ref-1',
        mpesaReceiptNumber: null,
        paidAt: null,
        createdAt: '2026-07-01T10:00:00Z',
      },
      {
        id: 2,
        chamaId: 3,
        memberId: 5,
        contributionId: 1,
        welfareContributionId: null,
        purpose: 'CONTRIBUTION',
        amount: 500,
        method: 'MPESA',
        status: 'PENDING',
        providerReference: 'ref-2',
        mpesaReceiptNumber: null,
        paidAt: null,
        createdAt: '2026-07-02T10:00:00Z',
      },
    ])
    renderPage()

    await waitFor(() => expect(screen.getByText('Jane Doe')).toBeTruthy())
    expect(screen.getByText('MPESA PENDING')).toBeTruthy()
  })

  it('shows the member self-service payment column from getMyPayments', async () => {
    mockUseMyMembership.mockReturnValue({ isTreasurer: false, isChairperson: false, loading: false })
    mockGetMyContributions.mockResolvedValue([contribution])
    mockGetMyPayments.mockResolvedValue([
      {
        id: 3,
        chamaId: 3,
        memberId: 5,
        contributionId: 1,
        welfareContributionId: null,
        purpose: 'CONTRIBUTION',
        amount: 500,
        method: 'MPESA',
        status: 'SUCCESS',
        providerReference: 'ref-3',
        mpesaReceiptNumber: 'ABC123',
        paidAt: '2026-07-02T10:05:00Z',
        createdAt: '2026-07-02T10:00:00Z',
      },
    ])
    renderPage()

    await waitFor(() => expect(screen.getByText('MPESA SUCCESS')).toBeTruthy())
    expect(mockGetPayments).not.toHaveBeenCalled()
  })

  it('creates a new contribution through the modal', async () => {
    mockUseMyMembership.mockReturnValue({ isTreasurer: true, isChairperson: false, loading: false })
    mockGetContributions.mockResolvedValue([contribution])
    mockCreateContribution.mockResolvedValue({ ...contribution, id: 2 })
    renderPage()

    await waitFor(() => expect(screen.getByText('Jane Doe')).toBeTruthy())
    fireEvent.click(screen.getByText('+ New Contribution'))
    selectOption(/member/i, 'Jane Doe')
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
    selectOption(/member/i, 'Jane Doe')
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
    selectOption(/method/i, 'Cash')
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
    expect(screen.queryByText('Pay by Card')).toBeNull()
  })

  it('exports the member own data as a JSON download when the button is clicked', async () => {
    mockUseMyMembership.mockReturnValue({ isTreasurer: false, isChairperson: false, loading: false })
    mockGetMyContributions.mockResolvedValue([contribution])
    mockExportMyData.mockResolvedValue({ profile: { fullName: 'Jane Doe' } })

    const clickSpy = vi.fn()
    const originalCreateElement = document.createElement.bind(document)
    const createElementSpy = vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = originalCreateElement(tag)
      if (tag === 'a') el.click = clickSpy
      return el
    })
    const createObjectUrlSpy = vi.fn().mockReturnValue('blob:mock')
    const revokeObjectUrlSpy = vi.fn()
    URL.createObjectURL = createObjectUrlSpy
    URL.revokeObjectURL = revokeObjectUrlSpy

    renderPage()

    await waitFor(() => expect(screen.getByText('Export my data')).toBeTruthy())
    fireEvent.click(screen.getByText('Export my data'))

    await waitFor(() => expect(mockExportMyData).toHaveBeenCalledWith(3))
    expect(createObjectUrlSpy).toHaveBeenCalled()
    expect(clickSpy).toHaveBeenCalled()
    expect(revokeObjectUrlSpy).toHaveBeenCalledWith('blob:mock')

    createElementSpy.mockRestore()
  })

  it('shows an error notice when exporting data fails', async () => {
    mockUseMyMembership.mockReturnValue({ isTreasurer: false, isChairperson: false, loading: false })
    mockGetMyContributions.mockResolvedValue([contribution])
    mockExportMyData.mockRejectedValue(new Error('export unavailable'))
    renderPage()

    await waitFor(() => expect(screen.getByText('Export my data')).toBeTruthy())
    fireEvent.click(screen.getByText('Export my data'))

    await waitFor(() => expect(screen.getByText('export unavailable')).toBeTruthy())
  })

  describe('card payment', () => {
    const originalLocation = window.location

    beforeEach(() => {
      Object.defineProperty(window, 'location', {
        writable: true,
        value: { ...originalLocation, href: '' },
      })
    })

    afterEach(() => {
      Object.defineProperty(window, 'location', { writable: true, value: originalLocation })
    })

    it('starts a Flutterwave checkout and redirects to the payment link', async () => {
      mockUseMyMembership.mockReturnValue({
        isTreasurer: false,
        isChairperson: false,
        member: { phone: '254700000002' },
        loading: false,
      })
      mockGetMyContributions.mockResolvedValue([contribution])
      mockInitiateCardPayment.mockResolvedValue({ paymentLink: 'https://checkout.flutterwave.com/abc', txRef: 'tx_123' })
      renderPage()

      await waitFor(() => expect(screen.getByText('Pay by Card')).toBeTruthy())
      fireEvent.click(screen.getByText('Pay by Card'))
      fireEvent.change(screen.getByLabelText(/receipt email/i), { target: { value: 'jane@example.com' } })
      fireEvent.click(screen.getByText('Continue to Checkout'))

      await waitFor(() => expect(mockInitiateCardPayment).toHaveBeenCalledWith(3, 1, 'jane@example.com'))
      expect(mockSavePendingCardPayment).toHaveBeenCalledWith({ chamaId: 3, contributionId: 1, txRef: 'tx_123' })
      expect(window.location.href).toBe('https://checkout.flutterwave.com/abc')
    })

    it('shows the backend error message when starting checkout fails', async () => {
      mockUseMyMembership.mockReturnValue({
        isTreasurer: false,
        isChairperson: false,
        member: { phone: '254700000002' },
        loading: false,
      })
      mockGetMyContributions.mockResolvedValue([contribution])
      mockInitiateCardPayment.mockRejectedValue(new Error('card payments are temporarily unavailable'))
      renderPage()

      await waitFor(() => expect(screen.getByText('Pay by Card')).toBeTruthy())
      fireEvent.click(screen.getByText('Pay by Card'))
      fireEvent.change(screen.getByLabelText(/receipt email/i), { target: { value: 'jane@example.com' } })
      fireEvent.click(screen.getByText('Continue to Checkout'))

      await waitFor(() => expect(screen.getByText('card payments are temporarily unavailable')).toBeTruthy())
      expect(mockSavePendingCardPayment).not.toHaveBeenCalled()
    })
  })
})
