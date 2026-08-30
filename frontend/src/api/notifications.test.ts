import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./client', () => ({
  client: {
    get: vi.fn(),
    put: vi.fn(),
  },
}))

import { client } from './client'
import {
  getNotifications,
  getUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
  getNotificationPreferences,
  updateNotificationPreferences,
  EVENT_FAMILY_LABELS,
  type Notification,
} from './notifications'

const notification = { id: 1, title: 'Loan approved' } as Notification

beforeEach(() => {
  vi.clearAllMocks()
})

describe('notifications api', () => {
  it('lists notifications with paging defaults', async () => {
    ;(client.get as ReturnType<typeof vi.fn>).mockResolvedValue({ data: [notification] })
    await expect(getNotifications()).resolves.toEqual([notification])
    expect(client.get).toHaveBeenCalledWith('/notifications', {
      params: { unreadOnly: false, page: 0, size: 20 },
    })
  })

  it('can ask for unread only', async () => {
    ;(client.get as ReturnType<typeof vi.fn>).mockResolvedValue({ data: [] })
    await getNotifications(true, 2, 50)
    expect(client.get).toHaveBeenCalledWith('/notifications', {
      params: { unreadOnly: true, page: 2, size: 50 },
    })
  })

  it('unwraps the unread count', async () => {
    ;(client.get as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { unread: 7 } })
    await expect(getUnreadCount()).resolves.toBe(7)
    expect(client.get).toHaveBeenCalledWith('/notifications/unread-count')
  })

  it('marks one read', async () => {
    ;(client.put as ReturnType<typeof vi.fn>).mockResolvedValue({ data: undefined })
    await markNotificationRead(4)
    expect(client.put).toHaveBeenCalledWith('/notifications/4/read')
  })

  it('marks all read', async () => {
    ;(client.put as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { unread: 0 } })
    await markAllNotificationsRead()
    expect(client.put).toHaveBeenCalledWith('/notifications/read-all')
  })

  it('reads preferences', async () => {
    ;(client.get as ReturnType<typeof vi.fn>).mockResolvedValue({ data: [] })
    await expect(getNotificationPreferences()).resolves.toEqual([])
    expect(client.get).toHaveBeenCalledWith('/notifications/preferences')
  })

  it('sends only the families being changed', async () => {
    const body = [{ eventFamily: 'LOAN' as const, inAppEnabled: true, emailEnabled: false }]
    ;(client.put as ReturnType<typeof vi.fn>).mockResolvedValue({ data: body })
    await expect(updateNotificationPreferences(body)).resolves.toEqual(body)
    expect(client.put).toHaveBeenCalledWith('/notifications/preferences', body)
  })

  it('labels every event family, so no preference row renders as a raw enum', () => {
    const families = Object.keys(EVENT_FAMILY_LABELS)
    expect(families).toHaveLength(12)
    for (const label of Object.values(EVENT_FAMILY_LABELS)) {
      expect(label).not.toMatch(/^[A-Z_]+$/)
    }
  })
})
