import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

const mockReducedMotion = vi.fn(() => false)
vi.mock('../../hooks/useReducedMotion', () => ({
  useReducedMotion: () => mockReducedMotion(),
}))

type AnimateOptions = Record<string, unknown>
const animate = vi.fn((_targets: unknown, _options: AnimateOptions) => ({ cancel: vi.fn() }))
const set = vi.fn((_targets: unknown, _values: AnimateOptions) => undefined)
vi.mock('animejs', () => ({
  animate: (targets: unknown, options: AnimateOptions) => animate(targets, options),
  stagger: (value: number) => `stagger:${value}`,
  utils: { set: (targets: unknown, values: AnimateOptions) => set(targets, values) },
}))

import PageTransition from './PageTransition'

describe('PageTransition', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockReducedMotion.mockReturnValue(false)
  })

  it('renders its children', () => {
    render(
      <PageTransition>
        <p>Page body</p>
      </PageTransition>,
    )
    expect(screen.getByText('Page body')).toBeTruthy()
  })

  it('animates the page in on arrival', () => {
    render(
      <PageTransition>
        <p>Page body</p>
      </PageTransition>,
    )
    expect(animate).toHaveBeenCalledTimes(1)
    expect(animate.mock.calls[0][1]).toMatchObject({ opacity: 1, translateY: 0 })
  })

  it('staggers the top-level children when there is more than one', () => {
    render(
      <PageTransition>
        <p>First</p>
        <p>Second</p>
      </PageTransition>,
    )
    expect(animate.mock.calls[0][1]).toMatchObject({ delay: 'stagger:45' })
  })

  it('does not stagger a single child, which would only delay the whole page', () => {
    render(
      <PageTransition>
        <p>Only</p>
      </PageTransition>,
    )
    expect(animate.mock.calls[0][1]).toMatchObject({ delay: 0 })
  })

  it('does nothing at all when the reader has asked for less motion', () => {
    mockReducedMotion.mockReturnValue(true)
    render(
      <PageTransition>
        <p>Page body</p>
      </PageTransition>,
    )
    expect(animate).not.toHaveBeenCalled()
    expect(set).not.toHaveBeenCalled()
  })

  it('leaves the page visible when it unmounts mid-animation', () => {
    const { unmount } = render(
      <PageTransition>
        <p>Page body</p>
      </PageTransition>,
    )
    set.mockClear()
    unmount()
    // A page frozen half-faded on navigation is worse than no animation at all.
    expect(set).toHaveBeenCalledWith(expect.anything(), { opacity: 1, translateY: 0 })
  })
})
