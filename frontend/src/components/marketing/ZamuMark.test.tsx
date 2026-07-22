import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import ZamuMark from './ZamuMark'

describe('ZamuMark', () => {
  it('renders as a decorative, accessibility-hidden graphic', () => {
    const { container } = render(<ZamuMark className="h-6 w-6" />)
    const svg = container.querySelector('svg')
    expect(svg).toBeTruthy()
    expect(svg).toHaveAttribute('aria-hidden', 'true')
    expect(svg).toHaveClass('h-6', 'w-6')
  })
})
