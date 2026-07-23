const STORAGE_KEY = 'webchama:pending-card-payment'

export interface PendingCardPayment {
  chamaId: number
  contributionId: number
  txRef: string
}

/** Recovers chama/contribution context after the Flutterwave-hosted checkout redirect returns,
 *  since the redirect URL only carries Flutterwave's own tx_ref/transaction_id, not our route params. */
export function savePendingCardPayment(pending: PendingCardPayment): void {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(pending))
}

export function takePendingCardPayment(txRef: string): PendingCardPayment | null {
  const raw = sessionStorage.getItem(STORAGE_KEY)
  if (!raw) return null
  sessionStorage.removeItem(STORAGE_KEY)
  try {
    const parsed = JSON.parse(raw) as PendingCardPayment
    return parsed.txRef === txRef ? parsed : null
  } catch {
    return null
  }
}
