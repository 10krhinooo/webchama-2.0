import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'

vi.mock('../api/notifications', () => ({
  getNotifications: vi.fn(),
  getUnreadCount: vi.fn(),
  markNotificationRead: vi.fn(),
  markAllNotificationsRead: vi.fn(),
}))

const keycloak = { token: 'fake-token' as string | undefined }
vi.mock('@react-keycloak/web', () => ({
  useKeycloak: () => ({ keycloak }),
}))

import { useNotifications } from './useNotifications'
import {
  getNotifications,
  getUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
} from '../api/notifications'

const mockGet = getNotifications as ReturnType<typeof vi.fn>
const mockCount = getUnreadCount as ReturnType<typeof vi.fn>
const mockMarkRead = markNotificationRead as ReturnType<typeof vi.fn>
const mockMarkAllRead = markAllNotificationsRead as ReturnType<typeof vi.fn>

/** Captures the EventSource the hook opens so a test can push events through it. */
class FakeEventSource {
  static last: FakeEventSource | null = null
  onmessage: ((event: { data: string }) => void) | null = null
  onerror: (() => void) | null = null
  closed = false
  url: string
  // Declared and assigned rather than a constructor parameter property: that is TypeScript-only
  // syntax, which this project disallows via erasableSyntaxOnly.
  constructor(url: string) {
    this.url = url
    FakeEventSource.last = this
  }
  close() {
    this.closed = true
  }
}

const notification = (overrides = {}) => ({
  id: 1,
  chamaId: 4,
  eventFamily: 'LOAN' as const,
  title: 'Loan approved',
  body: 'body',
  link: '/chamas/4/loans',
  readAt: null,
  createdAt: '2026-08-01T00:00:00Z',
  ...overrides,
})

beforeEach(() => {
  vi.clearAllMocks()
  keycloak.token = 'fake-token'
  FakeEventSource.last = null
  vi.stubGlobal('EventSource', FakeEventSource)
  mockGet.mockResolvedValue([])
  mockCount.mockResolvedValue(0)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('useNotifications', () => {
  it('loads the inbox and the unread count', async () => {
    mockGet.mockResolvedValue([notification()])
    mockCount.mockResolvedValue(3)

    const { result } = renderHook(() => useNotifications())
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.notifications).toHaveLength(1)
    expect(result.current.unread).toBe(3)
  })

  it('does nothing when disabled', async () => {
    const { result } = renderHook(() => useNotifications(false))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(mockGet).not.toHaveBeenCalled()
  })

  it('passes the token on the stream URL, since EventSource cannot set headers', async () => {
    renderHook(() => useNotifications())
    await waitFor(() => expect(FakeEventSource.last).not.toBeNull())
    expect(FakeEventSource.last!.url).toBe('/api/notifications/stream?token=fake-token')
  })

  it('prepends a streamed notification and bumps the count', async () => {
    const { result } = renderHook(() => useNotifications())
    await waitFor(() => expect(FakeEventSource.last).not.toBeNull())

    act(() => {
      FakeEventSource.last!.onmessage?.({ data: JSON.stringify(notification({ id: 9, title: 'New' })) })
    })

    await waitFor(() => expect(result.current.notifications[0].title).toBe('New'))
    expect(result.current.unread).toBe(1)
  })

  it('ignores a malformed event rather than throwing', async () => {
    const { result } = renderHook(() => useNotifications())
    await waitFor(() => expect(FakeEventSource.last).not.toBeNull())

    act(() => {
      FakeEventSource.last!.onmessage?.({ data: 'not json' })
    })

    expect(result.current.notifications).toHaveLength(0)
  })

  it('falls back to polling when the stream errors, rather than going quiet', async () => {
    vi.useFakeTimers()
    renderHook(() => useNotifications())
    await vi.waitFor(() => expect(FakeEventSource.last).not.toBeNull())

    const callsBefore = mockGet.mock.calls.length
    act(() => {
      FakeEventSource.last!.onerror?.()
    })
    expect(FakeEventSource.last!.closed).toBe(true)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000)
    })
    expect(mockGet.mock.calls.length).toBeGreaterThan(callsBefore)
  })

  it('polls directly when EventSource is unavailable', async () => {
    vi.stubGlobal('EventSource', undefined)
    const { result } = renderHook(() => useNotifications())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(mockGet).toHaveBeenCalled()
  })

  it('polls directly when there is no token yet', async () => {
    keycloak.token = undefined
    renderHook(() => useNotifications())
    await waitFor(() => expect(mockGet).toHaveBeenCalled())
    expect(FakeEventSource.last).toBeNull()
  })

  it('keeps the current view when a load fails, rather than blanking it', async () => {
    mockGet.mockResolvedValueOnce([notification()])
    mockCount.mockResolvedValueOnce(1)
    const { result } = renderHook(() => useNotifications())
    await waitFor(() => expect(result.current.notifications).toHaveLength(1))

    mockGet.mockRejectedValue(new Error('offline'))
    await act(async () => {
      await result.current.refresh().catch(() => {})
    })
    expect(result.current.notifications).toHaveLength(1)
  })

  it('marks one read optimistically so the badge responds immediately', async () => {
    mockGet.mockResolvedValue([notification()])
    mockCount.mockResolvedValue(1)
    const { result } = renderHook(() => useNotifications())
    await waitFor(() => expect(result.current.unread).toBe(1))

    await act(async () => {
      await result.current.markRead(1)
    })

    expect(result.current.unread).toBe(0)
    expect(result.current.notifications[0].readAt).not.toBeNull()
    expect(mockMarkRead).toHaveBeenCalledWith(1)
  })

  it('reloads to correct itself when marking read fails', async () => {
    mockGet.mockResolvedValue([notification()])
    mockCount.mockResolvedValue(1)
    mockMarkRead.mockRejectedValue(new Error('nope'))
    const { result } = renderHook(() => useNotifications())
    await waitFor(() => expect(result.current.unread).toBe(1))

    const callsBefore = mockGet.mock.calls.length
    await act(async () => {
      await result.current.markRead(1)
    })
    expect(mockGet.mock.calls.length).toBeGreaterThan(callsBefore)
  })

  it('marks everything read', async () => {
    mockGet.mockResolvedValue([notification(), notification({ id: 2 })])
    mockCount.mockResolvedValue(2)
    const { result } = renderHook(() => useNotifications())
    await waitFor(() => expect(result.current.unread).toBe(2))

    await act(async () => {
      await result.current.markAllRead()
    })

    expect(result.current.unread).toBe(0)
    expect(result.current.notifications.every((n) => n.readAt)).toBe(true)
    expect(mockMarkAllRead).toHaveBeenCalled()
  })

  it('reloads to correct itself when marking all read fails', async () => {
    mockGet.mockResolvedValue([notification()])
    mockCount.mockResolvedValue(1)
    mockMarkAllRead.mockRejectedValue(new Error('nope'))
    const { result } = renderHook(() => useNotifications())
    await waitFor(() => expect(result.current.unread).toBe(1))

    const callsBefore = mockGet.mock.calls.length
    await act(async () => {
      await result.current.markAllRead()
    })
    expect(mockGet.mock.calls.length).toBeGreaterThan(callsBefore)
  })

  it('closes the stream on unmount', async () => {
    const { unmount } = renderHook(() => useNotifications())
    await waitFor(() => expect(FakeEventSource.last).not.toBeNull())
    unmount()
    expect(FakeEventSource.last!.closed).toBe(true)
  })
})
