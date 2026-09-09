import { describe, it, expect, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useMediaQuery, useIsCompact } from './useMediaQuery'

type Listener = () => void

function stubMatchMedia(matches: boolean) {
  const listeners: Listener[] = []
  const list = {
    matches,
    media: '',
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: (_: string, fn: Listener) => listeners.push(fn),
    removeEventListener: (_: string, fn: Listener) => {
      const i = listeners.indexOf(fn)
      if (i >= 0) listeners.splice(i, 1)
    },
    dispatchEvent: () => false,
  }
  vi.stubGlobal('matchMedia', () => list as unknown as MediaQueryList)
  return {
    listenerCount: () => listeners.length,
    change(next: boolean) {
      list.matches = next
      listeners.forEach((fn) => fn())
    },
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('useMediaQuery', () => {
  it('reports whether the query matches', () => {
    stubMatchMedia(true)
    const { result } = renderHook(() => useMediaQuery('(max-width: 767px)'))
    expect(result.current).toBe(true)
  })

  it('re-evaluates when the viewport crosses the breakpoint mid-session', () => {
    const media = stubMatchMedia(false)
    const { result } = renderHook(() => useMediaQuery('(max-width: 767px)'))
    expect(result.current).toBe(false)

    act(() => media.change(true))
    expect(result.current).toBe(true)
  })

  it('stops listening when the component goes away', () => {
    const media = stubMatchMedia(false)
    const { unmount } = renderHook(() => useMediaQuery('(max-width: 767px)'))
    expect(media.listenerCount()).toBe(1)
    unmount()
    expect(media.listenerCount()).toBe(0)
  })

  // This default is what keeps the wide layout the one every other test sees, so a page test does
  // not have to know that its table has a second rendering at all.
  it('reports false when matchMedia is unavailable rather than throwing', () => {
    vi.stubGlobal('matchMedia', undefined)
    const { result } = renderHook(() => useMediaQuery('(max-width: 767px)'))
    expect(result.current).toBe(false)
  })
})

describe('useIsCompact', () => {
  it('tracks the md breakpoint, which has to agree with tailwind.config.js', () => {
    stubMatchMedia(true)
    const { result } = renderHook(() => useIsCompact())
    expect(result.current).toBe(true)
  })
})
