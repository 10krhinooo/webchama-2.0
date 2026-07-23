import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import ContributionPaymentResultPage from './ContributionPaymentResultPage'

vi.mock('../../api/contributions', () => ({
  verifyCardPayment: vi.fn(),
}))
vi.mock('../../lib/cardPaymentSession', () => ({
  takePendingCardPayment: vi.fn(),
}))

import { verifyCardPayment } from '../../api/contributions'
import { takePendingCardPayment } from '../../lib/cardPaymentSession'

const mockVerifyCardPayment = verifyCardPayment as ReturnType<typeof vi.fn>
const mockTakePendingCardPayment = takePendingCardPayment as ReturnType<typeof vi.fn>

function renderAt(search: string) {
  return render(
    <MemoryRouter initialEntries={[`/contribution-payment-result${search}`]}>
      <ContributionPaymentResultPage />
    </MemoryRouter>,
  )
}

describe('ContributionPaymentResultPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows a paid confirmation once verification succeeds', async () => {
    mockTakePendingCardPayment.mockReturnValue({ chamaId: 3, contributionId: 4, txRef: 'tx_123' })
    mockVerifyCardPayment.mockResolvedValue(true)

    renderAt('?tx_ref=tx_123&transaction_id=999')

    await waitFor(() => expect(screen.getByText('Payment confirmed')).toBeTruthy())
    expect(mockVerifyCardPayment).toHaveBeenCalledWith(3, 4, 'tx_123', 999)
    expect(screen.getByText('Back to Contributions').closest('a')).toHaveAttribute('href', '/chamas/3/contributions')
  })

  it('shows a not-completed message when verification resolves false', async () => {
    mockTakePendingCardPayment.mockReturnValue({ chamaId: 3, contributionId: 4, txRef: 'tx_123' })
    mockVerifyCardPayment.mockResolvedValue(false)

    renderAt('?tx_ref=tx_123&transaction_id=999')

    await waitFor(() => expect(screen.getByText('Payment not completed')).toBeTruthy())
  })

  it('shows an error message when verification fails', async () => {
    mockTakePendingCardPayment.mockReturnValue({ chamaId: 3, contributionId: 4, txRef: 'tx_123' })
    mockVerifyCardPayment.mockRejectedValue(new Error('provider timeout'))

    renderAt('?tx_ref=tx_123&transaction_id=999')

    await waitFor(() => expect(screen.getByText('provider timeout')).toBeTruthy())
  })

  it('shows an expired-session message when no pending payment matches the tx ref', async () => {
    mockTakePendingCardPayment.mockReturnValue(null)

    renderAt('?tx_ref=tx_123&transaction_id=999')

    await waitFor(() => expect(screen.getByText(/session has expired/i)).toBeTruthy())
    expect(mockVerifyCardPayment).not.toHaveBeenCalled()
  })

  it('shows a missing-reference message when Flutterwave redirect params are absent', async () => {
    renderAt('')

    await waitFor(() => expect(screen.getByText(/missing payment reference/i)).toBeTruthy())
    expect(mockTakePendingCardPayment).not.toHaveBeenCalled()
  })
})
