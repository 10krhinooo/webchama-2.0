import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import ContributionPot from './ContributionPot'

describe('ContributionPot', () => {
  it('exposes an accessible label describing the collection progress', () => {
    render(<ContributionPot percent={68} />)
    expect(screen.getByRole('img', { name: /68 percent of this cycle's pooled contributions collected/i })).toBeTruthy()
  })

  it('renders the rounded percentage and label', () => {
    render(<ContributionPot percent={67.6} label="This round" />)
    expect(screen.getByText('68%')).toBeTruthy()
    expect(screen.getByText('This round')).toBeTruthy()
  })

  it('renders an optional sublabel', () => {
    render(<ContributionPot percent={40} sublabel="KES 40,000 of KES 100,000" />)
    expect(screen.getByText('KES 40,000 of KES 100,000')).toBeTruthy()
  })

  it('clamps out-of-range percentages', () => {
    render(<ContributionPot percent={140} />)
    expect(screen.getByText('100%')).toBeTruthy()
  })

  it('clamps negative percentages to zero', () => {
    render(<ContributionPot percent={-20} />)
    expect(screen.getByText('0%')).toBeTruthy()
  })
})
