import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { verifyCardPayment } from '../../api/contributions'
import { extractErrorMessage } from '../../api/client'
import { takePendingCardPayment, type PendingCardPayment } from '../../lib/cardPaymentSession'
import Spinner from '../../components/ui/Spinner'
import Button from '../../components/ui/Button'

type Outcome = 'checking' | 'paid' | 'not-paid' | 'error'

/**
 * Where a member lands after paying by card, and the most anxious screen in the product: the only
 * question it answers is whether their money arrived.
 *
 * Three things follow from that. The outcome is a real heading rather than a styled paragraph, so
 * it is what a screen reader announces on arrival and what shows in the page outline. The whole
 * block is a polite live region, because the outcome replaces a spinner some seconds after the
 * page settles, and without one a screen-reader user is left on "Confirming your payment…"
 * indefinitely while the sighted user beside them can already see the answer. And a failure to
 * *confirm* is not a failure to *pay*, so both non-success paths offer a retry instead of only a
 * way out: the verification call is the thing that failed, and it is worth trying again.
 */
export default function ContributionPaymentResultPage() {
  const [searchParams] = useSearchParams()
  const [outcome, setOutcome] = useState<Outcome>('checking')
  const [error, setError] = useState<string | null>(null)
  const [chamaId, setChamaId] = useState<number | null>(null)
  const [attempt, setAttempt] = useState(0)
  const pendingRef = useRef<PendingCardPayment | null>(null)

  useEffect(() => {
    const txRef = searchParams.get('tx_ref')
    const transactionId = searchParams.get('transaction_id')

    if (!txRef || !transactionId) {
      setOutcome('error')
      setError('Missing payment reference. If you completed checkout, check My Contributions for the updated status.')
      return
    }

    // The pending record is consumed on the first read, so a retry has nothing left to look up.
    // Re-checking has to work from what this component already captured rather than the store.
    const pending = takePendingCardPayment(txRef) ?? pendingRef.current
    if (!pending) {
      setOutcome('error')
      setError('This payment session has expired. Check My Contributions for the updated status.')
      return
    }
    pendingRef.current = pending

    setOutcome('checking')
    setError(null)
    setChamaId(pending.chamaId)
    verifyCardPayment(pending.chamaId, pending.contributionId, txRef, Number(transactionId))
      .then((paid) => setOutcome(paid ? 'paid' : 'not-paid'))
      .catch((err) => {
        setOutcome('error')
        setError(extractErrorMessage(err))
      })
  }, [searchParams, attempt])

  const retry = useCallback(() => setAttempt((n) => n + 1), [])

  const contributionsLink = chamaId ? `/chamas/${chamaId}/contributions` : '/chamas'

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-paper px-6 text-center">
      {/*
        One live region wrapping every outcome, rather than one per branch. The outcome swaps in
        after the request settles, and a region that mounts at the same moment as its own content
        is not reliably announced: the screen reader has nothing to compare against. Keeping the
        region mounted from the first render, with the spinner inside it, means the change from
        "Confirming your payment…" to the verdict is a content change within a region that already
        exists, which is the case assistive technology actually watches for.
      */}
      <div role="status" aria-live="polite" className="flex flex-col items-center gap-4">
        {outcome === 'checking' && (
          <>
            <Spinner size="lg" />
            <p className="text-muted">Confirming your payment…</p>
          </>
        )}
        {outcome === 'paid' && (
          <>
            <h1 className="font-heading text-2xl font-bold text-success">Payment confirmed</h1>
            <p className="text-ink/70">Your contribution has been marked as paid.</p>
          </>
        )}
        {outcome === 'not-paid' && (
          <>
            <h1 className="font-heading text-2xl font-bold text-warning">Payment not completed</h1>
            <p className="text-ink/70">
              We could not confirm this payment. If money left your account, it will reconcile shortly.
            </p>
          </>
        )}
        {outcome === 'error' && (
          <>
            <h1 className="font-heading text-2xl font-bold text-danger">Could not confirm payment</h1>
            <p className="text-ink/70">{error}</p>
          </>
        )}
      </div>

      {(outcome === 'not-paid' || outcome === 'error') && (
        <Button onClick={retry}>Check again</Button>
      )}

      <Link to={contributionsLink} className="font-medium text-brand underline hover:text-primary-dark">
        Back to Contributions
      </Link>
    </div>
  )
}
