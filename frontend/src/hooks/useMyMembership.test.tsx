import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useMyMembership } from './useMyMembership'

vi.mock('@react-keycloak/web', () => ({
  useKeycloak: vi.fn(),
}))
vi.mock('../api/members', () => ({
  getMyMembership: vi.fn(),
}))

import { useKeycloak } from '@react-keycloak/web'
import { getMyMembership } from '../api/members'

const mockUseKeycloak = useKeycloak as ReturnType<typeof vi.fn>
const mockGetMyMembership = getMyMembership as ReturnType<typeof vi.fn>

describe('useMyMembership', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('treats SUPER_ADMIN as chairperson and treasurer everywhere without fetching a member row', async () => {
    mockUseKeycloak.mockReturnValue({ keycloak: { hasRealmRole: (r: string) => r === 'SUPER_ADMIN' } })
    const { result } = renderHook(() => useMyMembership(1))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.isSuperAdmin).toBe(true)
    expect(result.current.isChairperson).toBe(true)
    expect(result.current.isTreasurer).toBe(true)
    expect(result.current.isSecretary).toBe(true)
    expect(result.current.isManager).toBe(true)
    expect(mockGetMyMembership).not.toHaveBeenCalled()
  })

  it('fetches the member row and derives roles for a regular user', async () => {
    mockUseKeycloak.mockReturnValue({ keycloak: { hasRealmRole: () => false } })
    mockGetMyMembership.mockResolvedValue({ id: 1, roles: ['TREASURER'] })

    const { result } = renderHook(() => useMyMembership(5))
    expect(result.current.loading).toBe(true)

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(mockGetMyMembership).toHaveBeenCalledWith(5)
    expect(result.current.isTreasurer).toBe(true)
    expect(result.current.isChairperson).toBe(false)
    expect(result.current.isManager).toBe(true)
  })

  it('marks a secretary as neither chairperson, treasurer, nor manager', async () => {
    mockUseKeycloak.mockReturnValue({ keycloak: { hasRealmRole: () => false } })
    mockGetMyMembership.mockResolvedValue({ id: 2, roles: ['SECRETARY'] })

    const { result } = renderHook(() => useMyMembership(5))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.isSecretary).toBe(true)
    expect(result.current.isChairperson).toBe(false)
    expect(result.current.isTreasurer).toBe(false)
    expect(result.current.isManager).toBe(false)
  })

  it('marks a plain member as no role and not a manager', async () => {
    mockUseKeycloak.mockReturnValue({ keycloak: { hasRealmRole: () => false } })
    mockGetMyMembership.mockResolvedValue({ id: 3, roles: ['MEMBER'] })

    const { result } = renderHook(() => useMyMembership(5))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.isManager).toBe(false)
    expect(result.current.isSecretary).toBe(false)
  })

  it('resolves to no roles when the lookup fails (e.g. not a member)', async () => {
    mockUseKeycloak.mockReturnValue({ keycloak: { hasRealmRole: () => false } })
    mockGetMyMembership.mockRejectedValue(new Error('403'))

    const { result } = renderHook(() => useMyMembership(5))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.member).toBeNull()
    expect(result.current.isChairperson).toBe(false)
  })

  it('skips fetching when chamaId is undefined', async () => {
    mockUseKeycloak.mockReturnValue({ keycloak: { hasRealmRole: () => false } })
    const { result } = renderHook(() => useMyMembership(undefined))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(mockGetMyMembership).not.toHaveBeenCalled()
  })

  it('ignores a resolved fetch after the component has unmounted', async () => {
    mockUseKeycloak.mockReturnValue({ keycloak: { hasRealmRole: () => false } })
    let resolveFetch: (m: unknown) => void = () => {}
    mockGetMyMembership.mockReturnValue(new Promise((resolve) => { resolveFetch = resolve }))

    const { unmount } = renderHook(() => useMyMembership(5))
    unmount()
    resolveFetch({ id: 1, roles: ['CHAIRPERSON'] })

    // No assertion needed beyond "does not throw" — this exercises the
    // cancelled-guard branch inside the effect's then()/finally() callbacks.
    await Promise.resolve()
  })
})
