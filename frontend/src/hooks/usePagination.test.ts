import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { usePagination } from './usePagination'

describe('usePagination', () => {
  it('returns everything on one page when the list fits within the page size', () => {
    const { result } = renderHook(() => usePagination([1, 2, 3], 10))
    expect(result.current.pageItems).toEqual([1, 2, 3])
    expect(result.current.totalPages).toBe(1)
    expect(result.current.total).toBe(3)
  })

  it('slices to the requested page', () => {
    const items = Array.from({ length: 25 }, (_, i) => i + 1)
    const { result } = renderHook(() => usePagination(items, 10))

    act(() => result.current.setPage(2))
    expect(result.current.pageItems).toEqual([11, 12, 13, 14, 15, 16, 17, 18, 19, 20])
    expect(result.current.totalPages).toBe(3)
  })

  it('clamps the page back down when the list shrinks below the current page', () => {
    const { result, rerender } = renderHook(({ items }) => usePagination(items, 10), {
      initialProps: { items: Array.from({ length: 25 }, (_, i) => i + 1) },
    })

    act(() => result.current.setPage(3))
    expect(result.current.page).toBe(3)

    rerender({ items: Array.from({ length: 5 }, (_, i) => i + 1) })
    expect(result.current.page).toBe(1)
    expect(result.current.pageItems).toEqual([1, 2, 3, 4, 5])
  })
})
