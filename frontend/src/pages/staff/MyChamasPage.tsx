import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getMyChamas, type MyChama } from '../../api/chamas'
import { roleBadgeText } from '../../utils/roleBadges'
import Badge from '../../components/ui/Badge'

export default function MyChamasPage() {
  const [chamas, setChamas] = useState<MyChama[]>([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    getMyChamas().then(setChamas).finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-32 animate-pulse rounded-2xl bg-paper-dim" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl font-bold text-ink">My Chamas</h1>
        <Link to="/chamas" className="text-sm font-semibold text-primary hover:underline">
          Manage chamas
        </Link>
      </div>

      {chamas.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-card px-4 py-10 text-center text-muted text-sm">
          You are not part of any chama yet.{' '}
          <Link to="/chamas" className="font-semibold text-primary hover:underline">
            Start one
          </Link>
          .
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {chamas.map((c) => (
            <button
              key={c.id}
              onClick={() => navigate(`/chamas/${c.id}/dashboard`)}
              className="text-left bg-white rounded-2xl shadow-card hover:shadow-card-hover transition-shadow p-5 space-y-3"
            >
              <div className="flex items-start justify-between gap-2">
                <h2 className="font-heading font-semibold text-ink">{c.name}</h2>
                <Badge label={roleBadgeText(c.superAdmin, c.roles)} variant={c.superAdmin ? 'primary' : 'success'} />
              </div>
              {c.description && <p className="text-sm text-muted line-clamp-2">{c.description}</p>}
              <p className="font-mono text-xs text-muted">
                {c.type.replaceAll('_', ' ')} &middot; {c.currency} {c.contributionAmount.toLocaleString()} /{' '}
                {c.contributionFrequency.toLowerCase()}
              </p>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
