import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./client', () => ({
  client: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}))

import { client } from './client'
import {
  getMembers,
  getMyMembership,
  getMember,
  createMember,
  updateMember,
  updateMemberStatus,
  deleteMember,
  type CreateMemberRequest,
} from './members'

const mockGet = client.get as ReturnType<typeof vi.fn>
const mockPost = client.post as ReturnType<typeof vi.fn>
const mockPut = client.put as ReturnType<typeof vi.fn>
const mockDelete = client.delete as ReturnType<typeof vi.fn>

const payload: CreateMemberRequest = {
  email: 'jane@example.com',
  fullName: 'Jane Doe',
  phone: '+254700000000',
  roles: ['MEMBER'],
}

describe('members api', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('getMembers fetches the list for a chama', async () => {
    mockGet.mockResolvedValue({ data: [{ id: 1 }] })
    const result = await getMembers(3)
    expect(mockGet).toHaveBeenCalledWith('/chamas/3/members')
    expect(result).toEqual([{ id: 1 }])
  })

  it('getMyMembership fetches the caller own member row', async () => {
    mockGet.mockResolvedValue({ data: { id: 1, roles: ['CHAIRPERSON'] } })
    const result = await getMyMembership(3)
    expect(mockGet).toHaveBeenCalledWith('/chamas/3/members/mine')
    expect(result).toEqual({ id: 1, roles: ['CHAIRPERSON'] })
  })

  it('getMember fetches a single member', async () => {
    mockGet.mockResolvedValue({ data: { id: 2 } })
    const result = await getMember(3, 2)
    expect(mockGet).toHaveBeenCalledWith('/chamas/3/members/2')
    expect(result).toEqual({ id: 2 })
  })

  it('createMember posts the payload and returns the invitation result', async () => {
    const invitationResult = { member: { id: 4, fullName: payload.fullName }, temporaryPassword: 'Temp1234!' }
    mockPost.mockResolvedValue({ data: invitationResult })
    const result = await createMember(3, payload)
    expect(mockPost).toHaveBeenCalledWith('/chamas/3/members', payload)
    expect(result).toEqual(invitationResult)
  })

  it('updateMember puts the payload', async () => {
    mockPut.mockResolvedValue({ data: { id: 4, ...payload } })
    const result = await updateMember(3, 4, payload)
    expect(mockPut).toHaveBeenCalledWith('/chamas/3/members/4', payload)
    expect(result).toEqual({ id: 4, ...payload })
  })

  it('updateMemberStatus puts just the status', async () => {
    mockPut.mockResolvedValue({ data: { id: 4, status: 'SUSPENDED' } })
    const result = await updateMemberStatus(3, 4, 'SUSPENDED')
    expect(mockPut).toHaveBeenCalledWith('/chamas/3/members/4/status', { status: 'SUSPENDED' })
    expect(result).toEqual({ id: 4, status: 'SUSPENDED' })
  })

  it('deleteMember deletes by id', async () => {
    mockDelete.mockResolvedValue({})
    await deleteMember(3, 4)
    expect(mockDelete).toHaveBeenCalledWith('/chamas/3/members/4')
  })
})
