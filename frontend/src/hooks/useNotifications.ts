import { useCallback, useEffect, useState } from 'react'
import { useKeycloak } from '@react-keycloak/web'
import {
  getNotifications,
  getUnreadCount,
  markAllNotificationsRead,
  markNotificationRead,
  type Notification,
} from '../api/notifications'

const POLL_INTERVAL_MS = 60_000

/**
 * The signed-in user's notifications, streamed over SSE with a polling fallback.
 *
 * Mirrors useActivityFeed, including the fallback: if EventSource cannot be used or the stream
 * errors, this drops back to polling rather than going quiet. The interval is a minute rather than
 * ten seconds, because a notification arriving late is a much smaller problem than an activity
 * feed that looks frozen, and this runs on every page.
 */
export function useNotifications(enabled = true) {
  const { keycloak } = useKeycloak()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unread, setUnread] = useState(0)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    const [list, count] = await Promise.all([getNotifications(), getUnreadCount()])
    setNotifications(list)
    setUnread(count)
  }, [])

  useEffect(() => {
    if (!enabled) {
      setNotifications([])
      setUnread(0)
      setLoading(false)
      return
    }

    let cancelled = false
    let pollTimer: ReturnType<typeof setInterval> | null = null

    const load = () => {
      Promise.all([getNotifications(), getUnreadCount()])
        .then(([list, count]) => {
          if (cancelled) return
          setNotifications(list)
          setUnread(count)
        })
        .catch(() => {
          // A failed poll keeps whatever was already shown. The bell is ambient, so an error
          // banner over the whole app would be far more disruptive than a stale count.
        })
        .finally(() => {
          if (!cancelled) setLoading(false)
        })
    }

    const startPolling = () => {
      if (pollTimer) return
      pollTimer = setInterval(load, POLL_INTERVAL_MS)
    }

    load()

    if (typeof EventSource === 'undefined' || !keycloak.token) {
      startPolling()
      return () => {
        cancelled = true
        if (pollTimer) clearInterval(pollTimer)
      }
    }

    // EventSource cannot set an Authorization header, so the token rides in the query string and
    // SseTokenFilter promotes it, the same arrangement useActivityFeed uses.
    const source = new EventSource(`/api/notifications/stream?token=${encodeURIComponent(keycloak.token)}`)

    source.onmessage = (event) => {
      if (cancelled) return
      try {
        const notification: Notification = JSON.parse(event.data)
        setNotifications((current) => [notification, ...current].slice(0, 20))
        setUnread((current) => current + 1)
      } catch {
        // A malformed event is dropped; the next one, or the next poll, restores the truth.
      }
    }

    source.onerror = () => {
      source.close()
      if (!cancelled) startPolling()
    }

    return () => {
      cancelled = true
      source.close()
      if (pollTimer) clearInterval(pollTimer)
    }
  }, [enabled, keycloak.token])

  const markRead = useCallback(async (id: number) => {
    // Applied locally first so the badge responds immediately; a failure is corrected by the next
    // load rather than being reported, since this happens as a side effect of opening something.
    setNotifications((current) =>
      current.map((n) => (n.readAt ? n : n.id === id ? { ...n, readAt: new Date().toISOString() } : n)),
    )
    // Callers only reach here for a row they have already seen to be unread, and the clamp bounds
    // a stale call, so the count cannot go negative.
    setUnread((current) => Math.max(0, current - 1))
    try {
      await markNotificationRead(id)
    } catch {
      await refresh().catch(() => {})
    }
  }, [refresh])

  const markAllRead = useCallback(async () => {
    const now = new Date().toISOString()
    setNotifications((current) => current.map((n) => (n.readAt ? n : { ...n, readAt: now })))
    setUnread(0)
    try {
      await markAllNotificationsRead()
    } catch {
      await refresh().catch(() => {})
    }
  }, [refresh])

  return { notifications, unread, loading, markRead, markAllRead, refresh }
}
