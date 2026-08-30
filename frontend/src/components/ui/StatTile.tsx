import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface Props {
  label: string
  value: ReactNode
  /** Optional supporting line under the value, such as a comparison or a share of a target. */
  detail?: ReactNode
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
export default function StatTile({ label, value, detail, icon, className }: Props) {
  return (
    <div className={cn('flex flex-col rounded-2xl bg-surface p-6 shadow-card', className)}>
      <div className="flex items-start justify-between gap-3">
        <p className="font-heading text-xs font-semibold uppercase tracking-widest text-muted">{label}</p>
        {icon && (
          <span aria-hidden="true" className="text-muted">
            {icon}
          </span>
        )}
      </div>
      <p className="mt-2 font-mono text-2xl font-semibold text-ink">{value}</p>
      {detail && <p className="mt-1 text-xs text-muted">{detail}</p>}
    </div>
  )
}
