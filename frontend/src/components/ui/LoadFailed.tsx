import Button from './Button'

interface Props {
  /** What could not be loaded, as a noun phrase: "your chamas", "this chama's payouts". */
  what: string
  /** The server's own explanation, where there is one worth repeating. */
  detail?: string | null
  onRetry?: () => void
}

/**
 * Shown in place of a list that failed to load.
 *
 * Deliberately not an EmptyState and deliberately not a transient banner. "You have no chamas yet"
 * and "we could not load your chamas" are different facts, and rendering the first for the second
 * states something false and then invites the reader to act on it. A banner that dismisses itself
 * after five seconds has the same effect a moment later, leaving a confident empty list behind.
 */
export default function LoadFailed({ what, detail, onRetry }: Props) {
  return (
    <div
      data-testid="load-failed"
      role="alert"
      className="flex flex-col items-center gap-2 rounded-2xl border border-danger/25 bg-danger/5 px-6 py-12 text-center"
    >
      <p className="font-heading text-sm font-semibold text-ink">Could not load {what}.</p>
      {detail && <p className="max-w-md text-sm text-muted">{detail}</p>}
      {onRetry && (
        <Button variant="secondary" onClick={onRetry} className="mt-2">
          Try again
        </Button>
      )}
    </div>
  )
}
