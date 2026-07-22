import { useEffect, useRef, useState } from 'react'
import { CheckCircleIcon, ExclamationTriangleIcon } from '@heroicons/react/24/solid'

type Variant = 'success' | 'error'

interface Props {
  variant: Variant
  message: string | null
  durationMs?: number
  className?: string
  onDismiss?: () => void
}

export default function TransientAlert({
  variant,
  message,
  durationMs = 5000,
  className = '',
  onDismiss,
}: Props) {
  const [visible, setVisible] = useState(Boolean(message))
  const onDismissRef = useRef(onDismiss)

  useEffect(() => {
    onDismissRef.current = onDismiss
  }, [onDismiss])

  useEffect(() => {
    if (!message) {
      setVisible(false)
      return
    }

    setVisible(true)
    const fadeTimer = window.setTimeout(() => setVisible(false), Math.max(0, durationMs - 300))
    const dismissTimer = window.setTimeout(() => onDismissRef.current?.(), durationMs)

    return () => {
      window.clearTimeout(fadeTimer)
      window.clearTimeout(dismissTimer)
    }
  }, [message, durationMs])

  if (!message) return null

  const isSuccess = variant === 'success'

  return (
    <div
      role="status"
      aria-live="polite"
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
        <div className="min-w-0">{message}</div>
      </div>
    </div>
  )
}
