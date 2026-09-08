/**
 * The calendar a chama actually keeps, on the front end.
 *
 * The backend states this once in `ChamaTime` (`org.chama.domain.ChamaTime`) and every due date,
 * arrears bucket and reminder window is a Nairobi calendar date because of it. The front end had
 * no equivalent: every call site used `toLocaleDateString()` with no arguments, which renders in
 * the device's own timezone and locale. Two consequences, both visible to a member.
 *
 * The date can be wrong by a day. A meeting stored as 2026-09-08 is parsed as UTC midnight and
 * then shifted into the reader's zone, so a member whose phone is on a western timezone sees
 * 7 Sep for a meeting the secretary scheduled on the 8th.
 *
 * The date can be ambiguous even when right. `toLocaleDateString()` gives `9/8/2026` on a
 * US-locale device and `08/09/2026` on a UK one, for the same day. Nothing on the page says which
 * reading applies, so the two members disagree about when the money is due. Every format here is
 * therefore spelled-month, which cannot be read two ways.
 */

const LOCALE = 'en-KE'

/** The same zone as `ChamaTime.ZONE` on the backend. Stated once here so there is nothing to drift. */
export const ZONE = 'Africa/Nairobi'

/** A backend `LocalDate`, serialised as `2026-09-08`, carrying no time and no zone of its own. */
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/

/**
 * A calendar date, rendered as `8 Sept 2026`.
 *
 * A date-only value is formatted from its own components with no zone conversion at all, which is
 * the only way to guarantee the day rendered is the day stored. Anchoring it to a zone and
 * converting is what produces the off-by-one above, and it is a silent failure: it renders the
 * wrong day rather than an error. An instant is converted into the chama's zone instead, so every
 * member reads the same wall clock regardless of where they are holding their phone.
 */
export function formatDate(value: string | null | undefined): string {
  if (!value) return '—'

  const dateOnly = DATE_ONLY.test(value)
  const parsed = dateOnly ? new Date(`${value}T00:00:00Z`) : new Date(value)
  if (Number.isNaN(parsed.getTime())) return '—'

  return new Intl.DateTimeFormat(LOCALE, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: dateOnly ? 'UTC' : ZONE,
  }).format(parsed)
}

/**
 * An instant with its time, rendered as `8 Sept 2026, 14:30`, always on the chama's clock.
 *
 * Used for the audit-facing timestamps (activity feed, security events) where "when did this
 * happen" has to mean the same thing to the member who did it and the chairperson reviewing it.
 */
export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—'

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return '—'

  return new Intl.DateTimeFormat(LOCALE, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: ZONE,
  }).format(parsed)
}

/** A backend month key, serialised as `2026-05`. */
const MONTH_ONLY = /^\d{4}-\d{2}$/

/**
 * A month, rendered as `May 26`, for a chart axis where `2026-05` reads as a date to a machine
 * and not to a person.
 *
 * Formatted from the components rather than by constructing a Date, for the same reason
 * `formatDate` avoids it: there is no instant here to convert, only a label, and involving a
 * timezone can only move it to the wrong month.
 */
export function formatMonth(value: string): string {
  if (!MONTH_ONLY.test(value)) return value

  const [year, month] = value.split('-').map(Number)
  return new Intl.DateTimeFormat(LOCALE, {
    month: 'short',
    year: '2-digit',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, 1)))
}
