import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./client', () => ({
  client: {
    get: vi.fn(),
  },
}))

import { client } from './client'
import { getSecurityEvents } from './securityEvents'

const mockGet = client.get as ReturnType<typeof vi.fn>

describe('securityEvents api', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('fetches security events with no filters by default', async () => {
    mockGet.mockResolvedValue({ data: [] })
    const result = await getSecurityEvents()
    expect(mockGet).toHaveBeenCalledWith('/admin/security-events', { params: {} })
    expect(result).toEqual([])
  })

  it('passes filters through as query params', async () => {
    mockGet.mockResolvedValue({ data: [{ id: 1 }] })
    const result = await getSecurityEvents({ type: 'LOGIN_ERROR', error: 'user_temporarily_disabled', keycloakUserId: 'user-1', limit: 50 })
    expect(mockGet).toHaveBeenCalledWith('/admin/security-events', {
      params: { type: 'LOGIN_ERROR', error: 'user_temporarily_disabled', keycloakUserId: 'user-1', limit: 50 },
    })
    expect(result).toEqual([{ id: 1 }])
  })
})
