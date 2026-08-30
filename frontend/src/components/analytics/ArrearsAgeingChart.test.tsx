import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import ArrearsAgeingChart from './ArrearsAgeingChart'
import type { ArrearsBucket } from '../../api/analytics'

const EMPTY: ArrearsBucket[] = [
  { bucket: '1-30', members: 0, amount: '0.00' },
  { bucket: '31-60', members: 0, amount: '0.00' },
  { bucket: '61-90', members: 0, amount: '0.00' },
  { bucket: '90+', members: 0, amount: '0.00' },
]

describe('ArrearsAgeingChart', () => {
  it('renders every bucket the backend sends, including the empty ones', () => {
    render(<ArrearsAgeingChart buckets={[
      { bucket: '1-30', members: 2, amount: '1000.00' },
      { bucket: '31-60', members: 0, amount: '0.00' },
      { bucket: '61-90', members: 1, amount: '500.00' },
      { bucket: '90+', members: 0, amount: '0.00' },
    ]} />)

    // Dropping the empty categories would make the ageing profile read as a different shape.
    expect(screen.getByText('1-30 days')).toBeTruthy()
    expect(screen.getByText('31-60 days')).toBeTruthy()
    expect(screen.getByText('61-90 days')).toBeTruthy()
    expect(screen.getByText('90+ days')).toBeTruthy()
  })

  it('totals what is owed across the buckets', () => {
    render(<ArrearsAgeingChart buckets={[
      { bucket: '1-30', members: 2, amount: '1000.00' },
      { bucket: '31-60', members: 0, amount: '0.00' },
      { bucket: '61-90', members: 1, amount: '500.50' },
      { bucket: '90+', members: 0, amount: '0.00' },
    ]} />)

    expect(screen.getByText('1,500.5 owed')).toBeTruthy()
  })

  it('says so plainly when nothing is in arrears', () => {
    render(<ArrearsAgeingChart buckets={EMPTY} />)

    expect(screen.getByText('Nothing is in arrears.')).toBeTruthy()
    expect(screen.queryByText('1-30 days')).toBeNull()
  })

  it('pluralises the member count', () => {
    render(<ArrearsAgeingChart buckets={[
      { bucket: '1-30', members: 1, amount: '100.00' },
      { bucket: '31-60', members: 2, amount: '200.00' },
      { bucket: '61-90', members: 0, amount: '0.00' },
      { bucket: '90+', members: 0, amount: '0.00' },
    ]} />)

    expect(screen.getByText('1 member')).toBeTruthy()
    expect(screen.getByText('2 members')).toBeTruthy()
  })
})
