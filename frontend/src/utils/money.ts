/**
 * The one money formatter in the app.
 *
 * Six pages used to format their own amounts and produced four different answers for the same
 * number. Approvals, Payouts, Welfare Fund and Contributions rendered a bare `toLocaleString()`
 * with no currency at all, so the payout confirmation asked the treasurer to release "50,000" of
 * nothing in particular. Penalties hardcoded KES over the chama's own `currency` column. MyMoney
 * and Dashboard each kept a private near-identical helper that did it correctly, which is how the
 * other four went unnoticed for so long.
 *
 * The locale is pinned rather than left to the browser. `toLocaleString()` with no locale argument
 * follows the device, so a member whose phone is set to de-DE reads `50.000` where the treasurer
 * sitting beside them reads `50,000`. On a shared ledger both people have to see the same string.
 *
 * Decimals are always shown. A ledger that renders 1,500.50 as "1,500" is not tidier, it is wrong,
 * and the shilling it hides is exactly the kind a member notices at the AGM.
 */

const LOCALE = 'en-KE'

/**
 * Intl separates the symbol from the amount with a non-breaking space (U+00A0), to stop "Ksh" and
 * "50,000.00" landing on different lines. That is the right instinct and the wrong character to
 * carry through an app: it is invisible in a diff, so every assertion on a rendered amount becomes
 * a guessing game for whoever writes the next test, and it survives a copy-paste into WhatsApp,
 * which is where these figures actually get shared. Normalised to a plain space here, and the
 * wrapping it was guarding against is handled in CSS by the `whitespace-nowrap` on money cells.
 */
function normalizeSpaces(formatted: string): string {
  return formatted.replace(/\u00a0/g, ' ')
}

/** Matches `Chama.currency`, which is `VARCHAR(3) NOT NULL DEFAULT 'KES'` (V2 migration). */
export const DEFAULT_CURRENCY = 'KES'

/**
 * The number alone, grouped and always to two decimals, with no currency attached. For the rare
 * place that states the unit in a column header rather than on every row.
 */
export function formatAmount(amount: number): string {
  if (!Number.isFinite(amount)) return '—'
  return normalizeSpaces(
    new Intl.NumberFormat(LOCALE, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount),
  )
}

/**
 * An amount with its currency, for display. A recognised code renders through its local symbol, so
 * a Kenyan member reads "Ksh 50,000.00" rather than the ISO code.
 *
 * `Intl.NumberFormat` throws a RangeError on a code it does not recognise, and `chama.currency` is
 * a free-text 3-character column with no CHECK constraint behind it. A chama saved with a typo
 * would otherwise take down every page that renders one of its amounts, so an unknown code falls
 * back to printing itself rather than a blank screen.
 */
export function formatMoney(amount: number, currency: string = DEFAULT_CURRENCY): string {
  if (!Number.isFinite(amount)) return '—'
  try {
    return normalizeSpaces(new Intl.NumberFormat(LOCALE, { style: 'currency', currency }).format(amount))
  } catch {
    return `${currency} ${formatAmount(amount)}`
  }
}
