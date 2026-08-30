import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import MyChamasPage from './MyChamasPage'

vi.mock('../../api/chamas', () => ({
  getMyChamas: vi.fn(),
  joinChama: vi.fn(),
}))

vi.mock('@react-keycloak/web', () => ({
  useKeycloak: vi.fn(),
}))

import { getMyChamas, joinChama } from '../../api/chamas'
import { useKeycloak } from '@react-keycloak/web'

const mockGetMyChamas = getMyChamas as ReturnType<typeof vi.fn>
const mockJoinChama = joinChama as ReturnType<typeof vi.fn>
const mockUseKeycloak = useKeycloak as ReturnType<typeof vi.fn>

const myChama = {
  id: 1,
  name: 'Tumaini',
  description: 'A savings group',
  type: 'MERRY_GO_ROUND' as const,
  currency: 'KES',
  contributionFrequency: 'MONTHLY' as const,
  contributionAmount: 500,
  roles: ['CHAIRPERSON'] as const,
  superAdmin: false,
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/my-chamas']}>
      <Routes>
        <Route path="/my-chamas" element={<MyChamasPage />} />
        <Route path="/chamas/:chamaId/dashboard" element={<div>Dashboard Page</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('MyChamasPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetMyChamas.mockResolvedValue([myChama])
    mockUseKeycloak.mockReturnValue({
      keycloak: { tokenParsed: { given_name: 'Ann', name: 'Ann Wanjiru' }, hasRealmRole: vi.fn().mockReturnValue(false) },
    })
  })

  it('lists the chamas the user belongs to with a role badge', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByText('Tumaini')).toBeTruthy())
    expect(screen.getByText('Chairperson')).toBeTruthy()
    expect(screen.getByText(/A savings group/)).toBeTruthy()
  })

  it('greets the member by their first name', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByText('Hello, Ann')).toBeTruthy())
  })

  it('falls back to splitting the full name when given_name is absent', async () => {
    mockUseKeycloak.mockReturnValue({ keycloak: { tokenParsed: { name: 'Peter Otieno' }, hasRealmRole: vi.fn().mockReturnValue(false) } })
    renderPage()
    await waitFor(() => expect(screen.getByText('Hello, Peter')).toBeTruthy())
  })

  it('omits the greeting when no name claim is present', async () => {
    mockUseKeycloak.mockReturnValue({ keycloak: { tokenParsed: {}, hasRealmRole: vi.fn().mockReturnValue(false) } })
    renderPage()
    await waitFor(() => expect(screen.getByText('Tumaini')).toBeTruthy())
    expect(screen.queryByText(/^Hello,/)).toBeNull()
  })

  it('shows a platform-admin badge for super admin entries', async () => {
    mockGetMyChamas.mockResolvedValue([{ ...myChama, roles: [], superAdmin: true }])
    renderPage()
    await waitFor(() => expect(screen.getByText('Platform admin')).toBeTruthy())
  })

  it('navigates to the chama dashboard when a card is clicked', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByText('Tumaini')).toBeTruthy())
    fireEvent.click(screen.getByText('Tumaini'))
    await waitFor(() => expect(screen.getByText('Dashboard Page')).toBeTruthy())
  })

  it('shows an empty state with a link to start a chama', async () => {
    mockGetMyChamas.mockResolvedValue([])
    renderPage()
    await waitFor(() => expect(screen.getByText(/not part of any chama/i)).toBeTruthy())
    expect(screen.getByRole('link', { name: /start one/i })).toHaveAttribute('href', '/chamas')
  })

  it('links to the chama management page', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByText('Tumaini')).toBeTruthy())
    expect(screen.getByRole('link', { name: /manage chamas/i })).toHaveAttribute('href', '/chamas')
  })

  it('joins a chama via the join modal and navigates to its dashboard', async () => {
    mockJoinChama.mockResolvedValue({ id: 9, chamaId: 42, fullName: 'New Joiner' })
    renderPage()
    await waitFor(() => expect(screen.getByText('Tumaini')).toBeTruthy())

    fireEvent.click(screen.getByRole('button', { name: /join a chama/i }))
    fireEvent.change(screen.getByLabelText(/join code/i), { target: { value: 'ab12cd34' } })
    fireEvent.change(screen.getByLabelText(/your full name/i), { target: { value: 'New Joiner' } })
    fireEvent.change(document.querySelector('input[type="tel"]')!, { target: { value: '+254700000099' } })
    fireEvent.click(screen.getByRole('button', { name: /^join chama$/i }))

    await waitFor(() =>
      expect(mockJoinChama).toHaveBeenCalledWith(
        expect.objectContaining({ joinCode: 'AB12CD34', fullName: 'New Joiner' }),
      ),
    )
    await waitFor(() => expect(screen.getByText('Dashboard Page')).toBeTruthy())
  })

  it('shows an error inside the join modal when the code is invalid', async () => {
    mockJoinChama.mockRejectedValue(new Error('Chama not found'))
    renderPage()
    await waitFor(() => expect(screen.getByText('Tumaini')).toBeTruthy())

    fireEvent.click(screen.getByRole('button', { name: /join a chama/i }))
    fireEvent.change(screen.getByLabelText(/join code/i), { target: { value: 'NOPE0000' } })
    fireEvent.change(screen.getByLabelText(/your full name/i), { target: { value: 'New Joiner' } })
    fireEvent.change(document.querySelector('input[type="tel"]')!, { target: { value: '+254700000099' } })
    fireEvent.click(screen.getByRole('button', { name: /^join chama$/i }))

    await waitFor(() => expect(screen.getByText('Chama not found')).toBeTruthy())
  })

  it('redirects a SUPER_ADMIN to the platform overview instead of listing chamas', async () => {
    mockUseKeycloak.mockReturnValue({
      keycloak: { tokenParsed: { given_name: 'Ann' }, hasRealmRole: vi.fn().mockReturnValue(true) },
    })
    render(
      <MemoryRouter initialEntries={['/my-chamas']}>
        <Routes>
          <Route path="/my-chamas" element={<MyChamasPage />} />
          <Route path="/admin/overview" element={<div>Platform Overview Page</div>} />
        </Routes>
      </MemoryRouter>,
    )
    await waitFor(() => expect(screen.getByText('Platform Overview Page')).toBeTruthy())
    expect(mockGetMyChamas).not.toHaveBeenCalled()
  })

  it('distinguishes a failed load from an empty list', async () => {
    mockGetMyChamas.mockRejectedValue(new Error('Service unavailable'))
    renderPage()

    expect(await screen.findByTestId('load-failed')).toBeTruthy()
    expect(screen.getByText('Service unavailable')).toBeTruthy()
    // A request that failed is not an account with nothing in it. Saying the second when the first
    // happened states something false and then invites the reader to act on it.
    expect(screen.queryByText(/not part of any chama/i)).toBeNull()
  })
})
