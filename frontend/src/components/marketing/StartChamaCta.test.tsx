import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import StartChamaCta from './StartChamaCta'

const register = vi.fn()

vi.mock('@react-keycloak/web', () => ({
  useKeycloak: () => ({ keycloak: { register } }),
}))

describe('StartChamaCta', () => {
  it('sends the visitor into Keycloak registration, redirecting back to My Chamas', () => {
    render(<StartChamaCta className="cta">Start your chama</StartChamaCta>)
    fireEvent.click(screen.getByText('Start your chama'))
    expect(register).toHaveBeenCalledWith({ redirectUri: `${window.location.origin}/my-chamas` })
  })
})
