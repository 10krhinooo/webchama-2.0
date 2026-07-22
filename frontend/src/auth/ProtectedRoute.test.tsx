import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import ProtectedRoute from './ProtectedRoute'

vi.mock('@react-keycloak/web', () => ({
  useKeycloak: vi.fn(),
}))

import { useKeycloak } from '@react-keycloak/web'
const mockUseKeycloak = useKeycloak as ReturnType<typeof vi.fn>

function renderProtected(roles?: string[]) {
  return render(
    <ProtectedRoute roles={roles}>
      <div>Protected Content</div>
    </ProtectedRoute>,
  )
}

describe('ProtectedRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows a loading state while Keycloak is not yet initialized', () => {
    mockUseKeycloak.mockReturnValue({
      keycloak: { authenticated: false, hasRealmRole: () => false, login: vi.fn() },
      initialized: false,
    })
    renderProtected()
    expect(screen.getByText('Loading…')).toBeTruthy()
    expect(screen.queryByText('Protected Content')).toBeNull()
  })

  it('triggers keycloak.login() when initialized but unauthenticated', () => {
    const login = vi.fn()
    mockUseKeycloak.mockReturnValue({
      keycloak: { authenticated: false, hasRealmRole: () => false, login },
      initialized: true,
    })
    renderProtected()
    expect(login).toHaveBeenCalledTimes(1)
    expect(screen.queryByText('Protected Content')).toBeNull()
  })

  it('renders children when authenticated and no roles are required', () => {
    mockUseKeycloak.mockReturnValue({
      keycloak: { authenticated: true, hasRealmRole: () => false, login: vi.fn() },
      initialized: true,
    })
    renderProtected()
    expect(screen.getByText('Protected Content')).toBeTruthy()
  })

  it('shows an access-denied message when authenticated but missing all required roles', () => {
    const logout = vi.fn()
    mockUseKeycloak.mockReturnValue({
      keycloak: { authenticated: true, hasRealmRole: () => false, login: vi.fn(), logout },
      initialized: true,
    })
    renderProtected(['TREASURER'])
    expect(screen.getByText(/access denied/i)).toBeTruthy()
    expect(screen.queryByText('Protected Content')).toBeNull()
  })

  it('renders children when authenticated and holding one of the required roles', () => {
    mockUseKeycloak.mockReturnValue({
      keycloak: {
        authenticated: true,
        hasRealmRole: (r: string) => r === 'CHAIRPERSON',
        login: vi.fn(),
      },
      initialized: true,
    })
    renderProtected(['TREASURER', 'CHAIRPERSON'])
    expect(screen.getByText('Protected Content')).toBeTruthy()
  })
})
