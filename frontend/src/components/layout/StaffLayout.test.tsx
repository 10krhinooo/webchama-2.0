import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import StaffLayout from './StaffLayout'

vi.mock('@react-keycloak/web', () => ({
  useKeycloak: vi.fn(),
}))

import { useKeycloak } from '@react-keycloak/web'
const mockUseKeycloak = useKeycloak as ReturnType<typeof vi.fn>

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
    mockUseKeycloak.mockReturnValue({ keycloak: { logout } })
  })

  it('always shows the Chamas nav link and renders the routed page', () => {
    renderAt('/chamas')
    expect(screen.getByText('Chamas Page')).toBeTruthy()
    expect(screen.getByRole('link', { name: /chamas/i })).toBeTruthy()
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
    fireEvent.click(screen.getByText('Log out'))
    expect(logout).toHaveBeenCalledTimes(1)
  })
})
