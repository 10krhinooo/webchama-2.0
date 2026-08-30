import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useReducedMotion } from './useReducedMotion'

/** A matchMedia stub whose value can be changed after the hook has subscribed. */
function stubMatchMedia(initial: boolean) {
  let matches = initial
  const listeners = new Set<() => void>()
  vi.stubGlobal(
    'matchMedia',
    () =>
      ({
        get matches() {
          return matches
        },
        addEventListener: (_: string, listener: () => void) => listeners.add(listener),
        removeEventListener: (_: string, listener: () => void) => listeners.delete(listener),
      }) as unknown as MediaQueryList,
  )
  return {
    change(next: boolean) {
      matches = next
      act(() => listeners.forEach((listener) => listener()))
    },
    listenerCount: () => listeners.size,
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('useReducedMotion', () => {
  it('reports the setting at mount', () => {
    stubMatchMedia(true)
    const { result } = renderHook(() => useReducedMotion())
    expect(result.current).toBe(true)
  })

  it('reports false when the user has not asked for reduced motion', () => {
    stubMatchMedia(false)
    const { result } = renderHook(() => useReducedMotion())
    expect(result.current).toBe(false)
  })

  it('re-evaluates when the setting changes mid-session', () => {
    const media = stubMatchMedia(false)
    const { result } = renderHook(() => useReducedMotion())
    expect(result.current).toBe(false)

    media.change(true)
    expect(result.current).toBe(true)
  })

  it('unsubscribes on unmount, so a later change cannot set state on a gone component', () => {
    const media = stubMatchMedia(false)
    const { unmount } = renderHook(() => useReducedMotion())
    expect(media.listenerCount()).toBe(1)
    unmount()
    expect(media.listenerCount()).toBe(0)
  })
})
