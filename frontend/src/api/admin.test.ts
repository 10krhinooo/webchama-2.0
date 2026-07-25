import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./client', () => ({
  client: {
    get: vi.fn(),
  },
}))

import { client } from './client'
import { getPlatformOverview } from './admin'

const mockGet = client.get as ReturnType<typeof vi.fn>

describe('admin api', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('getPlatformOverview fetches the platform-wide overview and unwraps data', async () => {
    mockGet.mockResolvedValue({ data: { totalChamas: 12 } })
    const result = await getPlatformOverview()
    expect(mockGet).toHaveBeenCalledWith('/admin/overview')
    expect(result).toEqual({ totalChamas: 12 })
  })
})
