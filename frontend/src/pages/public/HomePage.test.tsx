import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import HomePage from './HomePage'

describe('HomePage', () => {
  it('renders the Webchama heading and tagline', () => {
    render(<HomePage />)
    expect(screen.getByText('Webchama')).toBeTruthy()
    expect(screen.getByText('Table banking, done properly.')).toBeTruthy()
  })
})
