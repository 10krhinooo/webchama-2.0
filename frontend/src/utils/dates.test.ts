import { describe, it, expect } from 'vitest'
import { formatDate, formatDateTime, ZONE } from './dates'

describe('formatDate', () => {
  it('matches the zone the backend keeps its calendar in', () => {
    expect(ZONE).toBe('Africa/Nairobi')
  })

  it('renders a spelled month, so the day cannot be read two ways', () => {
    // toLocaleDateString() would give 9/8/2026 or 08/09/2026 depending on the device.
    expect(formatDate('2026-09-08')).toBe('8 Sept 2026')
  })

  it('renders a date-only value as the day it was stored', () => {
    // The regression this guards: parsing 2026-09-08 as UTC midnight and shifting it into a
    // western zone renders 7 Sept, a day earlier than the secretary scheduled.
    expect(formatDate('2026-01-01')).toBe('1 Jan 2026')
    expect(formatDate('2026-12-31')).toBe('31 Dec 2026')
  })

  it('renders an instant on the chama clock, not the device clock', () => {
    // 22:30 UTC is already the next day in Nairobi (UTC+3).
    expect(formatDate('2026-09-08T22:30:00Z')).toBe('9 Sept 2026')
  })

  it.each([null, undefined, ''])('renders a dash for %s', (value) => {
    expect(formatDate(value)).toBe('—')
  })

  it('renders a dash rather than "Invalid Date" for an unparseable value', () => {
    expect(formatDate('not-a-date')).toBe('—')
  })
})

describe('formatDateTime', () => {
  it('renders the time on the chama clock', () => {
    expect(formatDateTime('2026-09-08T11:30:00Z')).toBe('8 Sept 2026, 14:30')
  })

  it('rolls over to the next Nairobi day for a late-evening UTC instant', () => {
    expect(formatDateTime('2026-09-08T22:30:00Z')).toBe('9 Sept 2026, 01:30')
  })

  it.each([null, undefined, ''])('renders a dash for %s', (value) => {
    expect(formatDateTime(value)).toBe('—')
  })

  it('renders a dash for an unparseable value', () => {
    expect(formatDateTime('not-a-date')).toBe('—')
  })
})
