import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import PublicNav from './PublicNav'

function renderNav() {
  return render(
    <MemoryRouter>
      <PublicNav />
    </MemoryRouter>,
  )
}

describe('PublicNav', () => {
  it('renders the wordmark and section links', () => {
    renderNav()
    expect(screen.getByText('Webchama')).toBeTruthy()
    expect(screen.getByText('How it works')).toBeTruthy()
    expect(screen.getByText('Trust')).toBeTruthy()
    expect(screen.getByText('Roles')).toBeTruthy()
  })

  it('links the primary call to action to the join section', () => {
    renderNav()
    expect(screen.getByText('Start your chama').closest('a')).toHaveAttribute('href', '#join')
  })

  it('links Sign In to the staff area, which redirects to Keycloak login', () => {
    renderNav()
    expect(screen.getByText('Sign In').closest('a')).toHaveAttribute('href', '/my-chamas')
  })
})
