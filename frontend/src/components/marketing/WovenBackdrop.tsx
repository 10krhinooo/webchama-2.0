interface WovenBackdropProps {
  className?: string
  /** Kanga-teal (default) or the darker night tone, for sections on a dark background. */
  tone?: 'primary' | 'night'
}

/**
 * The ContributionPot's weave pattern, tiled and scaled up into a full-bleed atmospheric backdrop
 * (depth-0 in the hero/CTA sections) rather than a literal basket. Same cross-hatch language as
 * ChamaMark, used here as texture instead of an icon, so the kiondo motif reads at every scale
 * without introducing a second, unrelated pattern into the brand system.
 */
export default function WovenBackdrop({ className, tone = 'primary' }: WovenBackdropProps) {
  const patternId = `woven-backdrop-${tone}`
  // The primary tone follows the theme, so the texture stays visible when the surface under it
  // inverts. The night tone is a fixed step off the ramp on purpose: it is only ever used on
  // sections that are dark in both themes.
  const strokeClass = tone === 'primary' ? 'stroke-primary' : 'stroke-primary-950'

  return (
    <svg className={className} aria-hidden="true" preserveAspectRatio="xMidYMid slice">
      <defs>
        <pattern id={patternId} width="80" height="80" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="80" className={strokeClass} strokeWidth="1" strokeOpacity={0.08} />
          <line x1="40" y1="0" x2="40" y2="80" className={strokeClass} strokeWidth="1" strokeOpacity={0.05} />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${patternId})`} />
    </svg>
  )
}
