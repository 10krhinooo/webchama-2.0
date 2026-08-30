import { describe, it, expect, afterEach } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { useChartColors } from './useChartColors'

describe('useChartColors', () => {
  afterEach(() => {
    document.documentElement.style.removeProperty('--color-primary')
    document.documentElement.className = ''
  })

  it('resolves a token to a concrete colour a charting library can use', () => {
    document.documentElement.style.setProperty('--color-primary', '27 77 69')
    const { result } = renderHook(() => useChartColors(['primary']))
    expect(result.current.primary).toBe('rgb(27 77 69)')
  })

  it('falls back to currentColor for a token that is not defined', () => {
    const { result } = renderHook(() => useChartColors(['nonexistent']))
    expect(result.current.nonexistent).toBe('currentColor')
  })

  it('recomputes when the theme class on the document changes', async () => {
    document.documentElement.style.setProperty('--color-primary', '27 77 69')
    const { result } = renderHook(() => useChartColors(['primary']))

    act(() => {
      document.documentElement.style.setProperty('--color-primary', '141 187 176')
      document.documentElement.className = 'dark'
    })

    await waitFor(() => expect(result.current.primary).toBe('rgb(141 187 176)'))
  })
})
