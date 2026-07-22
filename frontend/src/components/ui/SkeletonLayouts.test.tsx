import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { TablePageSkeleton } from './SkeletonLayouts'

describe('TablePageSkeleton', () => {
  it('renders the default number of skeleton rows plus header and filter', () => {
    const { container } = render(<TablePageSkeleton />)
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(8)
  })

  it('omits the button and filter skeletons when disabled', () => {
    const { container } = render(<TablePageSkeleton rows={2} withButton={false} withFilter={false} />)
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0)
  })
})
