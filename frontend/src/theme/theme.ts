/** What the user chose. `system` defers to the OS rather than pinning a value. */
export type ThemePreference = 'light' | 'dark' | 'system'

/** What is actually on screen. `system` has been resolved away by this point. */
export type ResolvedTheme = 'light' | 'dark'

export const THEME_STORAGE_KEY = 'webchama-theme'

const PREFERENCES: ThemePreference[] = ['light', 'dark', 'system']

export function isThemePreference(value: unknown): value is ThemePreference {
  return typeof value === 'string' && (PREFERENCES as string[]).includes(value)
}

/**
 * Reads the stored preference, falling back to `system`.
 *
 * Storage access throws outright in some privacy modes rather than returning null, so this never
 * assumes the read will succeed. A browser that refuses to answer is treated the same as a browser
 * with nothing stored.
 */
export function readStoredPreference(): ThemePreference {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY)
    return isThemePreference(stored) ? stored : 'system'
  } catch {
    return 'system'
  }
}

export function storePreference(preference: ThemePreference): void {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, preference)
  } catch {
    // A preference that cannot be persisted still applies for this session, which is better than
    // failing the render.
  }
}

export function prefersDark(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

export function resolveTheme(preference: ThemePreference, systemPrefersDark: boolean): ResolvedTheme {
  if (preference === 'system') return systemPrefersDark ? 'dark' : 'light'
  return preference
}

/** The order the toggle cycles through, so a keyboard user reaches every option. */
export function nextPreference(current: ThemePreference): ThemePreference {
  const index = PREFERENCES.indexOf(current)
  return PREFERENCES[(index + 1) % PREFERENCES.length]
}
