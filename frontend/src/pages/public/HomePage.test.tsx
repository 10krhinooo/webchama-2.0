import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import HomePage from './HomePage'

describe('HomePage', () => {
  it('renders the hero headline and primary call to action', () => {
    render(<HomePage />)
    expect(screen.getByText('Every mchango has a turn.')).toBeTruthy()
    expect(screen.getAllByText('Start your chama').length).toBeGreaterThan(0)
  })

  it('renders all four ledger value propositions', () => {
    render(<HomePage />)
    expect(screen.getByText('Mchango tracking')).toBeTruthy()
    expect(screen.getByText('Zamu, automated')).toBeTruthy()
    expect(screen.getByText('Two signatures, always')).toBeTruthy()
    expect(screen.getByText('M-Pesa native')).toBeTruthy()
  })

  it('renders the maker-checker trust section', () => {
    render(<HomePage />)
    expect(screen.getByText(/one person should never hold your chama/i)).toBeTruthy()
  })

  it('renders all four role cards', () => {
    render(<HomePage />)
    // Chairperson and Treasurer also appear as the stamp sublabels in the trust section.
    expect(screen.getAllByText('Chairperson').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Treasurer').length).toBeGreaterThan(0)
    expect(screen.getByText('Secretary')).toBeTruthy()
    expect(screen.getByText('Member')).toBeTruthy()
  })

  it('renders the member testimonial', () => {
    render(<HomePage />)
    expect(screen.getByText(/Grace W\./)).toBeTruthy()
  })
})
