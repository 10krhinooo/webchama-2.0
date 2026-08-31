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
  /** Above this amount, moving money needs a second sign-off. Null means no threshold is set. */
  approvalThreshold: number | null
  savingsTarget: number | null
  status: ChamaStatus
  autoPushEnabled: boolean
  autoPushRetryHours: number
  createdAt: string
  joinCode: string

  /** How the chama identifies itself on the documents it issues. All optional. */
  postalAddress: string | null
  physicalAddress: string | null
  contactPhone: string | null
  contactEmail: string | null
  registrationNumber: string | null
  /** The bytes come from `chamaLogoUrl`, never from this response. */
  hasLogo: boolean
}

/**
 * Where a chama's logo is served from.
 *
 * A plain URL rather than a fetched blob so the browser caches it and an `<img>` can point
 * straight at it. The endpoint is member-scoped, so the request carries the session like any
 * other, and answers 404 when no logo is set.
 */
export function chamaLogoUrl(chamaId: number): string {
  return `/api/chamas/${chamaId}/logo`
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
  postalAddress?: string
  physicalAddress?: string
  contactPhone?: string
  contactEmail?: string
  registrationNumber?: string
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

export interface ChamaReminderSettings {
  chamaId: number
  enabled: boolean
  /** How many days ahead of the due date the first nudge goes out. */
  daysBeforeDue: number
  /** How often to nudge again once a contribution is overdue. */
  overdueEveryDays: number
  /** Hour of the Nairobi day to send at, 0 to 23. */
  sendHour: number
}

export async function getReminderSettings(id: number): Promise<ChamaReminderSettings> {
  const { data } = await client.get<ChamaReminderSettings>(`/chamas/${id}/reminder-settings`)
  return data
}

export async function updateReminderSettings(
  id: number,
  payload: Omit<ChamaReminderSettings, 'chamaId'>,
): Promise<ChamaReminderSettings> {
  const { data } = await client.put<ChamaReminderSettings>(`/chamas/${id}/reminder-settings`, payload)
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

/** Replaces the chama's logo. The file is sent as raw bytes with its own content type. */
export async function uploadChamaLogo(chamaId: number, file: File): Promise<Chama> {
  const { data } = await client.put<Chama>(`/chamas/${chamaId}/logo`, file, {
    headers: { 'Content-Type': file.type },
  })
  return data
}

export async function deleteChamaLogo(chamaId: number): Promise<Chama> {
  const { data } = await client.delete<Chama>(`/chamas/${chamaId}/logo`)
  return data
}
