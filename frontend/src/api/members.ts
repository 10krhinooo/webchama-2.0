import { client } from './client'

export type MemberRoleType = 'CHAIRPERSON' | 'TREASURER' | 'SECRETARY' | 'MEMBER'
export type MemberStatus = 'ACTIVE' | 'SUSPENDED' | 'EXITED'

export interface Member {
  id: number
  chamaId: number
  fullName: string
  phone: string
  nationalId: string | null
  nextOfKin: string | null
  joinDate: string
  status: MemberStatus
  roles: MemberRoleType[]
  autoPayEnabled: boolean
}

export interface UpdateMemberRequest {
  fullName: string
  phone: string
  nationalId?: string
  nextOfKin?: string
  roles: MemberRoleType[]
}

export interface CreateMemberRequest extends UpdateMemberRequest {
  email: string
}

export interface MemberInvitationResult {
  member: Member
  temporaryPassword: string | null
}

export interface CreditScore {
  memberId: number
  score: number
  contributionConsistency: number
  meetingAttendanceRate: number
  loanRepaymentRate: number
  contributionsConsidered: number
  meetingsConsidered: number
  loanRepaymentsConsidered: number
}

export async function getMembers(chamaId: number): Promise<Member[]> {
  const { data } = await client.get<Member[]>(`/chamas/${chamaId}/members`)
  return data
}

export async function getMyMembership(chamaId: number): Promise<Member> {
  const { data } = await client.get<Member>(`/chamas/${chamaId}/members/mine`)
  return data
}

export async function getMember(chamaId: number, id: number): Promise<Member> {
  const { data } = await client.get<Member>(`/chamas/${chamaId}/members/${id}`)
  return data
}

export async function createMember(chamaId: number, payload: CreateMemberRequest): Promise<MemberInvitationResult> {
  const { data } = await client.post<MemberInvitationResult>(`/chamas/${chamaId}/members`, payload)
  return data
}

export async function updateMember(chamaId: number, id: number, payload: UpdateMemberRequest): Promise<Member> {
  const { data } = await client.put<Member>(`/chamas/${chamaId}/members/${id}`, payload)
  return data
}

export async function updateMemberStatus(chamaId: number, id: number, status: MemberStatus): Promise<Member> {
  const { data } = await client.put<Member>(`/chamas/${chamaId}/members/${id}/status`, { status })
  return data
}

/** Self-service: opt in/out of the scheduled auto-STK-push job for the caller's own contributions. */
export async function updateMyAutoPay(chamaId: number, autoPayEnabled: boolean): Promise<Member> {
  const { data } = await client.put<Member>(`/chamas/${chamaId}/members/mine/auto-pay`, { autoPayEnabled })
  return data
}

export async function deleteMember(chamaId: number, id: number): Promise<void> {
  await client.delete(`/chamas/${chamaId}/members/${id}`)
}

/** Recovery path when the original invite email never arrived or its one-time password was lost. */
export async function resendInvite(chamaId: number, id: number): Promise<MemberInvitationResult> {
  const { data } = await client.post<MemberInvitationResult>(`/chamas/${chamaId}/members/${id}/resend-invite`)
  return data
}

export async function getCreditScore(chamaId: number, memberId: number): Promise<CreditScore> {
  const { data } = await client.get<CreditScore>(`/chamas/${chamaId}/members/${memberId}/credit-score`)
  return data
}
