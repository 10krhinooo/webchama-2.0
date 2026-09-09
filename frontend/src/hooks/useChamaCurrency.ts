import { useEffect, useState } from 'react'
import { getChama } from '../api/chamas'
import { DEFAULT_CURRENCY } from '../utils/money'

/**
 * The currency one chama keeps its books in.
 *
 * `Chama.currency` has existed since the V2 migration, but only Dashboard and Payouts ever read
 * it. Penalties, Welfare Fund, Contributions and Approvals each rendered amounts without it, and
 * the Penalties form went as far as telling the user "In the chama's currency" directly above a
 * table that said KES regardless. Rather than thread a fourth `getChama` call into four separate
 * `Promise.all` chains, this follows the shape of `useMyMembership`: one hook the page calls, one
 * place that knows how the value is fetched.
 *
 * Falls back to the column's own default while loading and on failure, so a page renders a
 * plausible amount rather than a blank or a flash of "undefined". The consequence of being wrong
 * for one render is a briefly mislabelled unit; the consequence of blocking on it would be every
 * amount on the page disappearing whenever this one request is slow.
 */
export function useChamaCurrency(chamaId: number | undefined): string {
  const [currency, setCurrency] = useState(DEFAULT_CURRENCY)

  useEffect(() => {
    if (!chamaId) {
      setCurrency(DEFAULT_CURRENCY)
      return
    }
    let cancelled = false
    getChama(chamaId)
      .then((chama) => {
        if (!cancelled && chama?.currency) setCurrency(chama.currency)
      })
      .catch(() => {
        if (!cancelled) setCurrency(DEFAULT_CURRENCY)
      })
    return () => {
      cancelled = true
    }
  }, [chamaId])

  return currency
}
