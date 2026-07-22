import { useEffect, useState } from 'react'

interface ContributionPotProps {
  /** 0-100, the fraction of the pooled goal collected so far. */
  percent: number
  label?: string
  sublabel?: string
  className?: string
}

const WIDTH = 200
const HEIGHT = 200
const RIM_Y = 26
const BASE_Y = 176
const TOP_HALF_WIDTH = 78
const BASE_HALF_WIDTH = 44

/**
 * The signature element of the site: a literal kiondo (woven basket), the
 * everyday object a chama's pooled contributions are carried in. The weave
 * fills to the real collection progress rather than decorating the page,
 * unlike a purely ornamental motif, the fill level is the information.
 */
export default function ContributionPot({ percent, label = 'This cycle', sublabel, className }: ContributionPotProps) {
  const clamped = Math.min(100, Math.max(0, percent))
  const [animatedPercent, setAnimatedPercent] = useState(0)

  useEffect(() => {
    const frame = requestAnimationFrame(() => setAnimatedPercent(clamped))
    return () => cancelAnimationFrame(frame)
  }, [clamped])

  const fillHeight = ((BASE_Y - RIM_Y) * animatedPercent) / 100
  const fillY = BASE_Y - fillHeight

  const basketOutline = `M ${WIDTH / 2 - TOP_HALF_WIDTH} ${RIM_Y}
    L ${WIDTH / 2 - BASE_HALF_WIDTH} ${BASE_Y}
    Q ${WIDTH / 2} ${BASE_Y + 14} ${WIDTH / 2 + BASE_HALF_WIDTH} ${BASE_Y}
    L ${WIDTH / 2 + TOP_HALF_WIDTH} ${RIM_Y}`

  return (
    <div className={`mx-auto flex w-full max-w-xs flex-col items-center ${className ?? ''}`}>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="w-full"
        role="img"
        aria-label={`${Math.round(clamped)} percent of ${label.toLowerCase()}'s pooled contributions collected`}
      >
        <defs>
          <clipPath id="pot-clip">
            <path d={`${basketOutline} Z`} />
          </clipPath>
          <pattern id="pot-weave" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="10" height="10" fill="#E0A233" />
            <line x1="0" y1="0" x2="0" y2="10" stroke="#B87D1D" strokeWidth="2" />
            <line x1="5" y1="0" x2="5" y2="10" stroke="#B87D1D" strokeWidth="1" strokeOpacity={0.6} />
          </pattern>
        </defs>

        <g clipPath="url(#pot-clip)">
          <rect x="0" y="0" width={WIDTH} height={HEIGHT} fill="#EDE1CC" />
          <rect
            className="pot-fill-animate"
            x="0"
            y={fillY}
            width={WIDTH}
            height={HEIGHT - fillY}
            fill="url(#pot-weave)"
            style={{ transition: 'y 1.1s cubic-bezier(0.16, 1, 0.3, 1), height 1.1s cubic-bezier(0.16, 1, 0.3, 1)' }}
          />
        </g>

        <path d={basketOutline} fill="none" stroke="#1B4D45" strokeWidth={2.5} strokeLinejoin="round" />
        <ellipse cx={WIDTH / 2} cy={RIM_Y} rx={TOP_HALF_WIDTH} ry={9} fill="none" stroke="#1B4D45" strokeWidth={2.5} />
        {[-1, -0.5, 0, 0.5, 1].map((t) => (
          <line
            key={t}
            x1={WIDTH / 2 + t * TOP_HALF_WIDTH * 0.94}
            y1={RIM_Y + 3}
            x2={WIDTH / 2 + t * BASE_HALF_WIDTH * 0.94}
            y2={BASE_Y - 3}
            stroke="#1B4D45"
            strokeOpacity={0.35}
            strokeWidth={1.5}
          />
        ))}
      </svg>
      <div className="mt-2 flex flex-col items-center text-center">
        <span className="font-mono text-3xl font-bold text-ink">{Math.round(clamped)}%</span>
        <span className="mt-1 font-mono text-xs uppercase tracking-widest text-muted">{label}</span>
        {sublabel && <span className="mt-0.5 text-xs text-muted">{sublabel}</span>}
      </div>
    </div>
  )
}
