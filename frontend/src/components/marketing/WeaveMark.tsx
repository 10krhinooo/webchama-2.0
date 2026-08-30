interface WeaveMarkProps {
  className?: string
}

/**
 * The reduced version of the ContributionPot signature, a small woven
 * cross-hatch swatch (the basket's texture, not its whole shape). Used
 * sparingly (nav mark, footer divider, sidebar header), never as general
 * page decoration, matching the "used sparingly" rule for the motif.
 */
export default function WeaveMark({ className }: WeaveMarkProps) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <rect x="2" y="2" width="28" height="28" rx="6" fill="none" stroke="currentColor" strokeOpacity={0.3} strokeWidth={1.5} />
      <g stroke="currentColor" strokeWidth={1.5} strokeLinecap="round">
        <line x1="8" y1="24" x2="24" y2="8" strokeOpacity={0.35} />
        <line x1="8" y1="16" x2="16" y2="8" strokeOpacity={0.35} />
        <line x1="16" y1="24" x2="24" y2="16" strokeOpacity={0.35} />
      </g>
      <circle cx="16" cy="16" r="3" className="fill-accent" />
    </svg>
  )
}
