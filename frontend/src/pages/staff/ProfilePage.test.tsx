import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.mock('../../api/chamas', () => ({ getMyChamas: vi.fn() }))
vi.mock('../../api/members', () => ({ exportMyData: vi.fn() }))
vi.mock('../../utils/download', () => ({ downloadBlob: vi.fn() }))

const mockUseKeycloak = vi.fn()
vi.mock('@react-keycloak/web', () => ({ useKeycloak: () => mockUseKeycloak() }))

import ProfilePage from './ProfilePage'
import { getMyChamas } from '../../api/chamas'
import { exportMyData } from '../../api/members'
import { downloadBlob } from '../../utils/download'

const mockGetMyChamas = getMyChamas as ReturnType<typeof vi.fn>
const mockExport = exportMyData as ReturnType<typeof vi.fn>
const mockDownload = downloadBlob as ReturnType<typeof vi.fn>

const membership = {
  id: 3,
  name: 'Tumaini',
  description: null,
  type: 'MERRY_GO_ROUND' as const,
  currency: 'KES',
  contributionFrequency: 'MONTHLY' as const,
  contributionAmount: 500,
  roles: ['CHAIRPERSON' as const],
  superAdmin: false,
}

function renderPage() {
  return render(
    <MemoryRouter>
      <ProfilePage />
    </MemoryRouter>,
  )
}

describe('ProfilePage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetMyChamas.mockResolvedValue([membership])
    mockUseKeycloak.mockReturnValue({
      keycloak: {
        tokenParsed: { name: 'Grace Wanjiru', preferred_username: 'chairperson1', email: 'grace@example.com' },
      },
    })
  })

  it('shows who the reader is signed in as', async () => {
    renderPage()
    expect(await screen.findByRole('heading', { name: 'Grace Wanjiru' })).toBeTruthy()
    expect(screen.getByText('chairperson1')).toBeTruthy()
    expect(screen.getByText('grace@example.com')).toBeTruthy()
  })

  it('falls back to the username when the token carries no name', async () => {
    mockUseKeycloak.mockReturnValue({
      keycloak: { tokenParsed: { preferred_username: 'member1' } },
    })
    renderPage()
    expect(await screen.findByRole('heading', { name: 'member1' })).toBeTruthy()
  })

  it('sends people to the sign-in service for their password rather than holding one here', async () => {
    renderPage()
    const link = await screen.findByRole('link', { name: /change your password/i })
    expect(link.getAttribute('href')).toContain('/realms/chama/account')
  })

  it('lists each membership with the role held in it', async () => {
    renderPage()
    expect(await screen.findByRole('link', { name: 'Tumaini' })).toBeTruthy()
    expect(screen.getByText('Chairperson')).toBeTruthy()
  })

  it('downloads the reader\'s own data for one chama', async () => {
    mockExport.mockResolvedValue({ member: { fullName: 'Grace' } })
    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: 'Download my data' }))

    await waitFor(() => expect(mockExport).toHaveBeenCalledWith(3))
    expect(mockDownload).toHaveBeenCalledWith(
      'webchama-my-data-tumaini.json',
      expect.any(Blob),
    )
    expect(await screen.findByText(/Tumaini data has been downloaded/)).toBeTruthy()
  })

  it('says why when the export fails', async () => {
    mockExport.mockRejectedValue(new Error('Forbidden'))
    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: 'Download my data' }))

    expect(await screen.findByText('Forbidden')).toBeTruthy()
  })

  it('distinguishes a failed load from belonging to no chama', async () => {
    mockGetMyChamas.mockRejectedValue(new Error('Service unavailable'))
    renderPage()

    expect(await screen.findByTestId('load-failed')).toBeTruthy()
    expect(screen.queryByText(/not part of any chama/i)).toBeNull()
  })

  it('says so plainly when the reader belongs to no chama', async () => {
    mockGetMyChamas.mockResolvedValue([])
    renderPage()

    expect(await screen.findByText(/not part of any chama/i)).toBeTruthy()
  })
})
