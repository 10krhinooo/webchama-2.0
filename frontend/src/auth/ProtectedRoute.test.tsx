import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import ProtectedRoute from './ProtectedRoute'

vi.mock('@react-keycloak/web', () => ({
  useKeycloak: vi.fn(),
}))

import { useKeycloak } from '@react-keycloak/web'
const mockUseKeycloak = useKeycloak as ReturnType<typeof vi.fn>

function renderProtected(roles?: string[]) {
  // The forbidden screen offers a way out as a router link, so this needs a router around it.
  return render(
    <MemoryRouter>
      <ProtectedRoute roles={roles}>
        <div>Protected Content</div>
      </ProtectedRoute>
    </MemoryRouter>,
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
    expect(screen.getByText(/signing you in/i)).toBeTruthy()
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
    expect(screen.getByRole('heading', { name: /do not have access/i })).toBeTruthy()
    expect(screen.getByText('403')).toBeTruthy()
    expect(screen.queryByText('Protected Content')).toBeNull()
  })

  it('logs out when Sign out is clicked on the access-denied screen', () => {
    const logout = vi.fn()
    mockUseKeycloak.mockReturnValue({
      keycloak: { authenticated: true, hasRealmRole: () => false, login: vi.fn(), logout },
      initialized: true,
    })
    renderProtected(['SUPER_ADMIN'])
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }))
    expect(logout).toHaveBeenCalledTimes(1)
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
