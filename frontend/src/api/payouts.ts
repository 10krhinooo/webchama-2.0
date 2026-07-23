import { client } from './client'

export type RotationOrderType = 'RANDOM' | 'SENIORITY' | 'AGREED'
export type PayoutStatus = 'SCHEDULED' | 'DISBURSED'
export type PayoutScheduleEntryStatus = 'ACTIVE' | 'SKIPPED'

export interface PayoutScheduleEntry {
  id: number
  chamaId: number
  memberId: number
  memberName: string
  rotationOrderType: RotationOrderType
  sequencePosition: number
  status: PayoutScheduleEntryStatus
}

export interface Payout {
  id: number
  chamaId: number
  memberId: number
  memberName: string
  roundNumber: number
  scheduledDate: string
  amount: number
  status: PayoutStatus
  disbursedAt: string | null
  createdAt: string
}

export interface GeneratePayoutScheduleRequest {
  rotationOrderType: RotationOrderType
  agreedMemberIds?: number[]
}

export interface CreatePayoutRequest {
  scheduledDate: string
}

export async function getPayoutSchedule(chamaId: number): Promise<PayoutScheduleEntry[]> {
  const { data } = await client.get<PayoutScheduleEntry[]>(`/chamas/${chamaId}/payout-schedule`)
  return data
}

export async function generatePayoutSchedule(
  chamaId: number,
  payload: GeneratePayoutScheduleRequest,
): Promise<PayoutScheduleEntry[]> {
  const { data } = await client.post<PayoutScheduleEntry[]>(`/chamas/${chamaId}/payout-schedule`, payload)
  return data
}

export async function getPayouts(chamaId: number): Promise<Payout[]> {
  const { data } = await client.get<Payout[]>(`/chamas/${chamaId}/payouts`)
  return data
}

export async function getMyPayouts(chamaId: number): Promise<Payout[]> {
  const { data } = await client.get<Payout[]>(`/chamas/${chamaId}/payouts/mine`)
  return data
}

export async function createPayout(chamaId: number, payload: CreatePayoutRequest): Promise<Payout> {
  const { data } = await client.post<Payout>(`/chamas/${chamaId}/payouts`, payload)
  return data
}

export async function disbursePayout(chamaId: number, id: number): Promise<Payout> {
  const { data } = await client.put<Payout>(`/chamas/${chamaId}/payouts/${id}/disburse`, {})
  return data
}
