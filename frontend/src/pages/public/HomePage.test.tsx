import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import HomePage from './HomePage'

function renderPage() {
  return render(
    <MemoryRouter>
      <HomePage />
    </MemoryRouter>,
  )
}

describe('HomePage', () => {
  it('renders the hero headline and primary call to action', () => {
    renderPage()
    expect(screen.getByText('Every shilling lands in the kiondo.')).toBeTruthy()
    expect(screen.getAllByText('Start your chama').length).toBeGreaterThan(0)
  })

  it('renders all four ledger value propositions', () => {
    renderPage()
    expect(screen.getByText('Mchango tracking')).toBeTruthy()
    expect(screen.getByText('Zamu, automated')).toBeTruthy()
    expect(screen.getByText('Two signatures, always')).toBeTruthy()
    expect(screen.getByText('M-Pesa native')).toBeTruthy()
  })

  it('renders the maker-checker trust section', () => {
    renderPage()
    expect(screen.getByText(/one person should never hold your chama/i)).toBeTruthy()
  })

  it('renders all four role cards', () => {
    renderPage()
    // Chairperson and Treasurer also appear as the stamp sublabels in the trust section.
    expect(screen.getAllByText('Chairperson').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Treasurer').length).toBeGreaterThan(0)
    expect(screen.getByText('Secretary')).toBeTruthy()
    expect(screen.getByText('Member')).toBeTruthy()
  })

  it('renders the member testimonial', () => {
    renderPage()
    expect(screen.getByText(/Grace W\./)).toBeTruthy()
  })

  it('links Sign In to the staff area', () => {
    renderPage()
    expect(screen.getByText('Sign In').closest('a')).toHaveAttribute('href', '/chamas')
  })
})
