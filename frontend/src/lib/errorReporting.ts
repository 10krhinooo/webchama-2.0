import * as Sentry from '@sentry/react'

/**
 * Browser-side error reporting, and what it is allowed to send.
 *
 * <p>Mirrors `SentryConfiguration` on the backend, for the same reason: this app shows member
 * phone numbers, national ids, amounts and payment references on screen, and a reporter left on
 * its defaults attaches the URL, the request payloads it saw and every breadcrumb the user walked
 * through to get there. A member's own ledger is not something to hand a third party because a
 * render threw.
 *
 * Inert without `VITE_SENTRY_DSN`, so dev servers and the test suite send nothing and neither
 * needs a separate mode to stay quiet.
 */

/**
 * Key fragments that can carry a member's data.
 *
 * Deliberately does not include `code`, though an OAuth redirect does carry one: as a substring it
 * also matches `status_code`, and deleting the HTTP status from a breadcrumb removes the single
 * most useful field in a failed-request report. The redirect's `code` is already gone by then,
 * because `stripQuery` removes the whole query string and fragment rather than picking through it.
 */
const FORBIDDEN_QUERY_KEYS = [
  'phone',
  'msisdn',
  'email',
  'token',
  'tx_ref',
  'transaction_id',
  'national',
]

/**
 * Drops the query string from a URL, keeping the path.
 *
 * The path is what tells you which screen broke. The query is where the identifiers are: the
 * card-payment return lands on `?tx_ref=...&transaction_id=...`, which is exactly the screen most
 * likely to produce an error report.
 */
export function stripQuery(url: string | undefined): string | undefined {
  if (!url) return url
  const cut = url.indexOf('?')
  const hash = url.indexOf('#')
  const end = Math.min(cut === -1 ? url.length : cut, hash === -1 ? url.length : hash)
  return url.slice(0, end)
}

/** True if a breadcrumb or tag name looks like it carries member data. */
export function isForbiddenKey(key: string): boolean {
  const lower = key.toLowerCase()
  return FORBIDDEN_QUERY_KEYS.some((fragment) => lower.includes(fragment))
}

/**
 * The last thing every event passes through.
 *
 * Written as an exported function rather than an inline lambda so it can be tested directly. The
 * failure here is silent, in the sense that a leak looks exactly like working error monitoring.
 */
export function scrubEvent(event: Sentry.ErrorEvent): Sentry.ErrorEvent {
  if (event.request) {
    event.request.url = stripQuery(event.request.url)
    delete event.request.query_string
    delete event.request.cookies
    delete event.request.headers
    delete event.request.data
  }

  if (event.user) {
    // Only the opaque Keycloak subject survives, and only if something set it.
    event.user = event.user.id ? { id: event.user.id } : undefined
  }

  if (event.breadcrumbs) {
    event.breadcrumbs = event.breadcrumbs.map((crumb) => {
      const next = { ...crumb }
      if (next.data) {
        next.data = Object.fromEntries(
          Object.entries(next.data).filter(([key]) => !isForbiddenKey(key)),
        )
        if (typeof next.data.url === 'string') next.data.url = stripQuery(next.data.url)
      }
      return next
    })
  }

  if (event.tags) {
    for (const key of Object.keys(event.tags)) {
      if (isForbiddenKey(key)) delete event.tags[key]
    }
  }

  return event
}

/**
 * Starts reporting, if a DSN was built in.
 *
 * Returns whether it did, which is what lets the test suite assert the inert case rather than
 * taking it on faith.
 */
export function initErrorReporting(): boolean {
  const dsn = import.meta.env.VITE_SENTRY_DSN
  if (!dsn) return false

  Sentry.init({
    dsn,
    environment: import.meta.env.VITE_SENTRY_ENVIRONMENT ?? 'local',
    release: import.meta.env.VITE_SENTRY_RELEASE || undefined,
    // Errors, not APM. Tracing is a separate decision with its own volume and cost.
    tracesSampleRate: 0,
    sendDefaultPii: false,
    // The default integrations include one that records every fetch/XHR as a breadcrumb with its
    // URL. The URLs here are `/api/chamas/3/members/5`, which is not sensitive, but the payloads
    // and query strings are, so scrubEvent still runs over what it records.
    beforeSend: scrubEvent,
  })
  return true
}

/** Reports a render error caught by the boundary. No-op when reporting was never initialised. */
export function reportError(error: Error, componentStack?: string | null): void {
  Sentry.withScope((scope) => {
    if (componentStack) {
      scope.setContext('react', { componentStack })
    }
    Sentry.captureException(error)
  })
}
