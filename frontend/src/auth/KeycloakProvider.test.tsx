import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'

const { updateToken, fakeKeycloak } = vi.hoisted(() => ({
  updateToken: vi.fn(),
  fakeKeycloak: { token: 'fake-token' as string | undefined },
}))

vi.mock('keycloak-js', () => ({
  default: vi.fn().mockImplementation(function FakeKeycloak() {
    return { get token() {
      return fakeKeycloak.token
    }, updateToken }
  }),
}))

vi.mock('@react-keycloak/web', () => ({
  ReactKeycloakProvider: ({ children }: { children: React.ReactNode }) => children,
}))

import KeycloakProvider from './KeycloakProvider'
import { client } from '../api/client'

describe('KeycloakProvider', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
    fakeKeycloak.token = 'fake-token'
  })

  it('renders its children', () => {
    render(
      <KeycloakProvider>
        <div>Child Content</div>
      </KeycloakProvider>,
    )
    expect(screen.getByText('Child Content')).toBeTruthy()
  })

  it('refreshes the token on an interval', () => {
    vi.useFakeTimers()
    render(
      <KeycloakProvider>
        <div />
      </KeycloakProvider>,
    )
    vi.advanceTimersByTime(20_000)
    expect(updateToken).toHaveBeenCalledWith(30)
  })

  it('attaches the Authorization header via the axios interceptor when a token is present', () => {
    render(
      <KeycloakProvider>
        <div />
      </KeycloakProvider>,
    )
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handlers = (client.interceptors.request as any).handlers
    const config = handlers[handlers.length - 1].fulfilled({ headers: {} })
    expect(config.headers.Authorization).toBe('Bearer fake-token')
  })

  // Before Keycloak finishes initialising there is no token yet. The interceptor has to leave the
  // request alone rather than sending the literal "Bearer undefined", which the backend would
  // reject as a malformed credential instead of treating the call as anonymous.
  it('leaves the Authorization header unset when there is no token yet', () => {
    fakeKeycloak.token = undefined
    render(
      <KeycloakProvider>
        <div />
      </KeycloakProvider>,
    )
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handlers = (client.interceptors.request as any).handlers
    const config = handlers[handlers.length - 1].fulfilled({ headers: {} })
    expect(config.headers.Authorization).toBeUndefined()
  })
})
