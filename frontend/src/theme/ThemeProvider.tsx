import { createContext, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  prefersDark,
  readStoredPreference,
  resolveTheme,
  storePreference,
  type ResolvedTheme,
  type ThemePreference,
} from './theme'

export interface ThemeContextValue {
  /** What the user chose, including `system`. */
  preference: ThemePreference
  /** What is on screen right now, with `system` already resolved. */
  theme: ResolvedTheme
  setPreference: (preference: ThemePreference) => void
}

export const ThemeContext = createContext<ThemeContextValue | null>(null)

/**
 * Owns the `dark` class on the document element, which is what every `dark:` variant keys off.
 *
 * The preference is stored, but the resolved theme is not: storing `system` and recomputing it on
 * every load is what lets the OS switching to dark at sunset carry through without the app having
 * to be reopened.
 */
export default function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(readStoredPreference)
  const [systemPrefersDark, setSystemPrefersDark] = useState(prefersDark)

  // Only relevant while the preference is `system`, but the listener is unconditional so that
  // switching back to `system` does not depend on an OS change having happened since.
  useEffect(() => {
    const query = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => setSystemPrefersDark(query.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  const theme = resolveTheme(preference, systemPrefersDark)

  useEffect(() => {
    const root = document.documentElement

    // Suppress transitions for the duration of the swap. Without this every element with a color
    // transition animates on its own timing and the change reads as a smear.
    root.classList.add('theme-transition')
    root.classList.toggle('dark', theme === 'dark')

    const frame = window.requestAnimationFrame(() => {
      root.classList.remove('theme-transition')
    })
    return () => window.cancelAnimationFrame(frame)
  }, [theme])

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next)
    storePreference(next)
  }, [])

  const value = useMemo(
    () => ({ preference, theme, setPreference }),
    [preference, theme, setPreference],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}
