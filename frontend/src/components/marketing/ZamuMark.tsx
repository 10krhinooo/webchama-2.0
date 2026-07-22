interface ZamuMarkProps {
  className?: string
}

/**
 * The reduced version of the ZamuWheel signature, a plain ring with one
 * highlighted point. Used sparingly (nav mark, footer divider), never as
 * general decoration, matching the "used sparingly" rule for the motif.
 */
export default function ZamuMark({ className }: ZamuMarkProps) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <circle cx="16" cy="16" r="12" fill="none" stroke="currentColor" strokeOpacity={0.3} strokeWidth={1.5} strokeDasharray="1 4" strokeLinecap="round" />
      <circle cx="16" cy="4" r="3" fill="#C97F1D" />
    </svg>
  )
}
