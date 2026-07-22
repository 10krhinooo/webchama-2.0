import { useEffect } from 'react'
import { useKeycloak } from '@react-keycloak/web'

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
    return <div className="min-h-screen flex items-center justify-center text-muted">Loading…</div>
  }

  if (roles && roles.length > 0 && !roles.some((r) => keycloak.hasRealmRole(r))) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="text-danger font-semibold">Access denied: insufficient role.</p>
        <button
          onClick={() => keycloak.logout()}
          className="text-primary hover:text-primary-dark font-medium underline"
        >
          Log out
        </button>
      </div>
    )
  }

  return <>{children}</>
}
