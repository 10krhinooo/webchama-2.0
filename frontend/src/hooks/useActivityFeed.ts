import { useEffect, useRef, useState } from 'react'
import { useKeycloak } from '@react-keycloak/web'
import { getActivityLog, type ActivityLogEntry } from '../api/activityLog'

const POLL_INTERVAL_MS = 10_000

/**
 * Streams a chama's activity feed over SSE, falling back to 10s polling if the
 * EventSource connection fails to open (e.g. the browser blocks it, or the
 * server closes it because the caller isn't a chama manager).
 */
export function useActivityFeed(chamaId: number | undefined, enabled: boolean) {
  const { keycloak } = useKeycloak()
  const [entries, setEntries] = useState<ActivityLogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const sourceRef = useRef<EventSource | null>(null)

  useEffect(() => {
    if (!chamaId || !enabled) {
      setEntries([])
      setLoading(false)
      return
    }

    let cancelled = false
    let pollTimer: ReturnType<typeof setInterval> | null = null

    const poll = () => {
      getActivityLog(chamaId!, 0, 20)
        .then((data) => {
          if (!cancelled) setEntries(data)
        })
        .catch(() => {
          // Transient poll failure, keep the last known feed and try again next tick.
        })
    }

    function pollPeriodically() {
      if (pollTimer) return
      pollTimer = setInterval(poll, POLL_INTERVAL_MS)
    }

    function switchToPolling() {
      poll()
      pollPeriodically()
    }

    setLoading(true)
    getActivityLog(chamaId, 0, 20)
      .then((data) => {
        if (!cancelled) setEntries(data)
      })
      .catch(() => {
        // Initial load failure is surfaced by the empty state, not a page-level error.
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    if (typeof EventSource === 'undefined' || !keycloak.token) {
      // The initial fetch above already loaded the first page, so only the
      // recurring tick is needed here, no redundant immediate poll.
      pollPeriodically()
      return () => {
        cancelled = true
        if (pollTimer) clearInterval(pollTimer)
      }
    }

    const url = `/api/chamas/${chamaId}/activity-log/stream?token=${encodeURIComponent(keycloak.token)}`
    const source = new EventSource(url)
    sourceRef.current = source

    source.onmessage = (event) => {
      if (cancelled) return
      try {
        const entry: ActivityLogEntry = JSON.parse(event.data)
        setEntries((prev) => [entry, ...prev].slice(0, 20))
      } catch {
        // Ignore a malformed event, the feed stays consistent on the next one.
      }
    }
    source.onerror = () => {
      source.close()
      if (!cancelled) switchToPolling()
    }

    return () => {
      cancelled = true
      source.close()
      if (pollTimer) clearInterval(pollTimer)
    }
  }, [chamaId, enabled, keycloak.token])

  return { entries, loading }
}
