import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import RouteFallback from './RouteFallback'

describe('RouteFallback', () => {
  it('announces itself as a status region, so a screen reader hears the wait', () => {
    render(<RouteFallback />)
    expect(screen.getByRole('status')).toBeTruthy()
  })

  it('says it is loading', () => {
    render(<RouteFallback />)
    expect(screen.getByText('Loading…')).toBeTruthy()
  })
})
