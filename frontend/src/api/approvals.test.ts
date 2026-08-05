import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./client', () => ({
  client: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
  },
}))

import { client } from './client'
import {
  getApprovals,
  getPendingApprovals,
  requestApproval,
  approveApproval,
  rejectApproval,
  type RequestApprovalPayload,
} from './approvals'

const mockGet = client.get as ReturnType<typeof vi.fn>
const mockPost = client.post as ReturnType<typeof vi.fn>
const mockPut = client.put as ReturnType<typeof vi.fn>

const payload: RequestApprovalPayload = {
  targetType: 'LOAN_DISBURSEMENT',
  targetId: 9,
  memberId: 5,
  amount: 150000,
  reason: 'Loan disbursement',
}

describe('approvals api', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('getApprovals fetches the chama-wide list and unwraps data', async () => {
    mockGet.mockResolvedValue({ data: [{ id: 1 }] })
    const result = await getApprovals(3)
    expect(mockGet).toHaveBeenCalledWith('/chamas/3/approvals')
    expect(result).toEqual([{ id: 1 }])
  })

  it('getPendingApprovals fetches only pending approvals', async () => {
    mockGet.mockResolvedValue({ data: [{ id: 2, status: 'PENDING' }] })
    const result = await getPendingApprovals(3)
    expect(mockGet).toHaveBeenCalledWith('/chamas/3/approvals/pending')
    expect(result).toEqual([{ id: 2, status: 'PENDING' }])
  })

  it('requestApproval posts the payload and unwraps data', async () => {
    mockPost.mockResolvedValue({ data: { id: 9, ...payload, status: 'PENDING' } })
    const result = await requestApproval(3, payload)
    expect(mockPost).toHaveBeenCalledWith('/chamas/3/approvals', payload)
    expect(result).toEqual({ id: 9, ...payload, status: 'PENDING' })
  })

  it('approveApproval puts and unwraps data', async () => {
    mockPut.mockResolvedValue({ data: { id: 9, status: 'PENDING' } })
    const result = await approveApproval(3, 9)
    expect(mockPut).toHaveBeenCalledWith('/chamas/3/approvals/9/approve', {})
    expect(result).toEqual({ id: 9, status: 'PENDING' })
  })

  it('rejectApproval puts and unwraps data', async () => {
    mockPut.mockResolvedValue({ data: { id: 9, status: 'REJECTED' } })
    const result = await rejectApproval(3, 9)
    expect(mockPut).toHaveBeenCalledWith('/chamas/3/approvals/9/reject', {})
    expect(result).toEqual({ id: 9, status: 'REJECTED' })
  })
})
