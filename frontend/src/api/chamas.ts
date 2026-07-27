import { client } from './client'
import type { Member } from './members'

export type ChamaType = 'MERRY_GO_ROUND' | 'TABLE_BANKING' | 'INVESTMENT_GROUP'
export type ContributionFrequency = 'WEEKLY' | 'MONTHLY'
export type ChamaStatus = 'ACTIVE' | 'INACTIVE'

export interface Chama {
  id: number
  name: string
  description: string | null
  type: ChamaType
  currency: string
  contributionFrequency: ContributionFrequency
  contributionAmount: number
  meetingDay: string | null
  savingsTarget: number | null
  status: ChamaStatus
  autoPushEnabled: boolean
  autoPushRetryHours: number
  createdAt: string
  joinCode: string
}

export interface JoinChamaRequest {
  joinCode: string
  fullName: string
  phone: string
  nationalId?: string
  nextOfKin?: string
}

export interface InviteToChamaRequest {
  email: string
}

export interface UpdateAutoPushSettingsRequest {
  autoPushEnabled: boolean
  autoPushRetryHours: number
}

export interface UpdateChamaRequest {
  name: string
  description?: string
  type: ChamaType
  currency?: string
  contributionFrequency: ContributionFrequency
  contributionAmount: number
  meetingDay?: string
  savingsTarget?: number
}

export interface CreateChamaRequest extends UpdateChamaRequest {
  creatorFullName: string
  creatorPhone: string
}

export type MemberRoleType = 'CHAIRPERSON' | 'TREASURER' | 'SECRETARY' | 'MEMBER'

export interface MyChama {
  id: number
  name: string
  description: string | null
  type: ChamaType
  currency: string
  contributionFrequency: ContributionFrequency
  contributionAmount: number
  roles: MemberRoleType[]
  superAdmin: boolean
}

export interface SavingsProgress {
  target: number | null
  totalPaid: number
}

export async function getChamas(): Promise<Chama[]> {
  const { data } = await client.get<Chama[]>('/chamas')
  return data
}

export async function getMyChamas(): Promise<MyChama[]> {
  const { data } = await client.get<MyChama[]>('/chamas/mine')
  return data
}

export async function getChama(id: number): Promise<Chama> {
  const { data } = await client.get<Chama>(`/chamas/${id}`)
  return data
}

export async function createChama(payload: CreateChamaRequest): Promise<Chama> {
  const { data } = await client.post<Chama>('/chamas', payload)
  return data
}

export async function updateChama(id: number, payload: UpdateChamaRequest): Promise<Chama> {
  const { data } = await client.put<Chama>(`/chamas/${id}`, payload)
  return data
}

export async function deleteChama(id: number): Promise<void> {
  await client.delete(`/chamas/${id}`)
}

export async function updateAutoPushSettings(
  id: number,
  payload: UpdateAutoPushSettingsRequest,
): Promise<Chama> {
  const { data } = await client.put<Chama>(`/chamas/${id}/auto-push-settings`, payload)
  return data
}

export async function getSavingsProgress(id: number): Promise<SavingsProgress> {
  const { data } = await client.get<SavingsProgress>(`/chamas/${id}/savings-progress`)
  return data
}

export async function joinChama(payload: JoinChamaRequest): Promise<Member> {
  const { data } = await client.post<Member>('/chamas/join', payload)
  return data
}

export async function regenerateJoinCode(id: number): Promise<Chama> {
  const { data } = await client.post<Chama>(`/chamas/${id}/join-code/regenerate`)
  return data
}

export async function inviteToChama(id: number, payload: InviteToChamaRequest): Promise<void> {
  await client.post(`/chamas/${id}/join-code/invite`, payload)
}
