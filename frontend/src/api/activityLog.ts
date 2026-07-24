import { client } from './client'

export type ActivityEventType =
  | 'MEMBER_INVITED'
  | 'CONTRIBUTION_PAID'
  | 'LOAN_APPROVED'
  | 'PAYOUT_DISBURSED'
  | 'DOCUMENT_GENERATED'

export interface ActivityLogEntry {
  id: number
  chamaId: number
  eventType: ActivityEventType
  description: string
  createdAt: string
}

export async function getActivityLog(chamaId: number, page = 0, size = 20): Promise<ActivityLogEntry[]> {
  const { data } = await client.get<ActivityLogEntry[]>(`/chamas/${chamaId}/activity-log`, {
    params: { page, size },
  })
  return data
}
