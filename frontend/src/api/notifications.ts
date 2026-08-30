import { client } from './client'

export type NotificationEventFamily =
  | 'CONTRIBUTION'
  | 'PAYMENT'
  | 'LOAN'
  | 'PAYOUT'
  | 'PENALTY'
  | 'MEETING'
  | 'RESOLUTION'
  | 'WELFARE'
  | 'APPROVAL'
  | 'DOCUMENT'
  | 'MEMBERSHIP'
  | 'REMINDER'

export interface Notification {
  id: number
  /** Null for notifications that exist before the recipient belongs to a chama. */
  chamaId: number | null
  eventFamily: NotificationEventFamily
  title: string
  body: string
  /** Client-side route to open, or null when there is nowhere to go. */
  link: string | null
  readAt: string | null
  createdAt: string
}

export interface NotificationPreference {
  eventFamily: NotificationEventFamily
  inAppEnabled: boolean
  emailEnabled: boolean
}

/** Human labels for the families, in the order the preferences screen lists them. */
export const EVENT_FAMILY_LABELS: Record<NotificationEventFamily, string> = {
  CONTRIBUTION: 'Contributions',
  PAYMENT: 'Payments',
  LOAN: 'Loans',
  PAYOUT: 'Payouts',
  PENALTY: 'Penalties',
  MEETING: 'Meetings',
  RESOLUTION: 'Resolutions',
  WELFARE: 'Welfare fund',
  APPROVAL: 'Approvals',
  DOCUMENT: 'Documents',
  MEMBERSHIP: 'Membership',
  REMINDER: 'Reminders',
}

export async function getNotifications(unreadOnly = false, page = 0, size = 20): Promise<Notification[]> {
  const { data } = await client.get<Notification[]>('/notifications', {
    params: { unreadOnly, page, size },
  })
  return data
}

export async function getUnreadCount(): Promise<number> {
  const { data } = await client.get<{ unread: number }>('/notifications/unread-count')
  return data.unread
}

export async function markNotificationRead(id: number): Promise<void> {
  await client.put(`/notifications/${id}/read`)
}

export async function markAllNotificationsRead(): Promise<void> {
  await client.put('/notifications/read-all')
}

export async function getNotificationPreferences(): Promise<NotificationPreference[]> {
  const { data } = await client.get<NotificationPreference[]>('/notifications/preferences')
  return data
}

/**
 * Sends only the families being changed.
 *
 * The backend leaves families the body does not mention alone, so a client that knows about fewer
 * families than the server cannot silently switch the rest back on.
 */
export async function updateNotificationPreferences(
  preferences: NotificationPreference[],
): Promise<NotificationPreference[]> {
  const { data } = await client.put<NotificationPreference[]>('/notifications/preferences', preferences)
  return data
}
