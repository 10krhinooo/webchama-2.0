import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface Props {
  label: string
  /**
   * The figure. `null` or `undefined` means there is genuinely nothing to show yet, and `empty` is
   * rendered in its place rather than a zero, which would be a different and wrong claim.
   */
  value?: ReactNode
  /** What to say when there is no value. */
  empty?: string
  /** Optional supporting line under the value, such as a comparison or a share of a target. */
  detail?: ReactNode
  /** Optional control beside the label, such as an edit link for the target behind the figure. */
  action?: ReactNode
  /** Optional leading icon. Decorative, so it is hidden from assistive technology. */
  icon?: ReactNode
  className?: string
}

/**
 * A single headline figure with its label.
 *
 * The dashboard had this shape inlined a dozen times and the admin overview defined its own local
 * copy, so the two drifted. The label is rendered before the value in the DOM so a screen reader
 * reads "Total contributions, 412,000" rather than a bare number, while the visual order is
 * reversed with flex so the figure still reads first.
 */
export default function StatTile({ label, value, empty, detail, action, icon, className }: Props) {
  const hasValue = value !== null && value !== undefined && value !== ''

  return (
    <div className={cn('flex flex-col rounded-2xl bg-surface p-6 shadow-card', className)}>
      <div className="flex items-start justify-between gap-3">
        <p className="font-heading text-xs font-semibold uppercase tracking-widest text-muted">{label}</p>
        {action}
        {icon && (
          <span aria-hidden="true" className="text-muted">
            {icon}
          </span>
        )}
      </div>
      {hasValue ? (
        <p className="mt-2 font-mono text-2xl font-semibold text-ink">{value}</p>
      ) : (
        <p className="mt-2 text-sm text-muted">{empty ?? 'Nothing yet'}</p>
      )}
      {detail && <p className="mt-1 text-xs text-muted">{detail}</p>}
    </div>
  )
}
