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
  getPayoutSchedule,
  generatePayoutSchedule,
  getPayouts,
  getMyPayouts,
  createPayout,
  disbursePayout,
  type GeneratePayoutScheduleRequest,
  type CreatePayoutRequest,
} from './payouts'

const mockGet = client.get as ReturnType<typeof vi.fn>
const mockPost = client.post as ReturnType<typeof vi.fn>
const mockPut = client.put as ReturnType<typeof vi.fn>

describe('payouts api', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('getPayoutSchedule fetches the rotation order and unwraps data', async () => {
    mockGet.mockResolvedValue({ data: [{ id: 1 }] })
    const result = await getPayoutSchedule(3)
    expect(mockGet).toHaveBeenCalledWith('/chamas/3/payout-schedule')
    expect(result).toEqual([{ id: 1 }])
  })

  it('generatePayoutSchedule posts the rotation order type and unwraps data', async () => {
    const payload: GeneratePayoutScheduleRequest = { rotationOrderType: 'SENIORITY' }
    mockPost.mockResolvedValue({ data: [{ id: 1 }, { id: 2 }] })
    const result = await generatePayoutSchedule(3, payload)
    expect(mockPost).toHaveBeenCalledWith('/chamas/3/payout-schedule', payload)
    expect(result).toEqual([{ id: 1 }, { id: 2 }])
  })

  it('generatePayoutSchedule sends agreedMemberIds for an AGREED order', async () => {
    const payload: GeneratePayoutScheduleRequest = { rotationOrderType: 'AGREED', agreedMemberIds: [5, 3, 1] }
    mockPost.mockResolvedValue({ data: [] })
    await generatePayoutSchedule(3, payload)
    expect(mockPost).toHaveBeenCalledWith('/chamas/3/payout-schedule', payload)
  })

  it('getPayouts fetches the chama-wide ledger and unwraps data', async () => {
    mockGet.mockResolvedValue({ data: [{ id: 1 }] })
    const result = await getPayouts(3)
    expect(mockGet).toHaveBeenCalledWith('/chamas/3/payouts')
    expect(result).toEqual([{ id: 1 }])
  })

  it("getMyPayouts fetches the caller's own payouts", async () => {
    mockGet.mockResolvedValue({ data: [{ id: 2 }] })
    const result = await getMyPayouts(3)
    expect(mockGet).toHaveBeenCalledWith('/chamas/3/payouts/mine')
    expect(result).toEqual([{ id: 2 }])
  })

  it('createPayout posts the scheduled date and unwraps data', async () => {
    const payload: CreatePayoutRequest = { scheduledDate: '2026-08-01' }
    mockPost.mockResolvedValue({ data: { id: 9, ...payload } })
    const result = await createPayout(3, payload)
    expect(mockPost).toHaveBeenCalledWith('/chamas/3/payouts', payload)
    expect(result).toEqual({ id: 9, ...payload })
  })

  it('disbursePayout puts and unwraps data', async () => {
    mockPut.mockResolvedValue({ data: { id: 9, status: 'DISBURSED' } })
    const result = await disbursePayout(3, 9)
    expect(mockPut).toHaveBeenCalledWith('/chamas/3/payouts/9/disburse', {})
    expect(result).toEqual({ id: 9, status: 'DISBURSED' })
  })
})
