import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./client', () => ({
  client: {
    get: vi.fn(),
  },
}))

import { client } from './client'
import { getActivityLog } from './activityLog'

const mockGet = client.get as ReturnType<typeof vi.fn>

describe('activityLog api', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('fetches a page of the activity log for a chama', async () => {
    const entries = [{ id: 1, chamaId: 5, eventType: 'MEMBER_INVITED', description: 'X', createdAt: '2026-07-24T00:00:00Z' }]
    mockGet.mockResolvedValue({ data: entries })

    const result = await getActivityLog(5)

    expect(mockGet).toHaveBeenCalledWith('/chamas/5/activity-log', { params: { page: 0, size: 20 } })
    expect(result).toEqual(entries)
  })

  it('passes an explicit page and size through', async () => {
    mockGet.mockResolvedValue({ data: [] })

    await getActivityLog(5, 2, 10)

    expect(mockGet).toHaveBeenCalledWith('/chamas/5/activity-log', { params: { page: 2, size: 10 } })
  })
})
