import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./client', () => ({
  client: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
  },
}))

import { client } from './client'
import { getLoans, getMyLoans, createLoan, approveLoan, rejectLoan, getLoanRepayments, recordLoanRepayment, type CreateLoanRequest } from './loans'

const mockGet = client.get as ReturnType<typeof vi.fn>
const mockPost = client.post as ReturnType<typeof vi.fn>
const mockPut = client.put as ReturnType<typeof vi.fn>

const payload: CreateLoanRequest = {
  memberId: 5,
  principal: 10000,
  interestRate: 12,
  interestMethod: 'FLAT',
  termMonths: 6,
}

describe('loans api', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('getLoans fetches the chama-wide list and unwraps data', async () => {
    mockGet.mockResolvedValue({ data: [{ id: 1 }] })
    const result = await getLoans(3)
    expect(mockGet).toHaveBeenCalledWith('/chamas/3/loans')
    expect(result).toEqual([{ id: 1 }])
  })

  it('getMyLoans fetches the caller\'s own loans', async () => {
    mockGet.mockResolvedValue({ data: [{ id: 2 }] })
    const result = await getMyLoans(3)
    expect(mockGet).toHaveBeenCalledWith('/chamas/3/loans/mine')
    expect(result).toEqual([{ id: 2 }])
  })

  it('createLoan posts the payload and unwraps data', async () => {
    mockPost.mockResolvedValue({ data: { id: 9, ...payload } })
    const result = await createLoan(3, payload)
    expect(mockPost).toHaveBeenCalledWith('/chamas/3/loans', payload)
    expect(result).toEqual({ id: 9, ...payload })
  })

  it('approveLoan puts and unwraps data', async () => {
    mockPut.mockResolvedValue({ data: { id: 9, status: 'APPROVED' } })
    const result = await approveLoan(3, 9)
    expect(mockPut).toHaveBeenCalledWith('/chamas/3/loans/9/approve', {})
    expect(result).toEqual({ id: 9, status: 'APPROVED' })
  })

  it('rejectLoan puts and unwraps data', async () => {
    mockPut.mockResolvedValue({ data: { id: 9, status: 'REJECTED' } })
    const result = await rejectLoan(3, 9)
    expect(mockPut).toHaveBeenCalledWith('/chamas/3/loans/9/reject', {})
    expect(result).toEqual({ id: 9, status: 'REJECTED' })
  })

  it('getLoanRepayments fetches the schedule and unwraps data', async () => {
    mockGet.mockResolvedValue({ data: [{ id: 1, installmentNumber: 1 }] })
    const result = await getLoanRepayments(3, 9)
    expect(mockGet).toHaveBeenCalledWith('/chamas/3/loans/9/repayments')
    expect(result).toEqual([{ id: 1, installmentNumber: 1 }])
  })

  it('recordLoanRepayment puts the amount and unwraps data', async () => {
    mockPut.mockResolvedValue({ data: { id: 1, amountPaid: 500 } })
    const result = await recordLoanRepayment(3, 9, 1, 500)
    expect(mockPut).toHaveBeenCalledWith('/chamas/3/loans/9/repayments/1/payment', { amount: 500 })
    expect(result).toEqual({ id: 1, amountPaid: 500 })
  })
})
