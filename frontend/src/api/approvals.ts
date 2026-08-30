import { client } from './client'

export type ApprovalTargetType = 'LOAN_DISBURSEMENT' | 'PAYOUT_DISBURSEMENT' | 'WELFARE_WITHDRAWAL'
export type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED'

export interface Approval {
  id: number
  chamaId: number
  targetType: ApprovalTargetType
  targetId: number
  memberId: number
  memberName: string
  amount: number
  reason: string | null
  status: ApprovalStatus
  requestedByMemberId: number
  requestedByName: string
  requestedAt: string
  firstApproverMemberId: number | null
  firstApproverName: string | null
  firstApprovedAt: string | null
  secondApproverMemberId: number | null
  secondApproverName: string | null
  secondApprovedAt: string | null
}

export interface RequestApprovalPayload {
  targetType: ApprovalTargetType
  targetId: number
  memberId: number
  amount: number
  reason?: string
}

export async function getApprovals(chamaId: number): Promise<Approval[]> {
  const { data } = await client.get<Approval[]>(`/chamas/${chamaId}/approvals`)
  return data
}

export async function getPendingApprovals(chamaId: number): Promise<Approval[]> {
  const { data } = await client.get<Approval[]>(`/chamas/${chamaId}/approvals/pending`)
  return data
}

export async function requestApproval(chamaId: number, payload: RequestApprovalPayload): Promise<Approval> {
  const { data } = await client.post<Approval>(`/chamas/${chamaId}/approvals`, payload)
  return data
}

export async function approveApproval(chamaId: number, approvalId: number): Promise<Approval> {
  const { data } = await client.put<Approval>(`/chamas/${chamaId}/approvals/${approvalId}/approve`, {})
  return data
}

export async function rejectApproval(chamaId: number, approvalId: number): Promise<Approval> {
  const { data } = await client.put<Approval>(`/chamas/${chamaId}/approvals/${approvalId}/reject`, {})
  return data
}
