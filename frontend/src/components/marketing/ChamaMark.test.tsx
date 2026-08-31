import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import ChamaMark from './ChamaMark'

describe('ChamaMark', () => {
  it('renders as a decorative, accessibility-hidden graphic', () => {
    const { container } = render(<ChamaMark className="h-6 w-6" />)
    const svg = container.querySelector('svg')
    expect(svg).toBeTruthy()
    expect(svg).toHaveAttribute('aria-hidden', 'true')
    expect(svg).toHaveClass('h-6', 'w-6')
  })

  it('takes its colour from what it sits on, except for the confirming tick', () => {
    // The same mark appears on the dark sidebar, the paper footer and the danger tone of an error
    // screen, so only the second tick is pinned to the accent.
    const { container } = render(<ChamaMark />)
    const strokes = Array.from(container.querySelectorAll('path'))

    expect(strokes).toHaveLength(2)
    expect(strokes[0].getAttribute('stroke')).toBe('currentColor')
    expect(strokes[1].getAttribute('class')).toContain('stroke-accent')
  })
})
