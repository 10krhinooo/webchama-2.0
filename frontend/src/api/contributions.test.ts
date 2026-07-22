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
  getContributions,
  getMyContributions,
  createContribution,
  recordPayment,
  deleteContribution,
  type CreateContributionRequest,
} from './contributions'

const mockGet = client.get as ReturnType<typeof vi.fn>
const mockPost = client.post as ReturnType<typeof vi.fn>
const mockPut = client.put as ReturnType<typeof vi.fn>
const mockDelete = client.delete as ReturnType<typeof vi.fn>

const payload: CreateContributionRequest = {
  memberId: 1,
  period: '2026-08-01',
  amountDue: 500,
}

describe('contributions api', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('getContributions fetches the chama-wide list', async () => {
    mockGet.mockResolvedValue({ data: [{ id: 1 }] })
    const result = await getContributions(3)
    expect(mockGet).toHaveBeenCalledWith('/chamas/3/contributions')
    expect(result).toEqual([{ id: 1 }])
  })

  it('getMyContributions fetches the caller own contributions', async () => {
    mockGet.mockResolvedValue({ data: [{ id: 2 }] })
    const result = await getMyContributions(3)
    expect(mockGet).toHaveBeenCalledWith('/chamas/3/contributions/mine')
    expect(result).toEqual([{ id: 2 }])
  })

  it('createContribution posts the payload', async () => {
    mockPost.mockResolvedValue({ data: { id: 4, ...payload } })
    const result = await createContribution(3, payload)
    expect(mockPost).toHaveBeenCalledWith('/chamas/3/contributions', payload)
    expect(result).toEqual({ id: 4, ...payload })
  })

  it('recordPayment puts the amount and method', async () => {
    mockPut.mockResolvedValue({ data: { id: 4, amountPaid: 500 } })
    const result = await recordPayment(3, 4, 500, 'MPESA')
    expect(mockPut).toHaveBeenCalledWith('/chamas/3/contributions/4/payment', { amount: 500, method: 'MPESA' })
    expect(result).toEqual({ id: 4, amountPaid: 500 })
  })

  it('deleteContribution deletes by id', async () => {
    mockDelete.mockResolvedValue({})
    await deleteContribution(3, 4)
    expect(mockDelete).toHaveBeenCalledWith('/chamas/3/contributions/4')
  })
})
