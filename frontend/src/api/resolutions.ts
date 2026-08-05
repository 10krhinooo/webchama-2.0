import { client } from './client'

export type ResolutionStatus = 'OPEN' | 'PASSED' | 'REJECTED'
export type VoteChoice = 'FOR' | 'AGAINST' | 'ABSTAIN'

export interface Resolution {
  id: number
  chamaId: number
  meetingId: number
  title: string
  description: string | null
  status: ResolutionStatus
  openedByMemberId: number
  openedByName: string
  openedAt: string
  closedAt: string | null
  forVotes: number
  againstVotes: number
  abstainVotes: number
}

export interface ResolutionVote {
  id: number
  resolutionId: number
  memberId: number
  memberName: string
  choice: VoteChoice
  votedAt: string
}

export interface CreateResolutionRequest {
  meetingId: number
  title: string
  description?: string
}

export async function getResolutions(chamaId: number): Promise<Resolution[]> {
  const { data } = await client.get<Resolution[]>(`/chamas/${chamaId}/resolutions`)
  return data
}

export async function getResolutionVotes(chamaId: number, resolutionId: number): Promise<ResolutionVote[]> {
  const { data } = await client.get<ResolutionVote[]>(`/chamas/${chamaId}/resolutions/${resolutionId}/votes`)
  return data
}

export async function openResolution(chamaId: number, payload: CreateResolutionRequest): Promise<Resolution> {
  const { data } = await client.post<Resolution>(`/chamas/${chamaId}/resolutions`, payload)
  return data
}

export async function castResolutionVote(chamaId: number, resolutionId: number, choice: VoteChoice): Promise<Resolution> {
  const { data } = await client.post<Resolution>(`/chamas/${chamaId}/resolutions/${resolutionId}/votes`, { choice })
  return data
}

export async function closeResolution(chamaId: number, resolutionId: number): Promise<Resolution> {
  const { data } = await client.put<Resolution>(`/chamas/${chamaId}/resolutions/${resolutionId}/close`, {})
  return data
}
