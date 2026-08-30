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
  updateMyAutoPay,
  resendInvite,
  deleteMember,
  getCreditScore,
  exportMyData,
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

  it('updateMyAutoPay puts the opt-in flag for the caller own membership', async () => {
    mockPut.mockResolvedValue({ data: { id: 4, autoPayEnabled: true } })
    const result = await updateMyAutoPay(3, true)
    expect(mockPut).toHaveBeenCalledWith('/chamas/3/members/mine/auto-pay', { autoPayEnabled: true })
    expect(result).toEqual({ id: 4, autoPayEnabled: true })
  })

  it('deleteMember deletes by id', async () => {
    mockDelete.mockResolvedValue({})
    await deleteMember(3, 4)
    expect(mockDelete).toHaveBeenCalledWith('/chamas/3/members/4')
  })

  it('getCreditScore fetches and unwraps a member credit score', async () => {
    mockGet.mockResolvedValue({ data: { memberId: 4, score: 82 } })
    const result = await getCreditScore(3, 4)
    expect(mockGet).toHaveBeenCalledWith('/chamas/3/members/4/credit-score')
    expect(result).toEqual({ memberId: 4, score: 82 })
  })

  it('exportMyData fetches the caller own data export and unwraps data', async () => {
    mockGet.mockResolvedValue({ data: { profile: { fullName: 'Jane Doe' } } })
    const result = await exportMyData(3)
    expect(mockGet).toHaveBeenCalledWith('/chamas/3/members/mine/export')
    expect(result).toEqual({ profile: { fullName: 'Jane Doe' } })
  })

  it('resends an invite and returns the reissued credentials', async () => {
    const result = { memberId: 7, email: 'a@b.c', temporaryPassword: 'placeholder-not-a-credential' }
    ;(client.post as ReturnType<typeof vi.fn>).mockResolvedValue({ data: result })

    await expect(resendInvite(1, 7)).resolves.toEqual(result)
    expect(client.post).toHaveBeenCalledWith('/chamas/1/members/7/resend-invite')
  })
})
