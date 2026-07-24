import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./client', () => ({
  client: {
    get: vi.fn(),
  },
}))

import { client } from './client'
import { getMeetings } from './meetings'

const mockGet = client.get as ReturnType<typeof vi.fn>

describe('meetings api', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('getMeetings fetches the chama-wide list and unwraps data', async () => {
    mockGet.mockResolvedValue({ data: [{ id: 1, agenda: 'Discuss Q3 contributions' }] })
    const result = await getMeetings(3)
    expect(mockGet).toHaveBeenCalledWith('/chamas/3/meetings')
    expect(result).toEqual([{ id: 1, agenda: 'Discuss Q3 contributions' }])
  })
})
