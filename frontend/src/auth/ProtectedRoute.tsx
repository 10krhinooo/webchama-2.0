import { useEffect } from 'react'
import { useKeycloak } from '@react-keycloak/web'
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
        <WeaveMark className="h-8 w-8 animate-pulse text-brand" />
        <p>Loading…</p>
      </div>
    )
  }

  if (roles && roles.length > 0 && !roles.some((r) => keycloak.hasRealmRole(r))) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-paper px-6 text-center">
        <WeaveMark className="h-8 w-8 text-danger" />
        <p className="font-semibold text-danger">Access denied: your account doesn&rsquo;t hold the role this page needs.</p>
        <button
          onClick={() => keycloak.logout()}
          className="font-medium text-brand underline hover:text-primary-dark"
        >
          Log out
        </button>
      </div>
    )
  }

  return <>{children}</>
}
