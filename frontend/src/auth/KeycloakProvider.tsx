import { type ReactNode, useEffect } from 'react'
import Keycloak from 'keycloak-js'
import { ReactKeycloakProvider } from '@react-keycloak/web'
import { client } from '../api/client'

const keycloak = new Keycloak({
  url: import.meta.env.VITE_KEYCLOAK_URL ?? 'http://localhost:8180',
  realm: 'chama',
  clientId: 'webchama-frontend',
})

client.interceptors.request.use((config) => {
  if (keycloak.token) {
    config.headers.Authorization = `Bearer ${keycloak.token}`
  }
  return config
})

function TokenRefresh() {
  useEffect(() => {
    const id = setInterval(() => {
      keycloak.updateToken(30)
    }, 20_000)
    return () => clearInterval(id)
  }, [])
  return null
}

export default function KeycloakProvider({ children }: { children: ReactNode }) {
  return (
    <ReactKeycloakProvider authClient={keycloak} initOptions={{ onLoad: 'check-sso' }}>
      <TokenRefresh />
      {children}
    </ReactKeycloakProvider>
  )
}

export { keycloak }
