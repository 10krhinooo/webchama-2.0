import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import StartChamaCta from './StartChamaCta'

const register = vi.fn()

vi.mock('@react-keycloak/web', () => ({
  useKeycloak: () => ({ keycloak: { register } }),
}))

// The fade before the hand-off is tested in leaveTransition.test.ts. Here it runs straight
// through, so this stays about where the visitor is sent.
vi.mock('../../lib/leaveTransition', () => ({ leaveThen: (action: () => void) => action() }))

describe('StartChamaCta', () => {
  it('sends the visitor into Keycloak registration, redirecting back to My Chamas', () => {
    render(<StartChamaCta className="cta">Start your chama</StartChamaCta>)
    fireEvent.click(screen.getByText('Start your chama'))
    expect(register).toHaveBeenCalledWith({ redirectUri: `${window.location.origin}/my-chamas` })
  })

  it('hands over rather than cutting away, since Keycloak is a different document', async () => {
    vi.resetModules()
    const leave = vi.fn()
    vi.doMock('../../lib/leaveTransition', () => ({ leaveThen: leave }))
    const { default: Cta } = await import('./StartChamaCta')

    render(<Cta className="cta">Start your chama</Cta>)
    fireEvent.click(screen.getByText('Start your chama'))

    expect(leave).toHaveBeenCalledTimes(1)
  })
})
