import { client } from './client'

export interface Meeting {
  id: number
  chamaId: number
  meetingDate: string
  agenda: string
  minutes: string | null
  createdAt: string
}

export async function getMeetings(chamaId: number): Promise<Meeting[]> {
  const { data } = await client.get<Meeting[]>(`/chamas/${chamaId}/meetings`)
  return data
}
