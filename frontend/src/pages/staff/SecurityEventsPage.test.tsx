import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import SecurityEventsPage from './SecurityEventsPage'

vi.mock('../../api/securityEvents', () => ({
  getSecurityEvents: vi.fn(),
}))

import { getSecurityEvents } from '../../api/securityEvents'

const mockGetSecurityEvents = getSecurityEvents as ReturnType<typeof vi.fn>

const events = [
  {
    id: 1,
    source: 'LOGIN' as const,
    eventTime: '2026-07-26T08:00:00Z',
    type: 'LOGIN_ERROR',
    keycloakUserId: 'user-1',
    ipAddress: '10.0.0.5',
    clientId: 'webchama-frontend',
    error: 'user_temporarily_disabled',
    resourceType: null,
    resourcePath: null,
  },
  {
    id: 2,
    source: 'ADMIN' as const,
    eventTime: '2026-07-26T09:00:00Z',
    type: 'CREATE',
    keycloakUserId: 'admin-1',
    ipAddress: '10.0.0.6',
    clientId: 'admin-cli',
    error: null,
    resourceType: 'USER',
    resourcePath: 'users/abc',
  },
]

function renderPage() {
  return render(<SecurityEventsPage />)
}

describe('SecurityEventsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('lists security events once loaded', async () => {
    mockGetSecurityEvents.mockResolvedValue(events)
    renderPage()

    await waitFor(() => expect(screen.getByText('LOGIN_ERROR')).toBeTruthy())
    expect(screen.getByText('CREATE')).toBeTruthy()
    expect(screen.getByText('user-1')).toBeTruthy()
    expect(screen.getByText('user_temporarily_disabled')).toBeTruthy()
  })

  it('shows an empty state when there are no events', async () => {
    mockGetSecurityEvents.mockResolvedValue([])
    renderPage()

    await waitFor(() => expect(screen.getByText('No security events found.')).toBeTruthy())
  })

  it('shows the backend error message when the request fails', async () => {
    mockGetSecurityEvents.mockRejectedValue(new Error('Forbidden'))
    renderPage()

    await waitFor(() => expect(screen.getByText('Forbidden')).toBeTruthy())
  })

  it('re-fetches with the entered filters when the filter form is submitted', async () => {
    mockGetSecurityEvents.mockResolvedValue(events)
    renderPage()
    await waitFor(() => expect(mockGetSecurityEvents).toHaveBeenCalledWith({ type: undefined, error: undefined, keycloakUserId: undefined }))

    fireEvent.change(screen.getByPlaceholderText('Type (e.g. LOGIN_ERROR)'), { target: { value: 'LOGIN_ERROR' } })
    fireEvent.change(screen.getByPlaceholderText('Error (e.g. user_temporarily_disabled)'), { target: { value: 'user_temporarily_disabled' } })
    fireEvent.click(screen.getByText('Filter'))

    await waitFor(() =>
      expect(mockGetSecurityEvents).toHaveBeenCalledWith({
        type: 'LOGIN_ERROR',
        error: 'user_temporarily_disabled',
        keycloakUserId: undefined,
      }),
    )
  })
})
