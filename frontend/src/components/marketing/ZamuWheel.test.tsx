import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import ZamuWheel from './ZamuWheel'

const MEMBERS = ['JM', 'GW', 'PO', 'AK']

describe('ZamuWheel', () => {
  it('renders one dot per member', () => {
    const { container } = render(<ZamuWheel members={MEMBERS} activeIndex={0} />)
    MEMBERS.forEach((initials) => {
      expect(container.textContent).toContain(initials)
    })
  })

  it('labels the active member as due this cycle', () => {
    render(<ZamuWheel members={MEMBERS} activeIndex={2} activeLabel="Peter O." />)
    expect(screen.getByText('This cycle')).toBeTruthy()
    expect(screen.getByText('Peter O.')).toBeTruthy()
  })

  it('falls back to the member initials when no activeLabel is given', () => {
    render(<ZamuWheel members={MEMBERS} activeIndex={1} />)
    expect(screen.getByText('This cycle')).toBeTruthy()
    expect(screen.getAllByText('GW').length).toBeGreaterThan(0)
  })

  it('exposes an accessible label describing the rotation', () => {
    render(<ZamuWheel members={MEMBERS} activeIndex={0} activeLabel="John M." />)
    expect(screen.getByRole('img', { name: /John M\. is due this cycle/i })).toBeTruthy()
  })
})
