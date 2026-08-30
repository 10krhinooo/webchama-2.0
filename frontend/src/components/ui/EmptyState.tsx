import type { ReactNode } from 'react'

interface Props {
  /** What is absent, phrased as a statement rather than an error. */
  title: string
  /** Optional next step, so an empty list is not a dead end. */
  description?: string
  action?: ReactNode
  icon?: ReactNode
}

/**
 * Shown when a list has loaded successfully and is genuinely empty.
 *
 * Deliberately distinct from an error state. "You have no loans yet" and "we could not load your
 * loans" are different facts, and rendering the same blank table for both is what makes a failed
 * request look like an empty account.
 */
export default function EmptyState({ title, description, action, icon }: Props) {
  return (
    <div data-testid="empty-state" className="flex flex-col items-center gap-2 px-6 py-12 text-center">
      {icon && (
        <span aria-hidden="true" className="text-muted">
          {icon}
        </span>
      )}
      <p className="font-heading text-sm font-semibold text-ink">{title}</p>
      {description && <p className="max-w-sm text-sm text-muted">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}
