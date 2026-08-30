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
  getPenalties,
  getMyPenalties,
  createPenalty,
  approvePenalty,
  waivePenalty,
  settlePenalty,
  type Penalty,
} from './penalties'

const penalty = { id: 1, memberName: 'Amina' } as Penalty

beforeEach(() => {
  vi.clearAllMocks()
})

describe('penalties api', () => {
  it('lists every penalty in the chama', async () => {
    ;(client.get as ReturnType<typeof vi.fn>).mockResolvedValue({ data: [penalty] })
    await expect(getPenalties(3)).resolves.toEqual([penalty])
    expect(client.get).toHaveBeenCalledWith('/chamas/3/penalties')
  })

  it('lists only the caller own penalties from a separate endpoint', async () => {
    ;(client.get as ReturnType<typeof vi.fn>).mockResolvedValue({ data: [] })
    await expect(getMyPenalties(3)).resolves.toEqual([])
    expect(client.get).toHaveBeenCalledWith('/chamas/3/penalties/mine')
  })

  it('issues a penalty', async () => {
    ;(client.post as ReturnType<typeof vi.fn>).mockResolvedValue({ data: penalty })
    const body = { memberId: 4, reason: 'MISSED_MEETING' as const, amount: 500 }
    await expect(createPenalty(3, body)).resolves.toEqual(penalty)
    expect(client.post).toHaveBeenCalledWith('/chamas/3/penalties', body)
  })

  it('approves a penalty', async () => {
    ;(client.put as ReturnType<typeof vi.fn>).mockResolvedValue({ data: penalty })
    await expect(approvePenalty(3, 1)).resolves.toEqual(penalty)
    expect(client.put).toHaveBeenCalledWith('/chamas/3/penalties/1/approve')
  })

  it('sends the reason when waiving, since the backend requires one', async () => {
    ;(client.put as ReturnType<typeof vi.fn>).mockResolvedValue({ data: penalty })
    await expect(waivePenalty(3, 1, 'Hardship')).resolves.toEqual(penalty)
    expect(client.put).toHaveBeenCalledWith('/chamas/3/penalties/1/waive', { reason: 'Hardship' })
  })

  it('settles with an explicit method', async () => {
    ;(client.put as ReturnType<typeof vi.fn>).mockResolvedValue({ data: penalty })
    await settlePenalty(3, 1, 'MPESA')
    expect(client.put).toHaveBeenCalledWith('/chamas/3/penalties/1/settle', { method: 'MPESA' })
  })

  it('omits the method when not given, leaving the backend to default it', async () => {
    ;(client.put as ReturnType<typeof vi.fn>).mockResolvedValue({ data: penalty })
    await settlePenalty(3, 1)
    expect(client.put).toHaveBeenCalledWith('/chamas/3/penalties/1/settle', { method: undefined })
  })
})
