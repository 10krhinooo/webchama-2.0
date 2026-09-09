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
import { chartAxisProps, chartTooltipProps } from '../../lib/chartTheme'
import Card from '../ui/Card'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import { formatMoney } from '../../utils/money'
import { formatMonth } from '../../utils/dates'

export default function ContributionTrendChart({
  points,
  currency,
}: {
  points: ContributionTrendPoint[]
  currency?: string
}) {
  const reducedMotion = useReducedMotion()
  const data = points.map((p) => ({
    month: formatMonth(p.month),
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
            <XAxis dataKey="month" {...chartAxisProps} />
            <YAxis width={72} {...chartAxisProps} />
            <Tooltip {...chartTooltipProps} formatter={(value) => formatMoney(Number(value ?? 0), currency)} />
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
