export const ROLE_LABELS: Record<string, string> = {
  CHAIRPERSON: 'Chairperson',
  TREASURER: 'Treasurer',
  SECRETARY: 'Secretary',
  MEMBER: 'Member',
}

export function roleBadgeText(isSuperAdmin: boolean, roles: string[]): string {
  if (isSuperAdmin) return 'Platform admin'
  if (roles.length === 0) return 'Member'
  return roles.map((r) => ROLE_LABELS[r] ?? r).join(', ')
}
