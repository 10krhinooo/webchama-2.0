interface LedgerRowProps {
  title: string
  description: string
  isLast?: boolean
}

/**
 * A value proposition presented as one entry in a contribution ledger, the
 * real artifact a chama keeps its records in, rather than a generic icon card.
 */
export default function LedgerRow({ title, description, isLast }: LedgerRowProps) {
  return (
    <div className={`flex gap-4 py-6 sm:gap-6 ${isLast ? "" : "border-b border-border"}`}>
      <span
        aria-hidden="true"
        className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-success text-success"
      >
        <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none">
          <path d="M3 8.5L6.2 11.5L13 4" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <div>
        <h3 className="text-lg font-semibold text-ink">{title}</h3>
        <p className="mt-1 text-muted">{description}</p>
      </div>
    </div>
  )
}
