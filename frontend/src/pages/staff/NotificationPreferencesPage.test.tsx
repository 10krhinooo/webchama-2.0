import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

vi.mock('../../api/notifications', async () => {
  const actual = await vi.importActual<typeof import('../../api/notifications')>('../../api/notifications')
  return {
    ...actual,
    getNotificationPreferences: vi.fn(),
    updateNotificationPreferences: vi.fn(),
  }
})

import NotificationPreferencesPage from './NotificationPreferencesPage'
import {
  getNotificationPreferences,
  updateNotificationPreferences,
  EVENT_FAMILY_LABELS,
} from '../../api/notifications'

const mockGet = getNotificationPreferences as ReturnType<typeof vi.fn>
const mockUpdate = updateNotificationPreferences as ReturnType<typeof vi.fn>

beforeEach(() => {
  vi.clearAllMocks()
  mockGet.mockResolvedValue([])
})

describe('NotificationPreferencesPage', () => {
  it('lists every event family with a readable label', async () => {
    render(<NotificationPreferencesPage />)
    await screen.findByLabelText('Loans in app')

    for (const label of Object.values(EVENT_FAMILY_LABELS)) {
      expect(screen.getByText(label)).toBeTruthy()
    }
  })

  it('treats an absent row as both channels on, so nothing is silently muted', async () => {
    render(<NotificationPreferencesPage />)
    const inApp = await screen.findByLabelText('Loans in app')
    expect(inApp).toBeChecked()
    expect(screen.getByLabelText('Loans email')).toBeChecked()
  })

  it('reflects a stored preference', async () => {
    mockGet.mockResolvedValue([{ eventFamily: 'LOAN', inAppEnabled: true, emailEnabled: false }])
    render(<NotificationPreferencesPage />)

    await waitFor(() => expect(screen.getByLabelText('Loans email')).not.toBeChecked())
    expect(screen.getByLabelText('Loans in app')).toBeChecked()
    // A family with no stored row is unaffected.
    expect(screen.getByLabelText('Penalties email')).toBeChecked()
  })

  it('toggles a channel and saves every family', async () => {
    mockUpdate.mockResolvedValue([{ eventFamily: 'LOAN', inAppEnabled: true, emailEnabled: false }])
    render(<NotificationPreferencesPage />)

    fireEvent.click(await screen.findByLabelText('Loans email'))
    fireEvent.click(screen.getByRole('button', { name: /save preferences/i }))

    await waitFor(() => expect(mockUpdate).toHaveBeenCalled())
    const sent = mockUpdate.mock.calls[0][0]
    expect(sent).toHaveLength(12)
    expect(sent.find((p: { eventFamily: string }) => p.eventFamily === 'LOAN')).toMatchObject({
      emailEnabled: false,
    })
  })

  it('confirms a successful save', async () => {
    mockUpdate.mockResolvedValue([])
    render(<NotificationPreferencesPage />)
    await screen.findByLabelText('Loans in app')

    fireEvent.click(screen.getByRole('button', { name: /save preferences/i }))
    expect(await screen.findByRole('status')).toHaveTextContent(/saved/i)
  })

  it('reports a failed save without discarding the pending changes', async () => {
    mockUpdate.mockRejectedValue(new Error('Conflict'))
    render(<NotificationPreferencesPage />)

    fireEvent.click(await screen.findByLabelText('Loans email'))
    fireEvent.click(screen.getByRole('button', { name: /save preferences/i }))

    expect(await screen.findByTestId('form-error')).toBeTruthy()
    expect(screen.getByLabelText('Loans email')).not.toBeChecked()
  })

  it('distinguishes a failed load from an all-defaults state', async () => {
    mockGet.mockRejectedValue(new Error('offline'))
    render(<NotificationPreferencesPage />)

    expect(await screen.findByTestId('form-error')).toBeTruthy()
    expect(screen.queryByLabelText('Loans in app')).toBeNull()
    expect(screen.getByRole('button', { name: /save preferences/i })).toBeDisabled()
  })

  it('labels each control with both the event and the channel', async () => {
    render(<NotificationPreferencesPage />)
    await screen.findByLabelText('Loans in app')

    // A row header alone would leave two checkboxes in the row with the same accessible name.
    expect(screen.getByLabelText('Meetings in app')).toBeTruthy()
    expect(screen.getByLabelText('Meetings email')).toBeTruthy()
  })
})
