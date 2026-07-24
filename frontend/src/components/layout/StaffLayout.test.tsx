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
const mockUseKeycloak = useKeycloak as ReturnType<typeof vi.fn>
const mockGetChama = getChama as ReturnType<typeof vi.fn>
const mockUseMyMembership = useMyMembership as ReturnType<typeof vi.fn>

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<StaffLayout />}>
          <Route path="/chamas" element={<div>Chamas Page</div>} />
          <Route path="/chamas/:chamaId/members" element={<div>Members Page</div>} />
          <Route path="/chamas/:chamaId/contributions" element={<div>Contributions Page</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

describe('StaffLayout', () => {
  const logout = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    mockUseKeycloak.mockReturnValue({
      keycloak: { logout, tokenParsed: { name: 'Grace Wanjiru', email: 'grace@example.com' } },
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
})
