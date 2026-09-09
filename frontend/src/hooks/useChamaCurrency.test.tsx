import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useChamaCurrency } from './useChamaCurrency'
import { getChama } from '../api/chamas'

vi.mock('../api/chamas', () => ({ getChama: vi.fn() }))

const mockGetChama = vi.mocked(getChama)

describe('useChamaCurrency', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('reports the currency the chama actually keeps its books in', async () => {
    mockGetChama.mockResolvedValue({ id: 1, currency: 'TZS' } as never)
    const { result } = renderHook(() => useChamaCurrency(1))
    await waitFor(() => expect(result.current).toBe('TZS'))
  })

  it('renders the column default while the request is still in flight', () => {
    mockGetChama.mockReturnValue(new Promise(() => {}) as never)
    const { result } = renderHook(() => useChamaCurrency(1))
    // Not blank and not "undefined": a page mid-load still shows a plausible unit.
    expect(result.current).toBe('KES')
  })

  it('falls back to the default rather than breaking the page when the request fails', async () => {
    mockGetChama.mockRejectedValue(new Error('offline'))
    const { result } = renderHook(() => useChamaCurrency(1))
    await waitFor(() => expect(result.current).toBe('KES'))
  })

  it('does not fetch at all without a chama id', () => {
    const { result } = renderHook(() => useChamaCurrency(undefined))
    expect(mockGetChama).not.toHaveBeenCalled()
    expect(result.current).toBe('KES')
  })

  it('keeps the default when the chama carries no currency', async () => {
    mockGetChama.mockResolvedValue({ id: 1 } as never)
    const { result } = renderHook(() => useChamaCurrency(1))
    await waitFor(() => expect(mockGetChama).toHaveBeenCalled())
    expect(result.current).toBe('KES')
  })
})
