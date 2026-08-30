import { client } from './client'
import type { PaymentMethod } from './contributions'

export type PenaltyReason = 'LATE_CONTRIBUTION' | 'MISSED_MEETING' | 'LOAN_DEFAULT' | 'OTHER'
export type PenaltyStatus = 'PENDING' | 'APPROVED' | 'WAIVED' | 'PAID'

export interface Penalty {
  id: number
  chamaId: number
  memberId: number
  memberName: string
  reason: PenaltyReason
  amount: number
  status: PenaltyStatus
  decidedByMemberId: number | null
  decidedByName: string | null
  decidedAt: string | null
  waiverReason: string | null
  imposedAt: string
}

export interface CreatePenaltyRequest {
  memberId: number
  reason: PenaltyReason
  amount: number
}

/** Every penalty in the chama. Treasurer and chairperson only. */
export async function getPenalties(chamaId: number): Promise<Penalty[]> {
  const { data } = await client.get<Penalty[]>(`/chamas/${chamaId}/penalties`)
  return data
}

/** The caller's own penalties, so a member can see what they owe without treasury access. */
export async function getMyPenalties(chamaId: number): Promise<Penalty[]> {
  const { data } = await client.get<Penalty[]>(`/chamas/${chamaId}/penalties/mine`)
  return data
}

export async function createPenalty(chamaId: number, body: CreatePenaltyRequest): Promise<Penalty> {
  const { data } = await client.post<Penalty>(`/chamas/${chamaId}/penalties`, body)
  return data
}

/** Confirms a penalty stands, moving it from PENDING to APPROVED so it becomes payable. */
export async function approvePenalty(chamaId: number, id: number): Promise<Penalty> {
  const { data } = await client.put<Penalty>(`/chamas/${chamaId}/penalties/${id}/approve`)
  return data
}

/** Cancels a penalty. The reason is required, since a waiver is a decision someone has to answer for. */
export async function waivePenalty(chamaId: number, id: number, reason: string): Promise<Penalty> {
  const { data } = await client.put<Penalty>(`/chamas/${chamaId}/penalties/${id}/waive`, { reason })
  return data
}

/** Records payment of an approved penalty. The backend defaults the method to CASH. */
export async function settlePenalty(
  chamaId: number,
  id: number,
  method?: PaymentMethod,
): Promise<Penalty> {
  const { data } = await client.put<Penalty>(`/chamas/${chamaId}/penalties/${id}/settle`, { method })
  return data
}
