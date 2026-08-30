import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import ContributionTrendChart from './ContributionTrendChart'

vi.mock('../../hooks/useReducedMotion', () => ({ useReducedMotion: vi.fn(() => true) }))

// Recharts measures its container, which jsdom reports as zero, so the SVG never renders. The
// container and the axis labelling are what this component actually contributes.
vi.mock('recharts', async () => {
  const actual = await vi.importActual<typeof import('recharts')>('recharts')
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div style={{ width: 600, height: 300 }}>{children}</div>
    ),
  }
})

const POINTS = [
  { month: '2026-03', expected: '0.00', collected: '0.00', collectionRate: 0 },
  { month: '2026-04', expected: '1000.00', collected: '800.00', collectionRate: 0.8 },
]

describe('ContributionTrendChart', () => {
  it('renders a chart for the months it is given', () => {
    render(<ContributionTrendChart points={POINTS} />)

    expect(screen.getByTestId('contribution-trend-chart')).toBeTruthy()
    expect(screen.getByText('Contributions billed and collected')).toBeTruthy()
  })

  it('renders even when every month is empty', () => {
    // The backend gap-fills, so an inactive chama arrives as a full window of zeros rather than
    // an empty list, and the chart must cope with that rather than dividing by a maximum of zero.
    render(<ContributionTrendChart points={[POINTS[0]]} />)

    expect(screen.getByTestId('contribution-trend-chart')).toBeTruthy()
  })

  it('renders with no points at all', () => {
    render(<ContributionTrendChart points={[]} />)
    expect(screen.getByTestId('contribution-trend-chart')).toBeTruthy()
  })
})
