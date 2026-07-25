import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import PublicNav from './PublicNav'

const register = vi.fn()

vi.mock('@react-keycloak/web', () => ({
  useKeycloak: () => ({ keycloak: { register } }),
}))

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

  it('sends the primary call to action into Keycloak registration', () => {
    renderNav()
    fireEvent.click(screen.getByText('Start your chama'))
    expect(register).toHaveBeenCalledWith({ redirectUri: `${window.location.origin}/my-chamas` })
  })

  it('links Sign In to the staff area, which redirects to Keycloak login', () => {
    renderNav()
    expect(screen.getByText('Sign In').closest('a')).toHaveAttribute('href', '/my-chamas')
  })
})
