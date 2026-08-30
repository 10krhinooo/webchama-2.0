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

  it('says there is nothing rather than showing a figure, when there is no value', () => {
    render(<StatTile label="Next payout" empty="No payout scheduled yet" />)
    expect(screen.getByText('No payout scheduled yet')).toBeTruthy()
  })

  it('falls back to a generic line when no wording is given for an absent value', () => {
    render(<StatTile label="Next payout" value={null} />)
    expect(screen.getByText('Nothing yet')).toBeTruthy()
  })

  it('treats zero as a figure and not as an absent value', () => {
    // Zero measured is a different claim from nothing measured, and only one of them is news.
    render(<StatTile label="Overdue" value={0} empty="Nothing recorded" />)
    expect(screen.getByText('0')).toBeTruthy()
    expect(screen.queryByText('Nothing recorded')).toBeNull()
  })

  it('renders an action beside the label', () => {
    render(<StatTile label="Welfare fund" value="1,200" action={<button>Edit goal</button>} />)
    expect(screen.getByRole('button', { name: 'Edit goal' })).toBeTruthy()
  })
})
