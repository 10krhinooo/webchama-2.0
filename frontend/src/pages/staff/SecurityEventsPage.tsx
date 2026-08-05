import { useEffect, useState } from 'react'
import { getSecurityEvents, type SecurityEvent } from '../../api/securityEvents'
import { extractErrorMessage } from '../../api/client'
import { TablePageSkeleton } from '../../components/ui/SkeletonLayouts'
import Badge from '../../components/ui/Badge'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui/Table'
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
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Time</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>User</TableHead>
              <TableHead>IP address</TableHead>
              <TableHead>Error</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {events.length === 0 && (
              <TableRow><TableCell colSpan={6} className="py-10 text-center text-sm text-muted">No security events found.</TableCell></TableRow>
            )}
            {pageItems.map((event) => (
              <TableRow key={event.id} className={event.error === SUSPICIOUS_ERROR ? 'bg-danger/5 hover:bg-danger/5' : undefined}>
                <TableCell className="font-mono text-muted whitespace-nowrap">{formatTime(event.eventTime)}</TableCell>
                <TableCell><Badge label={event.source} variant={event.source === 'ADMIN' ? 'primary' : 'muted'} /></TableCell>
                <TableCell className="font-medium text-ink">{event.type}</TableCell>
                <TableCell className="font-mono text-muted">{event.keycloakUserId ?? '—'}</TableCell>
                <TableCell className="font-mono text-muted">{event.ipAddress ?? '—'}</TableCell>
                <TableCell>
                  {event.error ? (
                    <Badge label={event.error} variant={event.error === SUSPICIOUS_ERROR ? 'danger' : 'warning'} />
                  ) : (
                    '—'
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {!loading && <Pagination page={page} totalPages={totalPages} total={total} pageSize={pageSize} onPage={setPage} label="events" />}
    </div>
  )
}
