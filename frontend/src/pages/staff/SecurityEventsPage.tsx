import { useEffect, useState } from 'react'
import { getSecurityEvents, type SecurityEvent } from '../../api/securityEvents'
import { extractErrorMessage } from '../../api/client'
import LoadFailed from '../../components/ui/LoadFailed'
import EmptyState from '../../components/ui/EmptyState'
import { TablePageSkeleton } from '../../components/ui/SkeletonLayouts'
import Badge from '../../components/ui/Badge'
import { Table, type TableColumn } from '../../components/ui/Table'
import Pagination from '../../components/ui/Pagination'
import { usePagination } from '../../hooks/usePagination'
import { formatDateTime } from '../../utils/dates'

const SUSPICIOUS_ERROR = 'user_temporarily_disabled'

function formatTime(iso: string): string {
  return formatDateTime(iso)
}

export default function SecurityEventsPage() {
  const [events, setEvents] = useState<SecurityEvent[]>([])

  /**
   * Time and type lead the card. This is an audit feed, so the question is always "what happened,
   * and when", and the identifiers below it are only read once something looks wrong.
   */
  const eventColumns: TableColumn<SecurityEvent>[] = [
    {
      key: 'time',
      header: 'Time',
      priority: 1,
      render: (e) => <span className="whitespace-nowrap font-mono text-muted">{formatTime(e.eventTime)}</span>,
    },
    { key: 'type', header: 'Type', priority: 1, render: (e) => <span className="font-medium text-ink">{e.type}</span> },
    {
      key: 'source',
      header: 'Source',
      render: (e) => <Badge label={e.source} variant={e.source === 'ADMIN' ? 'primary' : 'muted'} />,
    },
    { key: 'user', header: 'User', render: (e) => <span className="font-mono text-muted">{e.keycloakUserId ?? '\u2014'}</span> },
    { key: 'ip', header: 'IP address', render: (e) => <span className="font-mono text-muted">{e.ipAddress ?? '\u2014'}</span> },
    {
      key: 'error',
      header: 'Error',
      render: (e) =>
        e.error ? (
          <Badge label={e.error} variant={e.error === SUSPICIOUS_ERROR ? 'danger' : 'warning'} />
        ) : (
          <>{'\u2014'}</>
        ),
    },
  ]
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
        <button type="submit" className="rounded-lg border border-primary px-4 py-1.5 text-sm font-semibold text-brand hover:bg-primary-light">
          Filter
        </button>
      </form>

      {loading ? (
        <TablePageSkeleton withButton={false} withFilter={false} />
      ) : error ? (
        <LoadFailed what="the security event feed" detail={error} onRetry={refresh} />
      ) : (
        events.length === 0 ? (
          <div className="rounded-2xl bg-surface shadow-card">
            <EmptyState title="No security events found" description="Sign-ins and account changes from Keycloak appear here." />
          </div>
        ) : (
          <Table
            columns={eventColumns}
            rows={pageItems}
            rowKey={(e) => e.id}
            rowClassName={(e) => (e.error === SUSPICIOUS_ERROR ? 'bg-danger/5 hover:bg-danger/5' : undefined)}
          />
        )
      )}

      {!loading && <Pagination page={page} totalPages={totalPages} total={total} pageSize={pageSize} onPage={setPage} label="events" />}
    </div>
  )
}
