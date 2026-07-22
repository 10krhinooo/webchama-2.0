import { client } from './client'

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
  status: ChamaStatus
  createdAt: string
}

export interface UpdateChamaRequest {
  name: string
  description?: string
  type: ChamaType
  currency?: string
  contributionFrequency: ContributionFrequency
  contributionAmount: number
  meetingDay?: string
}

export interface CreateChamaRequest extends UpdateChamaRequest {
  creatorFullName: string
  creatorPhone: string
}

export async function getChamas(): Promise<Chama[]> {
  const { data } = await client.get<Chama[]>('/chamas')
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
