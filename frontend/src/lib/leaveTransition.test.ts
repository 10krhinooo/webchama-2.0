import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const animate = vi.fn()
const set = vi.fn()
vi.mock('animejs', () => ({
  animate: (target: unknown, options: Record<string, unknown>) => animate(target, options),
  utils: { set: (target: unknown, values: Record<string, unknown>) => set(target, values) },
}))

import { leaveThen } from './leaveTransition'

describe('leaveThen', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('runs the navigation only once the page has faded out', () => {
    const navigate = vi.fn()
    leaveThen(navigate, false)

    // Not yet: the fade has to finish, or the reader sees the next page begin loading behind a
    // half-faded one.
    expect(navigate).not.toHaveBeenCalled()

    const options = animate.mock.calls[0][1] as { onComplete: () => void }
    options.onComplete()
    expect(navigate).toHaveBeenCalledTimes(1)
  })

  it('navigates immediately when the reader has asked for less motion', () => {
    const navigate = vi.fn()
    leaveThen(navigate, true)

    expect(navigate).toHaveBeenCalledTimes(1)
    expect(animate).not.toHaveBeenCalled()
  })

  it('restores the page if the navigation never happens', () => {
    vi.useFakeTimers()
    leaveThen(() => undefined, false)

    const options = animate.mock.calls[0][1] as { onComplete: () => void }
    options.onComplete()
    expect(set).not.toHaveBeenCalled()

    // Otherwise a cancelled sign-in leaves the tab blank with no way back.
    vi.advanceTimersByTime(1500)
    expect(set).toHaveBeenCalledWith(document.body, { opacity: 1 })
  })
})
