import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import WovenBackdrop from './WovenBackdrop'

describe('WovenBackdrop', () => {
  it('renders as a decorative, accessibility-hidden graphic', () => {
    const { container } = render(<WovenBackdrop className="absolute inset-0" />)
    const svg = container.querySelector('svg')
    expect(svg).toBeTruthy()
    expect(svg).toHaveAttribute('aria-hidden', 'true')
    expect(svg).toHaveClass('absolute', 'inset-0')
  })

  it('uses a distinct pattern id per tone so two instances on one page do not collide', () => {
    const { container: primary } = render(<WovenBackdrop tone="primary" />)
    const { container: night } = render(<WovenBackdrop tone="night" />)
    expect(primary.querySelector('pattern')?.id).not.toBe(night.querySelector('pattern')?.id)
  })
})
