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
  getResolutions,
  getResolutionVotes,
  openResolution,
  castResolutionVote,
  closeResolution,
  type CreateResolutionRequest,
} from './resolutions'

const mockGet = client.get as ReturnType<typeof vi.fn>
const mockPost = client.post as ReturnType<typeof vi.fn>
const mockPut = client.put as ReturnType<typeof vi.fn>

const payload: CreateResolutionRequest = {
  meetingId: 7,
  title: 'Approve loan for Jane',
  description: 'Show of hands',
}

describe('resolutions api', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('getResolutions fetches the chama-wide list and unwraps data', async () => {
    mockGet.mockResolvedValue({ data: [{ id: 1 }] })
    const result = await getResolutions(3)
    expect(mockGet).toHaveBeenCalledWith('/chamas/3/resolutions')
    expect(result).toEqual([{ id: 1 }])
  })

  it('getResolutionVotes fetches the votes for one resolution and unwraps data', async () => {
    mockGet.mockResolvedValue({ data: [{ id: 1, choice: 'FOR' }] })
    const result = await getResolutionVotes(3, 9)
    expect(mockGet).toHaveBeenCalledWith('/chamas/3/resolutions/9/votes')
    expect(result).toEqual([{ id: 1, choice: 'FOR' }])
  })

  it('openResolution posts the payload and unwraps data', async () => {
    mockPost.mockResolvedValue({ data: { id: 9, ...payload } })
    const result = await openResolution(3, payload)
    expect(mockPost).toHaveBeenCalledWith('/chamas/3/resolutions', payload)
    expect(result).toEqual({ id: 9, ...payload })
  })

  it('castResolutionVote posts the choice and unwraps data', async () => {
    mockPost.mockResolvedValue({ data: { id: 9, forVotes: 1 } })
    const result = await castResolutionVote(3, 9, 'FOR')
    expect(mockPost).toHaveBeenCalledWith('/chamas/3/resolutions/9/votes', { choice: 'FOR' })
    expect(result).toEqual({ id: 9, forVotes: 1 })
  })

  it('closeResolution puts and unwraps data', async () => {
    mockPut.mockResolvedValue({ data: { id: 9, status: 'PASSED' } })
    const result = await closeResolution(3, 9)
    expect(mockPut).toHaveBeenCalledWith('/chamas/3/resolutions/9/close', {})
    expect(result).toEqual({ id: 9, status: 'PASSED' })
  })
})
