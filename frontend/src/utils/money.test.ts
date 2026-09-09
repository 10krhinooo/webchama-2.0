import { describe, it, expect } from 'vitest'
import { formatMoney, formatAmount, DEFAULT_CURRENCY } from './money'

describe('formatMoney', () => {
  it('renders KES through its local symbol', () => {
    expect(formatMoney(50000, 'KES')).toBe('Ksh 50,000.00')
  })

  it('defaults to the chama column default when no currency is given', () => {
    expect(DEFAULT_CURRENCY).toBe('KES')
    expect(formatMoney(50000)).toBe(formatMoney(50000, 'KES'))
  })

  it('keeps the shillings a bare toLocaleString would have hidden', () => {
    expect(formatMoney(1500.5)).toBe('Ksh 1,500.50')
  })

  it('honours a chama on another currency rather than assuming KES', () => {
    expect(formatMoney(50000, 'TZS')).toContain('TZS')
    expect(formatMoney(50000, 'TZS')).toContain('50,000')
  })

  it('groups thousands the same way regardless of the device locale', () => {
    // The point of pinning en-KE: this assertion holds on a de-DE machine, where an unpinned
    // toLocaleString() would produce "50.000".
    expect(formatMoney(50000)).toContain('50,000')
  })

  // ICU accepts any well-formed three-letter code, so an unrecognised-but-valid one still
  // formats, just without a local symbol to swap in.
  it('renders an unrecognised but well-formed code as itself', () => {
    expect(formatMoney(1500.5, 'ZZZ')).toBe('ZZZ 1,500.50')
  })

  // chama.currency is VARCHAR(3) with no CHECK constraint behind it, so a chama saved with a
  // truncated or empty value reaches the front end. Intl throws a RangeError on those, which
  // would otherwise blank every amount on the page rather than one of them.
  it.each(['K', '', 'KESH'])('degrades instead of throwing on the malformed code %o', (code) => {
    expect(formatMoney(1500.5, code)).toBe(`${code} 1,500.50`)
  })

  it.each([NaN, Infinity, -Infinity])('renders a dash rather than "NaN" for %s', (value) => {
    expect(formatMoney(value)).toBe('—')
  })

  it('renders negative amounts', () => {
    expect(formatMoney(-200)).toContain('200.00')
  })
})

describe('formatAmount', () => {
  it('groups and fixes decimals without attaching a currency', () => {
    expect(formatAmount(50000)).toBe('50,000.00')
  })

  it('renders a dash for a non-finite amount', () => {
    expect(formatAmount(NaN)).toBe('—')
  })
})
