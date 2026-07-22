import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { SkeletonLine, SkeletonBlock, SkeletonCircle } from './Skeleton'

describe('Skeleton primitives', () => {
  it('SkeletonLine applies the pulse and className', () => {
    const { container } = render(<SkeletonLine className="h-4 w-20" />)
    expect(container.querySelector('.animate-pulse.h-4.w-20')).toBeTruthy()
  })

  it('SkeletonBlock applies the pulse and className', () => {
    const { container } = render(<SkeletonBlock className="h-9 w-28" />)
    expect(container.querySelector('.animate-pulse.rounded-lg.h-9.w-28')).toBeTruthy()
  })

  it('SkeletonCircle applies the pulse and className', () => {
    const { container } = render(<SkeletonCircle className="h-10 w-10" />)
    expect(container.querySelector('.animate-pulse.rounded-full.h-10.w-10')).toBeTruthy()
  })
})
