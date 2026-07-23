import { describe, it, expect, beforeEach } from 'vitest'
import { savePendingCardPayment, takePendingCardPayment } from './cardPaymentSession'

describe('cardPaymentSession', () => {
  beforeEach(() => {
    sessionStorage.clear()
  })

  it('round-trips a saved pending payment when the tx ref matches', () => {
    savePendingCardPayment({ chamaId: 3, contributionId: 4, txRef: 'tx_123' })
    expect(takePendingCardPayment('tx_123')).toEqual({ chamaId: 3, contributionId: 4, txRef: 'tx_123' })
  })

  it('clears the stored payment after it is taken', () => {
    savePendingCardPayment({ chamaId: 3, contributionId: 4, txRef: 'tx_123' })
    takePendingCardPayment('tx_123')
    expect(takePendingCardPayment('tx_123')).toBeNull()
  })

  it('returns null when the tx ref does not match what was stored', () => {
    savePendingCardPayment({ chamaId: 3, contributionId: 4, txRef: 'tx_123' })
    expect(takePendingCardPayment('tx_other')).toBeNull()
  })

  it('returns null when nothing was stored', () => {
    expect(takePendingCardPayment('tx_123')).toBeNull()
  })

  it('returns null when the stored value is corrupted', () => {
    sessionStorage.setItem('webchama:pending-card-payment', 'not json')
    expect(takePendingCardPayment('tx_123')).toBeNull()
  })
})
