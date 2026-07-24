import { useEffect, useState } from 'react'
import { useKeycloak } from '@react-keycloak/web'
import { getMyMembership, type Member, type MemberRoleType } from '../api/members'

export interface MyMembership {
  member: Member | null
  roles: MemberRoleType[]
  isSuperAdmin: boolean
  isChairperson: boolean
  isTreasurer: boolean
  isSecretary: boolean
  isManager: boolean
  loading: boolean
}

/**
 * Resolves the caller's own role(s) within one chama. SUPER_ADMIN is a real
 * Keycloak realm role and bypasses every chama-scoped check, so it is read
 * straight from the token rather than from a member row, which a platform
 * admin may not even have.
 */
export function useMyMembership(chamaId: number | undefined): MyMembership {
  const { keycloak } = useKeycloak()
  const isSuperAdmin = keycloak.hasRealmRole('SUPER_ADMIN')
  const [member, setMember] = useState<Member | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!chamaId || isSuperAdmin) {
      setMember(null)
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    getMyMembership(chamaId)
      .then((m) => {
        if (!cancelled) setMember(m)
      })
      .catch(() => {
        if (!cancelled) setMember(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [chamaId, isSuperAdmin])

  const roles = member?.roles ?? []
  const isChairperson = isSuperAdmin || roles.includes('CHAIRPERSON')
  const isTreasurer = isSuperAdmin || roles.includes('TREASURER')
  const isSecretary = isSuperAdmin || roles.includes('SECRETARY')
  return {
    member,
    roles,
    isSuperAdmin,
    isChairperson,
    isTreasurer,
    isSecretary,
    isManager: isChairperson || isTreasurer,
    loading,
  }
}
