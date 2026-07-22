interface ZamuWheelProps {
  members: string[]
  activeIndex: number
  activeLabel?: string
}

const SIZE = 320
const CENTER = SIZE / 2
const RING_RADIUS = 122
const DOT_RADIUS = 15
const ACTIVE_DOT_RADIUS = 22

/**
 * The signature element of the site: a literal diagram of a chama's payout
 * rotation (the "zamu"), not a decorative shape. Each dot is a member's turn;
 * the highlighted dot is whoever is due to receive the payout this cycle.
 */
export default function ZamuWheel({ members, activeIndex, activeLabel }: ZamuWheelProps) {
  const positions = members.map((_, i) => {
    const angle = (2 * Math.PI * i) / members.length - Math.PI / 2
    return {
      x: CENTER + RING_RADIUS * Math.cos(angle),
      y: CENTER + RING_RADIUS * Math.sin(angle),
    }
  })

  return (
    <div className="relative mx-auto aspect-square w-full max-w-sm">
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="zamu-wheel-spin w-full"
        style={{ animation: "zamu-settle 1.8s cubic-bezier(0.16, 1, 0.3, 1) both" }}
        role="img"
        aria-label={`Payout rotation wheel, ${members.length} members, ${activeLabel ?? members[activeIndex]} is due this cycle`}
      >
        <circle
          cx={CENTER}
          cy={CENTER}
          r={RING_RADIUS}
          fill="none"
          stroke="#3D3A6B"
          strokeOpacity={0.18}
          strokeWidth={2}
          strokeDasharray="1 10"
          strokeLinecap="round"
        />
        {positions.map((pos, i) => {
          const isActive = i === activeIndex
          return (
            <g key={members[i]}>
              <circle
                cx={pos.x}
                cy={pos.y}
                r={isActive ? ACTIVE_DOT_RADIUS : DOT_RADIUS}
                fill={isActive ? "#C97F1D" : "#FBF7EE"}
                stroke={isActive ? "#C97F1D" : "#3D3A6B"}
                strokeWidth={isActive ? 0 : 1.5}
              />
              <text
                x={pos.x}
                y={pos.y}
                textAnchor="middle"
                dominantBaseline="central"
                fontFamily="Sora, sans-serif"
                fontWeight={700}
                fontSize={isActive ? 13 : 11}
                fill={isActive ? "#FBF7EE" : "#3D3A6B"}
              >
                {members[i]}
              </text>
            </g>
          )
        })}
      </svg>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="font-mono text-xs uppercase tracking-widest text-muted">This cycle</span>
        <span className="mt-1 text-lg font-semibold text-ink">{activeLabel ?? members[activeIndex]}</span>
      </div>
      <style>{`
        @keyframes zamu-settle {
          from { transform: rotate(-320deg); opacity: 0; }
          to { transform: rotate(0deg); opacity: 1; }
        }
      `}</style>
    </div>
  )
}
