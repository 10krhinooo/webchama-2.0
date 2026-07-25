interface Props {
  requestedByName: string
  firstApproverName: string | null
}

/** Compact requested-to-signed sequence for a table row, the same "one stamp lands, then the next" idea as the homepage's StampApproval, scaled down to real names instead of role labels. */
export default function SignOffTrail({ requestedByName, firstApproverName }: Props) {
  return (
    <div className="flex items-center gap-1.5">
      <span
        className="inline-flex items-center rounded border-2 border-ink/20 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-ink/70"
        style={{ transform: 'rotate(-2deg)' }}
      >
        {requestedByName}
      </span>
      <svg viewBox="0 0 24 24" className="h-3 w-3 shrink-0 text-muted" aria-hidden="true">
        <path d="M4 12h16m0 0l-6-6m6 6l-6 6" stroke="currentColor" strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {firstApproverName ? (
        <span
          className="inline-flex items-center rounded border-2 border-success px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wide text-success"
          style={{ transform: 'rotate(2deg)' }}
        >
          {firstApproverName}
        </span>
      ) : (
        <span className="inline-flex items-center rounded border border-dashed border-muted/50 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-muted">
          Awaiting
        </span>
      )}
    </div>
  )
}
