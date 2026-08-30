import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./client', () => ({ client: { get: vi.fn() } }))

import { client } from './client'
import { getChamaHealth, getContributionTrend, getArrears, getLoanPortfolio, HEALTH_BAND_LABELS } from './analytics'

const mockGet = client.get as ReturnType<typeof vi.fn>

beforeEach(() => vi.clearAllMocks())

describe('analytics api', () => {
  it('getChamaHealth unwraps the health payload', async () => {
    mockGet.mockResolvedValue({ data: { chamaId: 3, score: 70, band: 'GOOD' } })
    const result = await getChamaHealth(3)
    expect(mockGet).toHaveBeenCalledWith('/chamas/3/analytics/health')
    expect(result.score).toBe(70)
  })

  it('getContributionTrend defaults to a twelve month window', async () => {
    mockGet.mockResolvedValue({ data: [] })
    await getContributionTrend(3)
    expect(mockGet).toHaveBeenCalledWith('/chamas/3/analytics/contribution-trend', { params: { months: 12 } })
  })

  it('getContributionTrend passes an explicit window through', async () => {
    mockGet.mockResolvedValue({ data: [] })
    await getContributionTrend(3, 6)
    expect(mockGet).toHaveBeenCalledWith('/chamas/3/analytics/contribution-trend', { params: { months: 6 } })
  })

  it('getArrears unwraps the bucket list', async () => {
    mockGet.mockResolvedValue({ data: [{ bucket: '1-30', members: 1, amount: '100.00' }] })
    const result = await getArrears(3)
    expect(mockGet).toHaveBeenCalledWith('/chamas/3/analytics/arrears')
    expect(result).toHaveLength(1)
  })

  it('getLoanPortfolio unwraps the slice list', async () => {
    mockGet.mockResolvedValue({ data: [{ status: 'REPAYING', loans: 2, principal: '1.00', outstanding: '1.00' }] })
    const result = await getLoanPortfolio(3)
    expect(mockGet).toHaveBeenCalledWith('/chamas/3/analytics/loan-portfolio')
    expect(result[0].status).toBe('REPAYING')
  })

  it('names every band, so an unlabelled one cannot reach the UI', () => {
    expect(Object.keys(HEALTH_BAND_LABELS)).toHaveLength(5)
    expect(HEALTH_BAND_LABELS.INSUFFICIENT_HISTORY).toBe('Not enough history')
  })
})
