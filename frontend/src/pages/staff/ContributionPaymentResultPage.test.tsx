import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
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

  // The outcome replaces a spinner seconds after the page settles. Without a heading it is not in
  // the page outline, and without a live region a screen-reader user is left on "Confirming your
  // payment..." while the person beside them can already see the answer.
  it('states the outcome as a heading inside a live region', async () => {
    mockTakePendingCardPayment.mockReturnValue({ chamaId: 3, contributionId: 4, txRef: 'tx_123' })
    mockVerifyCardPayment.mockResolvedValue(true)

    renderAt('?tx_ref=tx_123&transaction_id=999')

    const heading = await screen.findByRole('heading', { level: 1 })
    expect(heading).toHaveTextContent('Payment confirmed')
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite')
  })

  it('offers no retry once the payment is confirmed', async () => {
    mockTakePendingCardPayment.mockReturnValue({ chamaId: 3, contributionId: 4, txRef: 'tx_123' })
    mockVerifyCardPayment.mockResolvedValue(true)

    renderAt('?tx_ref=tx_123&transaction_id=999')

    await screen.findByRole('heading', { level: 1 })
    expect(screen.queryByRole('button', { name: 'Check again' })).toBeNull()
  })

  // Failing to *confirm* is not the same as failing to *pay*: the verification call is what broke,
  // and it is worth another try before sending the member off to hunt through their contributions.
  it('re-verifies when the member asks to check again after a failure', async () => {
    mockTakePendingCardPayment.mockReturnValue({ chamaId: 3, contributionId: 4, txRef: 'tx_123' })
    mockVerifyCardPayment.mockRejectedValueOnce(new Error('provider timeout')).mockResolvedValueOnce(true)

    renderAt('?tx_ref=tx_123&transaction_id=999')

    await screen.findByText('provider timeout')
    fireEvent.click(screen.getByRole('button', { name: 'Check again' }))

    await waitFor(() => expect(screen.getByText('Payment confirmed')).toBeTruthy())
    expect(mockVerifyCardPayment).toHaveBeenCalledTimes(2)
  })

  // The pending record is consumed on first read, so a retry must work from what the component
  // already captured. Reading the store again returns null and would report a false expiry.
  it('retries against the captured session rather than re-reading the consumed store', async () => {
    mockTakePendingCardPayment
      .mockReturnValueOnce({ chamaId: 3, contributionId: 4, txRef: 'tx_123' })
      .mockReturnValue(null)
    mockVerifyCardPayment.mockResolvedValueOnce(false).mockResolvedValueOnce(true)

    renderAt('?tx_ref=tx_123&transaction_id=999')

    await screen.findByText('Payment not completed')
    fireEvent.click(screen.getByRole('button', { name: 'Check again' }))

    await waitFor(() => expect(screen.getByText('Payment confirmed')).toBeTruthy())
    expect(screen.queryByText(/session has expired/i)).toBeNull()
  })
})
