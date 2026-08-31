import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useKeycloak } from '@react-keycloak/web'
import { getMyChamas, type MyChama } from '../../api/chamas'
import { exportMyData } from '../../api/members'
import { extractErrorMessage } from '../../api/client'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import LoadFailed from '../../components/ui/LoadFailed'
import LoadingButton from '../../components/ui/LoadingButton'
import { SkeletonBlock, SkeletonLine } from '../../components/ui/Skeleton'
import TransientAlert from '../../components/ui/TransientAlert'
import { roleBadgeText } from '../../utils/roleBadges'
import { downloadBlob } from '../../utils/download'

/**
 * Keycloak's own account console, which owns passwords and two-factor.
 *
 * Linked out to rather than rebuilt: credentials belong to the identity provider, and putting a
 * password form here would mean holding one against the admin client and keeping a second copy of
 * every rule Keycloak already enforces.
 */
function accountConsoleUrl(): string {
  const base = import.meta.env.VITE_KEYCLOAK_URL ?? 'http://localhost:8180'
  return `${base}/realms/chama/account`
}

export default function ProfilePage() {
  const { keycloak } = useKeycloak()
  const token = keycloak.tokenParsed as
    | { name?: string; preferred_username?: string; email?: string }
    | undefined

  const [chamas, setChamas] = useState<MyChama[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [exportingId, setExportingId] = useState<number | null>(null)
  const [notice, setNotice] = useState<{ variant: 'success' | 'error'; message: string } | null>(null)

  const refresh = () => {
    setLoading(true)
    setLoadError(null)
    getMyChamas()
      .then(setChamas)
      .catch((err) => setLoadError(extractErrorMessage(err)))
      .finally(() => setLoading(false))
  }

  useEffect(refresh, [])

  const handleExport = async (chama: MyChama) => {
    setExportingId(chama.id)
    setNotice(null)
    try {
      const data = await exportMyData(chama.id)
      downloadBlob(
        `webchama-my-data-${chama.name.replace(/\s+/g, '-').toLowerCase()}.json`,
        new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }),
      )
      setNotice({ variant: 'success', message: `Your ${chama.name} data has been downloaded.` })
    } catch (err) {
      setNotice({ variant: 'error', message: extractErrorMessage(err) })
    } finally {
      setExportingId(null)
    }
  }

  const displayName = token?.name ?? token?.preferred_username ?? 'Your account'

  return (
    <div data-testid="page-profile" className="mx-auto max-w-2xl space-y-4">
      <div>
        <h1 className="font-heading text-2xl font-bold text-ink">Your profile</h1>
        <p className="text-sm text-muted">Who you are on Webchama, and the chamas you belong to.</p>
      </div>

      <TransientAlert
        variant={notice?.variant ?? 'success'}
        message={notice?.message ?? null}
        onDismiss={() => setNotice(null)}
      />

      <Card className="space-y-3">
        <h2 className="font-heading text-lg font-semibold text-ink">{displayName}</h2>
        <dl className="space-y-2 text-sm">
          {token?.preferred_username && (
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted">Username</dt>
              <dd className="truncate font-mono text-ink">{token.preferred_username}</dd>
            </div>
          )}
          {token?.email && (
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted">Email</dt>
              <dd className="truncate font-mono text-ink">{token.email}</dd>
            </div>
          )}
        </dl>
        <p className="text-xs text-muted">
          Your name, email and password are held by the sign-in service rather than by Webchama.
        </p>
        <a
          href={accountConsoleUrl()}
          target="_blank"
          rel="noreferrer"
          className="inline-block text-sm font-semibold text-brand hover:underline"
        >
          Change your password or set up two-factor
        </a>
      </Card>

      <Card className="space-y-3">
        <h2 className="font-heading text-lg font-semibold text-ink">Your chamas</h2>
        {loading ? (
          <div className="space-y-2">
            <SkeletonLine className="h-5 w-40" />
            <SkeletonBlock className="h-16" />
          </div>
        ) : loadError ? (
          <LoadFailed what="your chamas" detail={loadError} onRetry={refresh} />
        ) : chamas.length === 0 ? (
          <p className="text-sm text-muted">
            You are not part of any chama yet.{' '}
            <Link to="/my-chamas" className="font-semibold text-brand hover:underline">
              Join or start one
            </Link>
            .
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {chamas.map((chama) => (
              <li key={chama.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <Link
                    to={`/chamas/${chama.id}/dashboard`}
                    className="font-medium text-ink hover:underline"
                  >
                    {chama.name}
                  </Link>
                  <div className="mt-1">
                    <Badge
                      label={roleBadgeText(chama.superAdmin, chama.roles)}
                      variant={chama.superAdmin ? 'primary' : 'success'}
                    />
                  </div>
                </div>
                {/* Everything this chama holds about the person asking, as a file they keep. */}
                <LoadingButton
                  variant="secondary"
                  loading={exportingId === chama.id}
                  loadingText="Preparing…"
                  onClick={() => handleExport(chama)}
                >
                  Download my data
                </LoadingButton>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="space-y-2">
        <h2 className="font-heading text-lg font-semibold text-ink">Notifications</h2>
        <p className="text-sm text-muted">
          Choose which events reach you in the app and by email.
        </p>
        <Link to="/notification-preferences">
          <Button variant="secondary">Notification preferences</Button>
        </Link>
      </Card>
    </div>
  )
}
