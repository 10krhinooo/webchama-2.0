import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import WeaveMark from './WeaveMark'

describe('WeaveMark', () => {
  it('renders as a decorative, accessibility-hidden graphic', () => {
    const { container } = render(<WeaveMark className="h-6 w-6" />)
    const svg = container.querySelector('svg')
    expect(svg).toBeTruthy()
    expect(svg).toHaveAttribute('aria-hidden', 'true')
    expect(svg).toHaveClass('h-6', 'w-6')
  })
})
