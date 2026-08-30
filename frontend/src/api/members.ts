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

export type CreditScoreBand = 'INSUFFICIENT_HISTORY' | 'POOR' | 'FAIR' | 'GOOD' | 'EXCELLENT'

/** One named component of a score, so the number can be explained rather than only shown. */
export interface CreditScoreFactor {
  code: string
  label: string
  rate: number
  weight: number
  observations: number
}

export interface CreditScore {
  memberId: number
  /** Null when the band is INSUFFICIENT_HISTORY. There is no honest number for a blank record. */
  score: number | null
  band: CreditScoreBand
  /** How much evidence the score rests on, 0 to 1, independent of the score itself. */
  confidence: number
  /** Each rate is null where the chama records nothing for that component. */
  contributionConsistency: number | null
  contributionTimeliness: number | null
  loanRepaymentRate: number | null
  meetingAttendanceRate: number | null
  penaltyDeduction: number
  outstandingDebt: string
  totalSavings: string
  hasDefaultedLoan: boolean
  contributionsConsidered: number
  meetingsConsidered: number
  loanRepaymentsConsidered: number
  strengths: CreditScoreFactor[]
  weaknesses: CreditScoreFactor[]
}

export const CREDIT_SCORE_BAND_LABELS: Record<CreditScoreBand, string> = {
  INSUFFICIENT_HISTORY: 'Not enough history',
  POOR: 'Poor',
  FAIR: 'Fair',
  GOOD: 'Good',
  EXCELLENT: 'Excellent',
}

export async function getMembers(chamaId: number): Promise<Member[]> {
  const { data } = await client.get<Member[]>(`/chamas/${chamaId}/members`)
  return data
}

// Untyped: a GDPR self-service export of everything the platform holds about the caller within
// this chama, passed straight through to a JSON download rather than modeled field by field.
export async function exportMyData(chamaId: number): Promise<unknown> {
  const { data } = await client.get(`/chamas/${chamaId}/members/mine/export`)
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

/**
 * Every member's score in one request. Tables that show a score per row must use this rather than
 * calling getCreditScore per member, which is a request each and five queries behind every one.
 */
export async function getCreditScores(chamaId: number): Promise<CreditScore[]> {
  const { data } = await client.get<CreditScore[]>(`/chamas/${chamaId}/members/credit-scores`)
  return data
}
