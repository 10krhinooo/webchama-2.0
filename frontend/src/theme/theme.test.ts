import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  isThemePreference,
  nextPreference,
  prefersDark,
  readStoredPreference,
  resolveTheme,
  storePreference,
  THEME_STORAGE_KEY,
} from './theme'

afterEach(() => {
  vi.unstubAllGlobals()
  window.localStorage.clear()
})

/** Replaces localStorage with one whose accessors throw, as a privacy-mode browser does. */
function stubThrowingStorage() {
  vi.stubGlobal('localStorage', {
    getItem: () => {
      throw new Error('denied')
    },
    setItem: () => {
      throw new Error('denied')
    },
  })
}

describe('isThemePreference', () => {
  it.each(['light', 'dark', 'system'])('accepts %s', (value) => {
    expect(isThemePreference(value)).toBe(true)
  })

  it.each([['sepia'], [''], [null], [undefined], [42], [{}]])('rejects %s', (value) => {
    expect(isThemePreference(value)).toBe(false)
  })
})

describe('readStoredPreference', () => {
  it('returns the stored preference', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'dark')
    expect(readStoredPreference()).toBe('dark')
  })

  it('falls back to system when nothing is stored', () => {
    expect(readStoredPreference()).toBe('system')
  })

  it('falls back to system when the stored value is not a known preference', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'sepia')
    expect(readStoredPreference()).toBe('system')
  })

  it('falls back to system when storage access throws', () => {
    stubThrowingStorage()
    expect(readStoredPreference()).toBe('system')
  })
})

describe('storePreference', () => {
  it('writes the preference', () => {
    storePreference('light')
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('light')
  })

  it('does not throw when storage refuses the write', () => {
    stubThrowingStorage()
    expect(() => storePreference('dark')).not.toThrow()
  })
})

describe('prefersDark', () => {
  it('reflects the media query', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }) as unknown as MediaQueryList)
    expect(prefersDark()).toBe(true)

    vi.stubGlobal('matchMedia', () => ({ matches: false }) as unknown as MediaQueryList)
    expect(prefersDark()).toBe(false)
  })
})

describe('resolveTheme', () => {
  it('returns an explicit preference unchanged, whatever the system says', () => {
    expect(resolveTheme('light', true)).toBe('light')
    expect(resolveTheme('dark', false)).toBe('dark')
  })

  it('defers to the system only when the preference is system', () => {
    expect(resolveTheme('system', true)).toBe('dark')
    expect(resolveTheme('system', false)).toBe('light')
  })
})

describe('nextPreference', () => {
  it('cycles through every option and back to the start', () => {
    expect(nextPreference('light')).toBe('dark')
    expect(nextPreference('dark')).toBe('system')
    expect(nextPreference('system')).toBe('light')
  })
})
