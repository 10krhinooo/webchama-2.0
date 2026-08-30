import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import PublicNav from './PublicNav'
import ThemeProvider from '../../theme/ThemeProvider'

const register = vi.fn()

vi.mock('@react-keycloak/web', () => ({
  useKeycloak: () => ({ keycloak: { register } }),
}))

function renderNav() {
  return render(
    <ThemeProvider>
      <MemoryRouter>
        <PublicNav />
      </MemoryRouter>
    </ThemeProvider>,
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

  it('reveals the section links and CTAs in a mobile menu when the toggle is opened', () => {
    renderNav()
    expect(screen.getAllByText('How it works')).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: /open menu/i }))
    expect(screen.getAllByText('How it works')).toHaveLength(2)
    expect(screen.getAllByText('Sign In')).toHaveLength(2)
  })

  it('closes the mobile menu after a link inside it is clicked', () => {
    renderNav()
    fireEvent.click(screen.getByRole('button', { name: /open menu/i }))
    expect(screen.getAllByText('Trust')).toHaveLength(2)
    fireEvent.click(screen.getAllByText('Trust')[1])
    expect(screen.getAllByText('Trust')).toHaveLength(1)
  })

  it('closes the mobile menu after the Sign In link inside it is clicked', () => {
    renderNav()
    fireEvent.click(screen.getByRole('button', { name: /open menu/i }))
    fireEvent.click(screen.getAllByText('Sign In')[1])
    expect(screen.getAllByText('Sign In')).toHaveLength(1)
  })

  it('closes the mobile menu after the Start your chama CTA inside it is clicked', () => {
    renderNav()
    fireEvent.click(screen.getByRole('button', { name: /open menu/i }))
    fireEvent.click(screen.getAllByText('Start your chama')[1])
    expect(screen.getAllByText('Start your chama')).toHaveLength(1)
  })

  it('shrinks the nav once the page is scrolled past the threshold', async () => {
    renderNav()
    const nav = document.querySelector('nav')!
    expect(nav.className).toContain('scale-100')

    Object.defineProperty(window, 'scrollY', { value: 100, writable: true, configurable: true })
    fireEvent.scroll(window)
    await waitFor(() => expect(nav.className).toContain('scale-[0.97]'))
  })

  it('restores the nav when scrolled back to the top', async () => {
    renderNav()
    const nav = document.querySelector('nav')!

    Object.defineProperty(window, 'scrollY', { value: 100, writable: true, configurable: true })
    fireEvent.scroll(window)
    await waitFor(() => expect(nav.className).toContain('scale-[0.97]'))

    Object.defineProperty(window, 'scrollY', { value: 0, writable: true, configurable: true })
    fireEvent.scroll(window)
    await waitFor(() => expect(nav.className).toContain('scale-100'))
  })

  // The handler guards itself with a ticking flag so a burst of scroll events collapses into a
  // single frame of work. Firing several in a row must still settle on the final position.
  it('coalesces a burst of scroll events into one update', async () => {
    renderNav()
    const nav = document.querySelector('nav')!

    Object.defineProperty(window, 'scrollY', { value: 200, writable: true, configurable: true })
    fireEvent.scroll(window)
    fireEvent.scroll(window)
    fireEvent.scroll(window)
    await waitFor(() => expect(nav.className).toContain('scale-[0.97]'))
  })

  it('removes the scroll listener on unmount', () => {
    const remove = vi.spyOn(window, 'removeEventListener')
    const { unmount } = renderNav()
    unmount()
    expect(remove).toHaveBeenCalledWith('scroll', expect.any(Function))
    remove.mockRestore()
  })
})
