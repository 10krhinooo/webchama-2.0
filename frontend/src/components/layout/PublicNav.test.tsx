import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import PublicNav from './PublicNav'

describe('PublicNav', () => {
  it('renders the wordmark and section links', () => {
    render(<PublicNav />)
    expect(screen.getByText('Webchama')).toBeTruthy()
    expect(screen.getByText('How it works')).toBeTruthy()
    expect(screen.getByText('Trust')).toBeTruthy()
    expect(screen.getByText('Roles')).toBeTruthy()
  })

  it('links the primary call to action to the join section', () => {
    render(<PublicNav />)
    expect(screen.getByText('Start your chama').closest('a')).toHaveAttribute('href', '#join')
  })
})
