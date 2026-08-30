import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import StatTile from './StatTile'

describe('StatTile', () => {
  it('renders the label and value', () => {
    render(<StatTile label="Total contributions" value="KSh 412,000" />)
    expect(screen.getByText('Total contributions')).toBeTruthy()
    expect(screen.getByText('KSh 412,000')).toBeTruthy()
  })

  it('reads label before value, so the figure is announced with its meaning', () => {
    const { container } = render(<StatTile label="Members" value="24" />)
    expect(container.textContent).toBe('Members24')
  })

  it('renders an optional detail line', () => {
    render(<StatTile label="Goal" value="72%" detail="of KSh 500,000" />)
    expect(screen.getByText('of KSh 500,000')).toBeTruthy()
  })

  it('omits the detail line when not given', () => {
    const { container } = render(<StatTile label="Goal" value="72%" />)
    expect(container.textContent).toBe('Goal72%')
  })

  it('hides a decorative icon from assistive technology', () => {
    render(<StatTile label="Loans" value="3" icon={<svg data-testid="icon" />} />)
    expect(screen.getByTestId('icon').parentElement).toHaveAttribute('aria-hidden', 'true')
  })

  it('accepts an extra className', () => {
    const { container } = render(<StatTile label="A" value="1" className="col-span-2" />)
    expect(container.firstElementChild?.className).toContain('col-span-2')
  })
})
