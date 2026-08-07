import { describe, it, expect } from 'vitest'
import { roleBadgeText } from './roleBadges'

describe('roleBadgeText', () => {
  it('labels platform admins regardless of their chama roles', () => {
    expect(roleBadgeText(true, ['MEMBER'])).toBe('Platform admin')
  })

  it('falls back to Member when there are no chama roles', () => {
    expect(roleBadgeText(false, [])).toBe('Member')
  })

  it('joins known role labels', () => {
    expect(roleBadgeText(false, ['CHAIRPERSON', 'TREASURER'])).toBe('Chairperson, Treasurer')
  })

  it('falls back to the raw role name for an unrecognized role', () => {
    expect(roleBadgeText(false, ['AUDITOR'])).toBe('AUDITOR')
  })
})
