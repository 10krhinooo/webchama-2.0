import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { ContributionTrendPoint } from '../../api/analytics'
import Card from '../ui/Card'
import { useReducedMotion } from '../../hooks/useReducedMotion'

/** "2026-05" reads as a date to a machine, not to a person looking at an axis. */
function monthLabel(month: string) {
  const [year, m] = month.split('-')
  const date = new Date(Number(year), Number(m) - 1, 1)
  return date.toLocaleDateString(undefined, { month: 'short', year: '2-digit' })
}

export default function ContributionTrendChart({ points }: { points: ContributionTrendPoint[] }) {
  const reducedMotion = useReducedMotion()
  const data = points.map((p) => ({
    month: monthLabel(p.month),
    expected: Number(p.expected),
    collected: Number(p.collected),
  }))

  return (
    <Card data-testid="contribution-trend-chart" className="space-y-3">
      <h2 className="font-heading text-lg font-semibold text-ink">Contributions billed and collected</h2>
      {/*
        The backend returns every month in the window, empty ones included, so a quiet month is
        visible as a gap in the bars rather than vanishing from the axis.
      */}
      <div className="h-64 w-full text-muted">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
            <XAxis dataKey="month" tick={{ fontSize: 12, fill: 'currentColor' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 12, fill: 'currentColor' }} width={72} axisLine={false} tickLine={false} />
            <Tooltip
              formatter={(value) => Number(value ?? 0).toLocaleString()}
              contentStyle={{ borderRadius: 12 }}
            />
            <Legend />
            {/*
              Tailwind fill utilities and currentColor rather than hex literals, so the chart
              follows the theme. A hard-coded palette stays light on a dark surface.
            */}
            <Bar dataKey="expected" name="Billed" className="fill-border-strong"
              isAnimationActive={!reducedMotion} radius={[4, 4, 0, 0]} />
            <Bar dataKey="collected" name="Collected" className="fill-primary"
              isAnimationActive={!reducedMotion} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  )
}
