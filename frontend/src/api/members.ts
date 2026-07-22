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
}

export interface UpdateMemberRequest {
  fullName: string
  phone: string
  nationalId?: string
  nextOfKin?: string
  roles: MemberRoleType[]
}

export interface CreateMemberRequest extends UpdateMemberRequest {
  keycloakUserId: string
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

export async function createMember(chamaId: number, payload: CreateMemberRequest): Promise<Member> {
  const { data } = await client.post<Member>(`/chamas/${chamaId}/members`, payload)
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

export async function deleteMember(chamaId: number, id: number): Promise<void> {
  await client.delete(`/chamas/${chamaId}/members/${id}`)
}
