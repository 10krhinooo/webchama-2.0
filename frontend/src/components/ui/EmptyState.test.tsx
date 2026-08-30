import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import EmptyState from './EmptyState'

describe('EmptyState', () => {
  it('states what is absent', () => {
    render(<EmptyState title="No loans yet" />)
    expect(screen.getByText('No loans yet')).toBeTruthy()
  })

  it('renders an optional description', () => {
    render(<EmptyState title="No loans yet" description="Requested loans appear here." />)
    expect(screen.getByText('Requested loans appear here.')).toBeTruthy()
  })

  it('renders an optional action, so an empty list is not a dead end', () => {
    render(<EmptyState title="No loans yet" action={<button>Request a loan</button>} />)
    expect(screen.getByRole('button', { name: 'Request a loan' })).toBeTruthy()
  })

  it('hides a decorative icon from assistive technology', () => {
    render(<EmptyState title="Nothing here" icon={<svg data-testid="icon" />} />)
    expect(screen.getByTestId('icon').parentElement).toHaveAttribute('aria-hidden', 'true')
  })

  it('renders only the title when nothing else is supplied', () => {
    render(<EmptyState title="Nothing here" />)
    expect(screen.getByTestId('empty-state').textContent).toBe('Nothing here')
  })
})
