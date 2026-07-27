import { useEffect, useState } from 'react'
import { getSecurityEvents, type SecurityEvent } from '../../api/securityEvents'
import { extractErrorMessage } from '../../api/client'
import { TablePageSkeleton } from '../../components/ui/SkeletonLayouts'
import Badge from '../../components/ui/Badge'
import TransientAlert from '../../components/ui/TransientAlert'
import Pagination from '../../components/ui/Pagination'
import { usePagination } from '../../hooks/usePagination'

const SUSPICIOUS_ERROR = 'user_temporarily_disabled'

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString()
}

export default function SecurityEventsPage() {
  const [events, setEvents] = useState<SecurityEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [typeFilter, setTypeFilter] = useState('')
  const [errorFilter, setErrorFilter] = useState('')
  const [userFilter, setUserFilter] = useState('')

  const { page, totalPages, total, pageSize, pageItems, setPage } = usePagination(events)

  function refresh() {
    setLoading(true)
    getSecurityEvents({
      type: typeFilter || undefined,
      error: errorFilter || undefined,
      keycloakUserId: userFilter || undefined,
    })
      .then((data) => {
        setEvents(data)
        setError(null)
      })
      .catch((err) => setError(extractErrorMessage(err)))
      .finally(() => setLoading(false))
  }

  useEffect(refresh, [])

  function handleFilterSubmit(e: React.FormEvent) {
    e.preventDefault()
    refresh()
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-heading text-2xl font-bold text-ink">Security events</h1>
        <p className="text-sm text-muted">Keycloak login and admin events ingested across the platform</p>
      </div>

      <form onSubmit={handleFilterSubmit} className="flex flex-wrap gap-3">
        <input
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          placeholder="Type (e.g. LOGIN_ERROR)"
          className="rounded-lg border border-paper-dim px-3 py-1.5 text-sm text-ink"
        />
        <input
          value={errorFilter}
          onChange={(e) => setErrorFilter(e.target.value)}
          placeholder="Error (e.g. user_temporarily_disabled)"
          className="rounded-lg border border-paper-dim px-3 py-1.5 text-sm text-ink"
        />
        <input
          value={userFilter}
          onChange={(e) => setUserFilter(e.target.value)}
          placeholder="Keycloak user ID"
          className="rounded-lg border border-paper-dim px-3 py-1.5 text-sm text-ink"
        />
        <button type="submit" className="rounded-lg border border-primary px-4 py-1.5 text-sm font-semibold text-primary hover:bg-primary-light">
          Filter
        </button>
      </form>

      <TransientAlert variant="error" message={error} onDismiss={() => setError(null)} />

      {loading ? (
        <TablePageSkeleton withButton={false} withFilter={false} />
      ) : (
        <div className="bg-white rounded-2xl shadow-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-paper-dim border-b border-black/10">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-ink/80">Time</th>
                <th className="text-left px-4 py-3 font-medium text-ink/80">Source</th>
                <th className="text-left px-4 py-3 font-medium text-ink/80">Type</th>
                <th className="text-left px-4 py-3 font-medium text-ink/80">User</th>
                <th className="text-left px-4 py-3 font-medium text-ink/80">IP address</th>
                <th className="text-left px-4 py-3 font-medium text-ink/80">Error</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5">
              {events.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-muted text-sm">No security events found.</td></tr>
              )}
              {pageItems.map((event) => (
                <tr key={event.id} className={event.error === SUSPICIOUS_ERROR ? 'bg-danger/5' : 'hover:bg-paper-dim/30'}>
                  <td className="px-4 py-3 font-mono text-muted whitespace-nowrap">{formatTime(event.eventTime)}</td>
                  <td className="px-4 py-3"><Badge label={event.source} variant={event.source === 'ADMIN' ? 'primary' : 'muted'} /></td>
                  <td className="px-4 py-3 font-medium text-ink">{event.type}</td>
                  <td className="px-4 py-3 font-mono text-muted">{event.keycloakUserId ?? '—'}</td>
                  <td className="px-4 py-3 font-mono text-muted">{event.ipAddress ?? '—'}</td>
                  <td className="px-4 py-3">
                    {event.error ? (
                      <Badge label={event.error} variant={event.error === SUSPICIOUS_ERROR ? 'danger' : 'warning'} />
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && <Pagination page={page} totalPages={totalPages} total={total} pageSize={pageSize} onPage={setPage} label="events" />}
    </div>
  )
}
