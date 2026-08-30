import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

const navigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => navigate }
})

vi.mock('../../hooks/useNotifications')

import NotificationBell from './NotificationBell'
import { useNotifications } from '../../hooks/useNotifications'
import type { Notification } from '../../api/notifications'

const mockUseNotifications = useNotifications as ReturnType<typeof vi.fn>
const markRead = vi.fn()
const markAllRead = vi.fn()

function notification(overrides: Partial<Notification> = {}): Notification {
  return {
    id: 1,
    chamaId: 4,
    eventFamily: 'LOAN',
    title: 'Loan approved',
    body: 'Your loan of KES 10,000 was approved.',
    link: '/chamas/4/loans',
    readAt: null,
    createdAt: new Date().toISOString(),
    ...overrides,
  }
}

function setup(notifications: Notification[], unread = notifications.filter((n) => !n.readAt).length) {
  mockUseNotifications.mockReturnValue({
    notifications,
    unread,
    loading: false,
    markRead,
    markAllRead,
    refresh: vi.fn(),
  })
  return render(
    <MemoryRouter>
      <NotificationBell />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('NotificationBell', () => {
  it('announces the unread count rather than relying on the badge alone', () => {
    setup([notification(), notification({ id: 2 })])
    expect(screen.getByTestId('notification-bell')).toHaveAttribute(
      'aria-label',
      'Notifications, 2 unread',
    )
  })

  it('drops the count from the label when everything is read', () => {
    setup([notification({ readAt: new Date().toISOString() })])
    expect(screen.getByTestId('notification-bell')).toHaveAttribute('aria-label', 'Notifications')
    expect(screen.queryByTestId('notification-badge')).toBeNull()
  })

  it('caps the badge so a large count cannot break the layout', () => {
    setup([notification()], 42)
    expect(screen.getByTestId('notification-badge')).toHaveTextContent('9+')
  })

  it('opens and closes the panel', () => {
    setup([notification()])
    const bell = screen.getByTestId('notification-bell')

    fireEvent.click(bell)
    expect(screen.getByTestId('notification-panel')).toBeTruthy()
    expect(bell).toHaveAttribute('aria-expanded', 'true')

    fireEvent.click(bell)
    expect(screen.queryByTestId('notification-panel')).toBeNull()
  })

  it('closes on Escape, since the panel is ambient rather than a task to finish', () => {
    setup([notification()])
    fireEvent.click(screen.getByTestId('notification-bell'))
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByTestId('notification-panel')).toBeNull()
  })

  it('closes on an outside click', () => {
    setup([notification()])
    fireEvent.click(screen.getByTestId('notification-bell'))
    fireEvent.mouseDown(document.body)
    expect(screen.queryByTestId('notification-panel')).toBeNull()
  })

  it('stays open when clicking inside the panel', () => {
    setup([notification()])
    fireEvent.click(screen.getByTestId('notification-bell'))
    fireEvent.mouseDown(screen.getByTestId('notification-panel'))
    expect(screen.getByTestId('notification-panel')).toBeTruthy()
  })

  it('marks a notification read and follows its link', async () => {
    setup([notification()])
    fireEvent.click(screen.getByTestId('notification-bell'))
    fireEvent.click(screen.getByText('Loan approved'))

    await waitFor(() => expect(markRead).toHaveBeenCalledWith(1))
    expect(navigate).toHaveBeenCalledWith('/chamas/4/loans')
  })

  it('does not mark an already read notification again', async () => {
    setup([notification({ readAt: new Date().toISOString() })])
    fireEvent.click(screen.getByTestId('notification-bell'))
    fireEvent.click(screen.getByText('Loan approved'))

    await waitFor(() => expect(navigate).toHaveBeenCalled())
    expect(markRead).not.toHaveBeenCalled()
  })

  it('navigates nowhere when a notification has no link', async () => {
    setup([notification({ link: null })])
    fireEvent.click(screen.getByTestId('notification-bell'))
    fireEvent.click(screen.getByText('Loan approved'))

    await waitFor(() => expect(markRead).toHaveBeenCalledWith(1))
    expect(navigate).not.toHaveBeenCalled()
  })

  it('marks everything read from the panel', () => {
    setup([notification(), notification({ id: 2 })])
    fireEvent.click(screen.getByTestId('notification-bell'))
    fireEvent.click(screen.getByRole('button', { name: /mark all read/i }))
    expect(markAllRead).toHaveBeenCalled()
  })

  it('offers no mark-all action when nothing is unread', () => {
    setup([notification({ readAt: new Date().toISOString() })])
    fireEvent.click(screen.getByTestId('notification-bell'))
    expect(screen.queryByRole('button', { name: /mark all read/i })).toBeNull()
  })

  it('says so when the inbox is empty', () => {
    setup([])
    fireEvent.click(screen.getByTestId('notification-bell'))
    expect(screen.getByText('Nothing yet.')).toBeTruthy()
  })

  it('shows a relative time for each notification', () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
    setup([notification({ createdAt: twoHoursAgo })])
    fireEvent.click(screen.getByTestId('notification-bell'))
    expect(screen.getByText('2h ago')).toBeTruthy()
  })

  it('shows days for anything older than a day', () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
    setup([notification({ createdAt: threeDaysAgo })])
    fireEvent.click(screen.getByTestId('notification-bell'))
    expect(screen.getByText('3d ago')).toBeTruthy()
  })

  it('shows minutes and just now for recent notifications', () => {
    const { unmount } = setup([notification({ createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString() })])
    fireEvent.click(screen.getByTestId('notification-bell'))
    expect(screen.getByText('5m ago')).toBeTruthy()
    unmount()

    setup([notification({ createdAt: new Date().toISOString() })])
    fireEvent.click(screen.getByTestId('notification-bell'))
    expect(screen.getByText('just now')).toBeTruthy()
  })
})
