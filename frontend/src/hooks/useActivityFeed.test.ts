import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useActivityFeed } from './useActivityFeed'

vi.mock('@react-keycloak/web', () => ({
  useKeycloak: vi.fn(),
}))
vi.mock('../api/activityLog', () => ({
  getActivityLog: vi.fn(),
}))

import { useKeycloak } from '@react-keycloak/web'
import { getActivityLog } from '../api/activityLog'

const mockUseKeycloak = useKeycloak as ReturnType<typeof vi.fn>
const mockGetActivityLog = getActivityLog as ReturnType<typeof vi.fn>

class FakeEventSource {
  static instances: FakeEventSource[] = []
  url: string
  onmessage: ((event: { data: string }) => void) | null = null
  onerror: (() => void) | null = null
  closed = false
  constructor(url: string) {
    this.url = url
    FakeEventSource.instances.push(this)
  }
  close() {
    this.closed = true
  }
}

describe('useActivityFeed', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    FakeEventSource.instances = []
    mockUseKeycloak.mockReturnValue({ keycloak: { token: 'test-token' } })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(globalThis as any).EventSource = FakeEventSource
  })

  afterEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (globalThis as any).EventSource
    vi.useRealTimers()
  })

  it('does nothing when disabled', async () => {
    const { result } = renderHook(() => useActivityFeed(5, false))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.entries).toEqual([])
    expect(mockGetActivityLog).not.toHaveBeenCalled()
  })

  it('does nothing when chamaId is undefined', async () => {
    const { result } = renderHook(() => useActivityFeed(undefined, true))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(mockGetActivityLog).not.toHaveBeenCalled()
  })

  it('loads the initial page and opens an SSE connection with the token as a query param', async () => {
    mockGetActivityLog.mockResolvedValue([{ id: 1, chamaId: 5, eventType: 'MEMBER_INVITED', description: 'A', createdAt: '2026-07-24T00:00:00Z' }])

    const { result } = renderHook(() => useActivityFeed(5, true))

    await waitFor(() => expect(result.current.entries).toHaveLength(1))
    expect(mockGetActivityLog).toHaveBeenCalledWith(5, 0, 20)
    expect(FakeEventSource.instances).toHaveLength(1)
    expect(FakeEventSource.instances[0].url).toBe('/api/chamas/5/activity-log/stream?token=test-token')
  })

  it('prepends a new entry pushed over the SSE connection', async () => {
    mockGetActivityLog.mockResolvedValue([])
    const { result } = renderHook(() => useActivityFeed(5, true))
    await waitFor(() => expect(FakeEventSource.instances).toHaveLength(1))

    const source = FakeEventSource.instances[0]
    act(() => {
      source.onmessage?.({ data: JSON.stringify({ id: 9, chamaId: 5, eventType: 'LOAN_APPROVED', description: 'B', createdAt: '2026-07-24T00:00:01Z' }) })
    })

    await waitFor(() => expect(result.current.entries).toHaveLength(1))
    expect(result.current.entries[0].description).toBe('B')
  })

  it('ignores a malformed SSE payload without throwing', async () => {
    mockGetActivityLog.mockResolvedValue([])
    renderHook(() => useActivityFeed(5, true))
    await waitFor(() => expect(FakeEventSource.instances).toHaveLength(1))

    const source = FakeEventSource.instances[0]
    expect(() => act(() => {
      source.onmessage?.({ data: 'not json' })
    })).not.toThrow()
  })

  it('falls back to polling when the SSE connection errors', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    mockGetActivityLog.mockResolvedValue([])

    renderHook(() => useActivityFeed(5, true))
    await vi.waitFor(() => expect(FakeEventSource.instances).toHaveLength(1))

    const source = FakeEventSource.instances[0]
    act(() => {
      source.onerror?.()
    })
    expect(source.closed).toBe(true)

    mockGetActivityLog.mockClear()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000)
    })
    expect(mockGetActivityLog).toHaveBeenCalled()
  })

  it('polls directly when EventSource is unavailable', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (globalThis as any).EventSource
    mockGetActivityLog.mockResolvedValue([])

    const { result } = renderHook(() => useActivityFeed(5, true))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(mockGetActivityLog).toHaveBeenCalled()
  })

  it('keeps the last known feed when a poll tick fails', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (globalThis as any).EventSource
    vi.useFakeTimers({ shouldAdvanceTime: true })
    mockGetActivityLog.mockResolvedValueOnce([{ id: 1, chamaId: 5, eventType: 'MEMBER_INVITED', description: 'A', createdAt: '2026-07-24T00:00:00Z' }])
    mockGetActivityLog.mockRejectedValueOnce(new Error('down'))

    const { result } = renderHook(() => useActivityFeed(5, true))
    await vi.waitFor(() => expect(result.current.entries).toHaveLength(1))

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000)
    })
    expect(result.current.entries).toHaveLength(1)
  })
})
