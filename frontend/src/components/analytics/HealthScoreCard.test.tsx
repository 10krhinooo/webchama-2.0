import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import HealthScoreCard from './HealthScoreCard'
import type { ChamaHealth } from '../../api/analytics'

function aHealth(overrides: Partial<ChamaHealth> = {}): ChamaHealth {
  return {
    chamaId: 3,
    score: 72,
    band: 'GOOD',
    components: [
      { code: 'COLLECTION_RATE', label: 'Contributions collected', rate: 0.9, weight: 0.4 },
      { code: 'ARREARS_HEALTH', label: 'Arrears', rate: 0.5, weight: 0.6 },
    ],
    activeMembers: 12,
    membersInArrears: 3,
    totalContributed: '120000.00',
    totalOutstandingArrears: '4500.00',
    outstandingLoanPrincipal: '30000.00',
    ...overrides,
  }
}

describe('HealthScoreCard', () => {
  it('shows the score, band and each component behind it', () => {
    render(<HealthScoreCard health={aHealth()} />)

    expect(screen.getByText('72')).toBeTruthy()
    expect(screen.getByText('Good')).toBeTruthy()
    expect(screen.getByText('Contributions collected')).toBeTruthy()
    expect(screen.getByText(/90%/)).toBeTruthy()
  })

  it('says how much of the score each component carries', () => {
    render(<HealthScoreCard health={aHealth()} />)

    // The weights are redistributed over the evidenced components, so showing them is what makes
    // a score built from two components instead of five legible.
    expect(screen.getByText('40% of score')).toBeTruthy()
    expect(screen.getByText('60% of score')).toBeTruthy()
  })

  it('explains a chama with no history instead of showing a number', () => {
    render(<HealthScoreCard health={aHealth({ score: null, band: 'INSUFFICIENT_HISTORY', components: [] })} />)

    expect(screen.getByText('Not enough history')).toBeTruthy()
    expect(screen.getByText(/Not enough recorded yet/)).toBeTruthy()
    expect(screen.queryByText('72')).toBeNull()
  })

  it.each([
    ['THRIVING', 'Thriving'],
    ['AT_RISK', 'At risk'],
    ['FAIR', 'Fair'],
  ] as const)('labels the %s band', (band, label) => {
    render(<HealthScoreCard health={aHealth({ band })} />)
    expect(screen.getByText(label)).toBeTruthy()
  })
})
