import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useKeycloak } from '@react-keycloak/web'
import ErrorScreen from '../components/feedback/ErrorScreen'
import WeaveMark from '../components/marketing/WeaveMark'

interface Props {
  children: React.ReactNode
  roles?: string[]
}

export default function ProtectedRoute({ children, roles }: Props) {
  const { keycloak, initialized } = useKeycloak()

  useEffect(() => {
    if (initialized && !keycloak.authenticated) {
      keycloak.login()
    }
  }, [initialized, keycloak])

  if (!initialized || !keycloak.authenticated) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-paper text-muted">
        <WeaveMark className="h-9 w-9 animate-pulse text-brand" />
        <p className="text-sm">Signing you in…</p>
      </div>
    )
  }

  if (roles && roles.length > 0 && !roles.some((r) => keycloak.hasRealmRole(r))) {
    return (
      <ErrorScreen
        code="403"
        tone="danger"
        title="You do not have access to this page"
        description="Your account does not hold the role this page needs. If that is wrong, ask your chairperson, or sign in with a different account."
        actions={
          <>
            <Link
              to="/my-chamas"
              className="rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-on-dark transition hover:bg-primary-dark"
            >
              Go to my chamas
            </Link>
            <button
              type="button"
              onClick={() => keycloak.logout()}
              className="rounded-full border border-border-strong px-6 py-2.5 text-sm font-semibold text-ink transition hover:bg-paper-dim"
            >
              Sign out
            </button>
          </>
        }
      />
    )
  }

  return <>{children}</>
}
