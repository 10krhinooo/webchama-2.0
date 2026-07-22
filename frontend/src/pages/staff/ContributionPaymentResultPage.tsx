import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { verifyCardPayment } from '../../api/contributions'
import { extractErrorMessage } from '../../api/client'
import { takePendingCardPayment } from '../../lib/cardPaymentSession'
import Spinner from '../../components/ui/Spinner'

type Outcome = 'checking' | 'paid' | 'not-paid' | 'error'

export default function ContributionPaymentResultPage() {
  const [searchParams] = useSearchParams()
  const [outcome, setOutcome] = useState<Outcome>('checking')
  const [error, setError] = useState<string | null>(null)
  const [chamaId, setChamaId] = useState<number | null>(null)

  useEffect(() => {
    const txRef = searchParams.get('tx_ref')
    const transactionId = searchParams.get('transaction_id')

    if (!txRef || !transactionId) {
      setOutcome('error')
      setError('Missing payment reference. If you completed checkout, check My Contributions for the updated status.')
      return
    }

    const pending = takePendingCardPayment(txRef)
    if (!pending) {
      setOutcome('error')
      setError('This payment session has expired. Check My Contributions for the updated status.')
      return
    }

    setChamaId(pending.chamaId)
    verifyCardPayment(pending.chamaId, pending.contributionId, txRef, Number(transactionId))
      .then((paid) => setOutcome(paid ? 'paid' : 'not-paid'))
      .catch((err) => {
        setOutcome('error')
        setError(extractErrorMessage(err))
      })
  }, [searchParams])

  const contributionsLink = chamaId ? `/chamas/${chamaId}/contributions` : '/chamas'

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-paper px-6 text-center">
      {outcome === 'checking' && (
        <>
          <Spinner size="lg" />
          <p className="text-muted">Confirming your payment…</p>
        </>
      )}
      {outcome === 'paid' && (
        <>
          <p className="font-heading text-2xl font-bold text-success">Payment confirmed</p>
          <p className="text-ink/70">Your contribution has been marked as paid.</p>
        </>
      )}
      {outcome === 'not-paid' && (
        <>
          <p className="font-heading text-2xl font-bold text-warning">Payment not completed</p>
          <p className="text-ink/70">We could not confirm this payment. If money left your account, it will reconcile shortly.</p>
        </>
      )}
      {outcome === 'error' && (
        <>
          <p className="font-heading text-2xl font-bold text-danger">Could not confirm payment</p>
          <p className="text-ink/70">{error}</p>
        </>
      )}
      <Link to={contributionsLink} className="font-medium text-primary underline hover:text-primary-dark">
        Back to Contributions
      </Link>
    </div>
  )
}
