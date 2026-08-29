import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, act, fireEvent, waitFor } from '@testing-library/react'
import ThemeProvider from './ThemeProvider'
import { useTheme } from './useTheme'
import { THEME_STORAGE_KEY } from './theme'

/** Lets a test drive the OS-level colour-scheme change event. */
function stubMatchMedia(matches: boolean) {
  const listeners = new Set<() => void>()
  const query = {
    get matches() {
      return currentMatches
    },
    media: '(prefers-color-scheme: dark)',
    addEventListener: (_: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_: string, listener: () => void) => listeners.delete(listener),
  }
  let currentMatches = matches
  vi.stubGlobal('matchMedia', () => query as unknown as MediaQueryList)
  return {
    setSystemDark(next: boolean) {
      currentMatches = next
      act(() => {
        listeners.forEach((listener) => listener())
      })
    },
    listenerCount: () => listeners.size,
  }
}

function Probe() {
  const { preference, theme, setPreference } = useTheme()
  return (
    <div>
      <span data-testid="preference">{preference}</span>
      <span data-testid="theme">{theme}</span>
      <button onClick={() => setPreference('dark')}>go dark</button>
      <button onClick={() => setPreference('system')}>go system</button>
    </div>
  )
}

beforeEach(() => {
  window.localStorage.clear()
  document.documentElement.className = ''
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('ThemeProvider', () => {
  it('defaults to the system preference and resolves it against the OS', () => {
    stubMatchMedia(true)
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    )
    expect(screen.getByTestId('preference').textContent).toBe('system')
    expect(screen.getByTestId('theme').textContent).toBe('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('resolves system to light when the OS is light', () => {
    stubMatchMedia(false)
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    )
    expect(screen.getByTestId('theme').textContent).toBe('light')
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })

  it('restores a stored explicit preference over the OS setting', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'dark')
    stubMatchMedia(false)
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    )
    expect(screen.getByTestId('preference').textContent).toBe('dark')
    expect(screen.getByTestId('theme').textContent).toBe('dark')
  })

  it('persists a preference change and applies it to the document', () => {
    stubMatchMedia(false)
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    )
    fireEvent.click(screen.getByText('go dark'))
    expect(screen.getByTestId('theme').textContent).toBe('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark')
  })

  it('follows the OS when the preference is system and the OS flips mid-session', () => {
    const media = stubMatchMedia(false)
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    )
    expect(screen.getByTestId('theme').textContent).toBe('light')

    media.setSystemDark(true)
    expect(screen.getByTestId('theme').textContent).toBe('dark')
  })

  it('ignores an OS change while an explicit preference is set', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'light')
    const media = stubMatchMedia(false)
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    )
    media.setSystemDark(true)
    expect(screen.getByTestId('theme').textContent).toBe('light')
  })

  it('switching back to system re-reads the current OS setting', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'light')
    const media = stubMatchMedia(false)
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    )
    media.setSystemDark(true)
    fireEvent.click(screen.getByText('go system'))
    expect(screen.getByTestId('theme').textContent).toBe('dark')
  })

  it('removes the media listener on unmount', () => {
    const media = stubMatchMedia(false)
    const { unmount } = render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    )
    expect(media.listenerCount()).toBe(1)
    unmount()
    expect(media.listenerCount()).toBe(0)
  })

  it('suppresses transitions for one frame while the theme swaps, then restores them', async () => {
    stubMatchMedia(false)
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    )
    // Applied synchronously with the class swap, so nothing animates through the change.
    expect(document.documentElement.classList.contains('theme-transition')).toBe(true)

    // Released on the next frame, so ordinary hover and focus transitions still work afterwards.
    await waitFor(() =>
      expect(document.documentElement.classList.contains('theme-transition')).toBe(false),
    )
  })
})

describe('useTheme', () => {
  it('throws when used outside the provider, rather than silently rendering the wrong theme', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<Probe />)).toThrow('useTheme must be used within a ThemeProvider')
    consoleError.mockRestore()
  })
})
