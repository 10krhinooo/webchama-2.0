import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import PasswordRules, { passwordValid } from './PasswordRules'

describe('passwordValid', () => {
  it('rejects an empty password', () => {
    expect(passwordValid('')).toBe(false)
  })

  it('rejects a password missing a rule', () => {
    expect(passwordValid('lowercase1!')).toBe(false)
  })

  it('accepts a password meeting every rule', () => {
    expect(passwordValid('Abcdef1!')).toBe(true)
  })
})

describe('PasswordRules', () => {
  it('renders nothing when the password is empty', () => {
    const { container } = render(<PasswordRules password="" />)
    expect(container).toBeEmptyDOMElement()
  })

  it('marks unmet rules with a cross and text-muted', () => {
    const { getByText } = render(<PasswordRules password="abc" />)
    const item = getByText('At least 8 characters').closest('li')
    expect(item?.className).toContain('text-muted')
    expect(item?.textContent).toContain('✗')
  })

  it('marks met rules with a check and text-success', () => {
    const { getByText } = render(<PasswordRules password="Abcdef1!" />)
    const item = getByText('At least 8 characters').closest('li')
    expect(item?.className).toContain('text-success')
    expect(item?.textContent).toContain('✓')
  })
})
