import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import StaffLayout from './StaffLayout'

vi.mock('@react-keycloak/web', () => ({
  useKeycloak: vi.fn(),
}))

vi.mock('../../api/chamas', () => ({
  getChama: vi.fn(),
}))

vi.mock('../../hooks/useMyMembership', () => ({
  useMyMembership: vi.fn(),
}))

import { useKeycloak } from '@react-keycloak/web'
import { getChama } from '../../api/chamas'
import { useMyMembership } from '../../hooks/useMyMembership'
import ThemeProvider from '../../theme/ThemeProvider'
const mockUseKeycloak = useKeycloak as ReturnType<typeof vi.fn>
const mockGetChama = getChama as ReturnType<typeof vi.fn>
const mockUseMyMembership = useMyMembership as ReturnType<typeof vi.fn>

function renderAt(path: string) {
  return render(
    <ThemeProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route element={<StaffLayout />}>
            <Route path="/chamas" element={<div>Chamas Page</div>} />
            <Route path="/chamas/:chamaId/members" element={<div>Members Page</div>} />
            <Route path="/chamas/:chamaId/contributions" element={<div>Contributions Page</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </ThemeProvider>,
  )
}

describe('StaffLayout', () => {
  const logout = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    mockUseKeycloak.mockReturnValue({
      keycloak: {
        logout,
        tokenParsed: { name: 'Grace Wanjiru', email: 'grace@example.com' },
        hasRealmRole: vi.fn().mockReturnValue(false),
      },
    })
    mockGetChama.mockResolvedValue({ id: 7, name: 'Tumaini Chama' })
    mockUseMyMembership.mockReturnValue({
      roles: [],
      isSuperAdmin: false,
      isManager: false,
      loading: false,
    })
  })

  it('always shows the Chamas nav link and renders the routed page', () => {
    renderAt('/chamas')
    expect(screen.getByText('Chamas Page')).toBeTruthy()
    expect(screen.getAllByRole('link', { name: /chamas/i }).length).toBeGreaterThan(0)
  })

  it('shows Members and Contributions sub-nav only once a chama is in the URL', () => {
    renderAt('/chamas/7/members')
    expect(screen.getByText('Members Page')).toBeTruthy()
    expect(screen.getByRole('link', { name: /members/i })).toBeTruthy()
    expect(screen.getByRole('link', { name: /contributions/i })).toBeTruthy()
  })

  it('shows the Resolutions nav link once a chama is in the URL', () => {
    renderAt('/chamas/7/members')
    expect(screen.getByRole('link', { name: /resolutions/i })).toBeTruthy()
  })

  it('does not show the chama sub-nav on the top-level chamas list', () => {
    renderAt('/chamas')
    expect(screen.queryByText('This chama')).toBeNull()
  })

  it('logs out when the log out button is clicked', () => {
    renderAt('/chamas')
    fireEvent.click(screen.getByText('Grace Wanjiru'))
    fireEvent.click(screen.getByText('Log out'))
    expect(logout).toHaveBeenCalledTimes(1)
  })

  it('shows the current user\'s name in the topbar', () => {
    renderAt('/chamas')
    expect(screen.getByText('Grace Wanjiru')).toBeTruthy()
  })

  it('shows the active chama name in the breadcrumb once it loads', async () => {
    renderAt('/chamas/7/members')
    await waitFor(() => expect(screen.getByText('Tumaini Chama')).toBeTruthy())
    expect(mockGetChama).toHaveBeenCalledWith(7)
  })

  it('omits the chama breadcrumb on the top-level chamas list', () => {
    renderAt('/chamas')
    expect(screen.queryByText('Tumaini Chama')).toBeNull()
    expect(mockGetChama).not.toHaveBeenCalled()
  })

  it('hides the Documents and Approvals links for a plain member', () => {
    mockUseMyMembership.mockReturnValue({ roles: ['MEMBER'], isSuperAdmin: false, isManager: false, loading: false })
    renderAt('/chamas/7/members')
    expect(screen.queryByRole('link', { name: /documents/i })).toBeNull()
    expect(screen.queryByRole('link', { name: /approvals/i })).toBeNull()
    expect(screen.getByText('Member')).toBeTruthy()
  })

  it('shows the Documents and Approvals links and role badge for a chairperson', () => {
    mockUseMyMembership.mockReturnValue({
      roles: ['CHAIRPERSON'],
      isSuperAdmin: false,
      isManager: true,
      loading: false,
    })
    renderAt('/chamas/7/members')
    expect(screen.getByRole('link', { name: /documents/i })).toBeTruthy()
    expect(screen.getByRole('link', { name: /approvals/i })).toBeTruthy()
    expect(screen.getByText('Chairperson')).toBeTruthy()
  })

  it('shows the Documents link and a platform-admin badge for SUPER_ADMIN', () => {
    mockUseMyMembership.mockReturnValue({ roles: [], isSuperAdmin: true, isManager: true, loading: false })
    renderAt('/chamas/7/members')
    expect(screen.getByRole('link', { name: /documents/i })).toBeTruthy()
    expect(screen.getByText('Platform admin')).toBeTruthy()
  })

  it('hides the Documents link and role badge while the role lookup is still loading', () => {
    mockUseMyMembership.mockReturnValue({ roles: [], isSuperAdmin: false, isManager: false, loading: true })
    renderAt('/chamas/7/members')
    expect(screen.queryByRole('link', { name: /documents/i })).toBeNull()
    expect(screen.queryByText('Member')).toBeNull()
  })

  it('hides the Platform Overview link for a plain user', () => {
    renderAt('/chamas')
    expect(screen.queryByRole('link', { name: /platform overview/i })).toBeNull()
  })

  it('shows the Platform Overview and Security Events links, and hides My Chamas, for a SUPER_ADMIN realm role holder', () => {
    mockUseKeycloak.mockReturnValue({
      keycloak: {
        logout,
        tokenParsed: { name: 'Grace Wanjiru', email: 'grace@example.com' },
        hasRealmRole: vi.fn().mockReturnValue(true),
      },
    })
    renderAt('/chamas')
    expect(screen.getAllByRole('link', { name: /platform overview/i }).length).toBeGreaterThan(0)
    expect(screen.getByRole('link', { name: /security events/i })).toBeTruthy()
    expect(screen.queryByRole('link', { name: /my chamas/i })).toBeNull()
  })

  it('shows the My Chamas link for a plain user', () => {
    renderAt('/chamas')
    expect(screen.getAllByRole('link', { name: /my chamas/i }).length).toBeGreaterThan(0)
  })

  it('opens the mobile nav backdrop from the header menu button and closes it from the drawer close button', () => {
    renderAt('/chamas')
    expect(document.querySelector('[data-testid="nav-backdrop"]')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /open menu/i }))
    expect(document.querySelector('[data-testid="nav-backdrop"]')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /close menu/i }))
    expect(document.querySelector('[data-testid="nav-backdrop"]')).toBeNull()
  })

  it('closes the mobile nav drawer when the backdrop is clicked', () => {
    renderAt('/chamas')
    fireEvent.click(screen.getByRole('button', { name: /open menu/i }))
    const backdrop = document.querySelector('[data-testid="nav-backdrop"]')
    expect(backdrop).toBeTruthy()
    fireEvent.click(backdrop as Element)
    expect(document.querySelector('[data-testid="nav-backdrop"]')).toBeNull()
  })

  it('falls back to the preferred username when the token has no name', () => {
    mockUseKeycloak.mockReturnValue({
      keycloak: {
        logout,
        tokenParsed: { preferred_username: 'grace_w' },
        hasRealmRole: vi.fn().mockReturnValue(false),
      },
    })
    renderAt('/chamas')
    expect(screen.getByText('grace_w')).toBeTruthy()
  })

  it('falls back to "Account" when the token has no name or username', () => {
    mockUseKeycloak.mockReturnValue({
      keycloak: {
        logout,
        tokenParsed: undefined,
        hasRealmRole: vi.fn().mockReturnValue(false),
      },
    })
    renderAt('/chamas')
    expect(screen.getByText('Account')).toBeTruthy()
  })

  it('shows a "?" avatar when the display name has no initials to show', () => {
    mockUseKeycloak.mockReturnValue({
      keycloak: {
        logout,
        tokenParsed: { name: '' },
        hasRealmRole: vi.fn().mockReturnValue(false),
      },
    })
    renderAt('/chamas')
    expect(screen.getByText('?')).toBeTruthy()
  })
})
