import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import PublicFooter from './PublicFooter'

describe('PublicFooter', () => {
  it('renders the wordmark and a copyright line for the current year', () => {
    render(<PublicFooter />)
    expect(screen.getByText('Webchama')).toBeTruthy()
    const year = new Date().getFullYear().toString()
    expect(screen.getByText(new RegExp(year))).toBeTruthy()
  })
})
