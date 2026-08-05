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
 * Keycloak realm role, reported here for display purposes only (e.g. a
 * "Platform admin" badge), it grants no chama-scoped access of its own, per
 * MIGRATION_PLAN.md section 5 ("no operational access to any single
 * chama's financial data by default"). A platform admin only gets real
 * roles in a chama by holding an actual member row in it, exactly like
 * anyone else, so this always fetches the caller's own membership.
 */
export function useMyMembership(chamaId: number | undefined): MyMembership {
  const { keycloak } = useKeycloak()
  const isSuperAdmin = keycloak.hasRealmRole('SUPER_ADMIN')
  const [member, setMember] = useState<Member | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!chamaId) {
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
  }, [chamaId])

  const roles = member?.roles ?? []
  const isChairperson = roles.includes('CHAIRPERSON')
  const isTreasurer = roles.includes('TREASURER')
  const isSecretary = roles.includes('SECRETARY')
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
