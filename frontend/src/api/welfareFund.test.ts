import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./client', () => ({
  client: {
    get: vi.fn(),
    post: vi.fn(),
  },
}))

import { client } from './client'
import {
  getWelfareFund,
  getWelfareContributions,
  getMyWelfareContributions,
  recordWelfareContribution,
  payWelfareContributionWithMpesa,
  getWelfareWithdrawals,
  createWelfareWithdrawal,
} from './welfareFund'

const mockGet = client.get as ReturnType<typeof vi.fn>
const mockPost = client.post as ReturnType<typeof vi.fn>

describe('welfareFund api', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('getWelfareFund fetches the fund balance and unwraps data', async () => {
    mockGet.mockResolvedValue({ data: { chamaId: 3, balance: 5000 } })
    const result = await getWelfareFund(3)
    expect(mockGet).toHaveBeenCalledWith('/chamas/3/welfare-fund')
    expect(result).toEqual({ chamaId: 3, balance: 5000 })
  })

  it('getWelfareContributions fetches the chama-wide list', async () => {
    mockGet.mockResolvedValue({ data: [{ id: 1 }] })
    const result = await getWelfareContributions(3)
    expect(mockGet).toHaveBeenCalledWith('/chamas/3/welfare-fund/contributions')
    expect(result).toEqual([{ id: 1 }])
  })

  it("getMyWelfareContributions fetches the caller's own contributions", async () => {
    mockGet.mockResolvedValue({ data: [{ id: 2 }] })
    const result = await getMyWelfareContributions(3)
    expect(mockGet).toHaveBeenCalledWith('/chamas/3/welfare-fund/contributions/mine')
    expect(result).toEqual([{ id: 2 }])
  })

  it('recordWelfareContribution posts the payload and unwraps data', async () => {
    const payload = { memberId: 5, amount: 300, method: 'CASH' as const }
    mockPost.mockResolvedValue({ data: { id: 9, ...payload } })
    const result = await recordWelfareContribution(3, payload)
    expect(mockPost).toHaveBeenCalledWith('/chamas/3/welfare-fund/contributions', payload)
    expect(result).toEqual({ id: 9, ...payload })
  })

  it('payWelfareContributionWithMpesa posts the amount', async () => {
    mockPost.mockResolvedValue({ data: {} })
    await payWelfareContributionWithMpesa(3, 300)
    expect(mockPost).toHaveBeenCalledWith('/chamas/3/welfare-fund/contributions/pay/mpesa', { amount: 300 })
  })

  it('getWelfareWithdrawals fetches the withdrawal list', async () => {
    mockGet.mockResolvedValue({ data: [{ id: 1 }] })
    const result = await getWelfareWithdrawals(3)
    expect(mockGet).toHaveBeenCalledWith('/chamas/3/welfare-fund/withdrawals')
    expect(result).toEqual([{ id: 1 }])
  })

  it('createWelfareWithdrawal posts the payload and unwraps data', async () => {
    const payload = { amount: 200, reason: 'Medical emergency' }
    mockPost.mockResolvedValue({ data: { id: 4, ...payload } })
    const result = await createWelfareWithdrawal(3, payload)
    expect(mockPost).toHaveBeenCalledWith('/chamas/3/welfare-fund/withdrawals', payload)
    expect(result).toEqual({ id: 4, ...payload })
  })
})
