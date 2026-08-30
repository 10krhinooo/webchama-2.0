import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import Card from './Card'

describe('Card', () => {
  it('renders its children', () => {
    render(<Card>panel body</Card>)
    expect(screen.getByText('panel body')).toBeTruthy()
  })

  it('uses the theme-aware surface rather than a literal white', () => {
    render(<Card data-testid="c">x</Card>)
    expect(screen.getByTestId('c').className).toContain('bg-surface')
  })

  it('merges an extra className instead of dropping the defaults', () => {
    render(
      <Card data-testid="c" className="p-0">
        x
      </Card>,
    )
    const cls = screen.getByTestId('c').className
    expect(cls).toContain('p-0')
    expect(cls).toContain('shadow-card')
  })

  it('forwards arbitrary div attributes', () => {
    render(
      <Card data-testid="c" id="panel" role="region" aria-label="Summary">
        x
      </Card>,
    )
    const el = screen.getByTestId('c')
    expect(el).toHaveAttribute('id', 'panel')
    expect(el).toHaveAttribute('aria-label', 'Summary')
  })
})
