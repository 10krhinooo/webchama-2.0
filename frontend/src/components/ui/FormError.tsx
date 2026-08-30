/**
 * The error banner shown inside a form or modal after a submit fails.
 *
 * role="alert" matters here: this message appears in response to an action the user just took,
 * usually well below the control they were interacting with, so without it a screen reader user
 * gets no indication that anything went wrong.
 *
 * Renders nothing when there is no message, so callers can pass state directly rather than
 * guarding at every call site.
 */
export default function FormError({ message, className = '' }: { message?: string | null; className?: string }) {
  if (!message) return null

  return (
    <div
      role="alert"
      data-testid="form-error"
      className={`rounded-lg border border-danger/25 bg-danger/10 px-3 py-2 text-sm text-danger ${className}`}
    >
      {message}
    </div>
  )
}
