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
  getChamas,
  getMyChamas,
  getChama,
  createChama,
  updateChama,
  deleteChama,
  joinChama,
  regenerateJoinCode,
  inviteToChama,
  updateAutoPushSettings,
  getSavingsProgress,
  type CreateChamaRequest,
  type JoinChamaRequest,
  chamaLogoUrl,
  uploadChamaLogo,
  deleteChamaLogo,
  getReminderSettings,
  updateReminderSettings,
} from './chamas'

const mockGet = client.get as ReturnType<typeof vi.fn>
const mockPost = client.post as ReturnType<typeof vi.fn>
const mockPut = client.put as ReturnType<typeof vi.fn>
const mockDelete = client.delete as ReturnType<typeof vi.fn>

const payload: CreateChamaRequest = {
  name: 'Umoja',
  type: 'MERRY_GO_ROUND',
  contributionFrequency: 'MONTHLY',
  contributionAmount: 500,
  creatorFullName: 'Jane Doe',
  creatorPhone: '+254700000000',
}

describe('chamas api', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('getChamas fetches the list and unwraps data', async () => {
    mockGet.mockResolvedValue({ data: [{ id: 1 }] })
    const result = await getChamas()
    expect(mockGet).toHaveBeenCalledWith('/chamas')
    expect(result).toEqual([{ id: 1 }])
  })

  it('getChama fetches a single chama by id', async () => {
    mockGet.mockResolvedValue({ data: { id: 5 } })
    const result = await getChama(5)
    expect(mockGet).toHaveBeenCalledWith('/chamas/5')
    expect(result).toEqual({ id: 5 })
  })

  it('createChama posts the payload and unwraps data', async () => {
    mockPost.mockResolvedValue({ data: { id: 9, ...payload } })
    const result = await createChama(payload)
    expect(mockPost).toHaveBeenCalledWith('/chamas', payload)
    expect(result).toEqual({ id: 9, ...payload })
  })

  it('updateChama puts to the chama id and unwraps data', async () => {
    mockPut.mockResolvedValue({ data: { id: 9, ...payload } })
    const result = await updateChama(9, payload)
    expect(mockPut).toHaveBeenCalledWith('/chamas/9', payload)
    expect(result).toEqual({ id: 9, ...payload })
  })

  it('deleteChama deletes by id', async () => {
    mockDelete.mockResolvedValue({})
    await deleteChama(9)
    expect(mockDelete).toHaveBeenCalledWith('/chamas/9')
  })

  it('getMyChamas fetches the caller own chamas with roles and unwraps data', async () => {
    mockGet.mockResolvedValue({ data: [{ id: 1, roles: ['CHAIRPERSON'] }] })
    const result = await getMyChamas()
    expect(mockGet).toHaveBeenCalledWith('/chamas/mine')
    expect(result).toEqual([{ id: 1, roles: ['CHAIRPERSON'] }])
  })

  it('updateAutoPushSettings puts the settings and unwraps data', async () => {
    mockPut.mockResolvedValue({ data: { id: 9, autoPushEnabled: false, autoPushRetryHours: 48 } })
    const result = await updateAutoPushSettings(9, { autoPushEnabled: false, autoPushRetryHours: 48 })
    expect(mockPut).toHaveBeenCalledWith('/chamas/9/auto-push-settings', { autoPushEnabled: false, autoPushRetryHours: 48 })
    expect(result).toEqual({ id: 9, autoPushEnabled: false, autoPushRetryHours: 48 })
  })

  it('getSavingsProgress fetches progress for a chama and unwraps data', async () => {
    mockGet.mockResolvedValue({ data: { target: 50000, totalPaid: 1000 } })
    const result = await getSavingsProgress(9)
    expect(mockGet).toHaveBeenCalledWith('/chamas/9/savings-progress')
    expect(result).toEqual({ target: 50000, totalPaid: 1000 })
  })

  it('joinChama posts the join payload and unwraps data', async () => {
    const joinPayload: JoinChamaRequest = {
      joinCode: 'ABCD1234',
      fullName: 'Jane Doe',
      phone: '+254700000000',
    }
    mockPost.mockResolvedValue({ data: { id: 3, fullName: 'Jane Doe' } })
    const result = await joinChama(joinPayload)
    expect(mockPost).toHaveBeenCalledWith('/chamas/join', joinPayload)
    expect(result).toEqual({ id: 3, fullName: 'Jane Doe' })
  })

  it('regenerateJoinCode posts to the chama id and unwraps data', async () => {
    mockPost.mockResolvedValue({ data: { id: 9, joinCode: 'NEWCODE1' } })
    const result = await regenerateJoinCode(9)
    expect(mockPost).toHaveBeenCalledWith('/chamas/9/join-code/regenerate')
    expect(result).toEqual({ id: 9, joinCode: 'NEWCODE1' })
  })

  it('inviteToChama posts the email payload', async () => {
    mockPost.mockResolvedValue({})
    await inviteToChama(9, { email: 'prospect@example.com' })
    expect(mockPost).toHaveBeenCalledWith('/chamas/9/join-code/invite', { email: 'prospect@example.com' })
  })

  it('chamaLogoUrl points at the member-scoped logo endpoint', () => {
    expect(chamaLogoUrl(9)).toBe('/api/chamas/9/logo')
  })

  it('uploadChamaLogo sends the file as raw bytes with its own content type', async () => {
    const file = new File(['x'], 'logo.png', { type: 'image/png' })
    mockPut.mockResolvedValue({ data: { id: 9, hasLogo: true } })

    const result = await uploadChamaLogo(9, file)

    expect(mockPut).toHaveBeenCalledWith('/chamas/9/logo', file, {
      headers: { 'Content-Type': 'image/png' },
    })
    expect(result).toEqual({ id: 9, hasLogo: true })
  })

  it('deleteChamaLogo deletes and unwraps the updated chama', async () => {
    mockDelete.mockResolvedValue({ data: { id: 9, hasLogo: false } })

    const result = await deleteChamaLogo(9)

    expect(mockDelete).toHaveBeenCalledWith('/chamas/9/logo')
    expect(result).toEqual({ id: 9, hasLogo: false })
  })

  it('getReminderSettings and updateReminderSettings address the chama by id', async () => {
    mockGet.mockResolvedValue({ data: { chamaId: 9, enabled: false, daysBeforeDue: 3, overdueEveryDays: 7, sendHour: 8 } })
    await getReminderSettings(9)
    expect(mockGet).toHaveBeenCalledWith('/chamas/9/reminder-settings')

    const settings = { enabled: true, daysBeforeDue: 5, overdueEveryDays: 7, sendHour: 9 }
    mockPut.mockResolvedValue({ data: { chamaId: 9, ...settings } })
    await updateReminderSettings(9, settings)
    expect(mockPut).toHaveBeenCalledWith('/chamas/9/reminder-settings', settings)
  })

  it('getSavingsProgress reads the chama savings progress', async () => {
    mockGet.mockResolvedValue({ data: { collected: 1000, target: 5000 } })
    const result = await getSavingsProgress(9)
    expect(mockGet).toHaveBeenCalledWith('/chamas/9/savings-progress')
    expect(result).toEqual({ collected: 1000, target: 5000 })
  })
})
