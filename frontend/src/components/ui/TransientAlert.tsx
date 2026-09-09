import { useEffect, useRef, useState } from 'react'
import { CheckCircleIcon, ExclamationTriangleIcon, XMarkIcon } from '@heroicons/react/24/solid'

type Variant = 'success' | 'error'

interface Props {
  variant: Variant
  message: string | null
  durationMs?: number
  className?: string
  onDismiss?: () => void
}

/**
 * A success message may fade on its own: it confirms something the user just did, and losing it
 * costs them nothing. An error must not. It reports something the user did *not* achieve, often
 * needs to be read twice, and is the only record of why the operation failed, so a five-second
 * timer silently destroys the one thing they need if they happened to glance away. Errors
 * therefore persist until dismissed, and carry a close button so persisting is not the same as
 * being stuck with them.
 *
 * The live-region role follows the same split. `role="status"` with `aria-live="polite"` waits for
 * the screen reader to finish whatever it is already saying, which is right for a confirmation and
 * wrong for a failure, so errors announce through `role="alert"` and `aria-live="assertive"`.
 */
export default function TransientAlert({
  variant,
  message,
  durationMs = 5000,
  className = '',
  onDismiss,
}: Props) {
  const [visible, setVisible] = useState(Boolean(message))
  const onDismissRef = useRef(onDismiss)
  const isSuccess = variant === 'success'

  useEffect(() => {
    onDismissRef.current = onDismiss
  }, [onDismiss])

  useEffect(() => {
    if (!message) {
      setVisible(false)
      return
    }

    setVisible(true)
    if (!isSuccess) return

    const fadeTimer = window.setTimeout(() => setVisible(false), Math.max(0, durationMs - 300))
    const dismissTimer = window.setTimeout(() => onDismissRef.current?.(), durationMs)

    return () => {
      window.clearTimeout(fadeTimer)
      window.clearTimeout(dismissTimer)
    }
  }, [message, durationMs, isSuccess])

  if (!message) return null

  return (
    <div
      role={isSuccess ? 'status' : 'alert'}
      aria-live={isSuccess ? 'polite' : 'assertive'}
      className={[
        'transition-all duration-300 ease-out overflow-hidden',
        visible ? 'opacity-100 translate-y-0 max-h-24' : 'opacity-0 -translate-y-1 max-h-0',
        className,
      ].join(' ')}
    >
      <div className={`flex items-start gap-3 rounded-xl border px-3 py-2 text-sm ${
        isSuccess
          ? 'border-success/25 bg-success/10 text-success'
          : 'border-danger/25 bg-danger/10 text-danger'
      }`}>
        {isSuccess ? (
          <CheckCircleIcon className="mt-0.5 h-5 w-5 shrink-0 text-success" />
        ) : (
          <ExclamationTriangleIcon className="mt-0.5 h-5 w-5 shrink-0 text-danger" />
        )}
        <div className="min-w-0 flex-1">{message}</div>
        {!isSuccess && (
          <button
            type="button"
            onClick={() => onDismissRef.current?.()}
            aria-label="Dismiss error"
            className="-m-1 shrink-0 rounded-lg p-1 text-danger/70 hover:bg-danger/10 hover:text-danger"
          >
            <XMarkIcon className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  )
}
