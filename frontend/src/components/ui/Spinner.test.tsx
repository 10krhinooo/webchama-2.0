import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import Spinner from './Spinner'

describe('Spinner', () => {
  it('renders with default size and color classes', () => {
    const { container } = render(<Spinner />)
    expect(container.querySelector('.h-8.w-8')).toBeTruthy()
    expect(container.querySelector('.border-t-primary')).toBeTruthy()
  })

  it('renders the small white variant', () => {
    const { container } = render(<Spinner size="sm" color="white" />)
    expect(container.querySelector('.h-4.w-4')).toBeTruthy()
    expect(container.querySelector('.border-t-white')).toBeTruthy()
  })

  it('renders the large variant', () => {
    const { container } = render(<Spinner size="lg" />)
    expect(container.querySelector('.h-12.w-12')).toBeTruthy()
  })
})
