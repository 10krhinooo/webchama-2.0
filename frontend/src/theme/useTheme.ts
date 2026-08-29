import { useContext } from 'react'
import { ThemeContext, type ThemeContextValue } from './ThemeProvider'

/**
 * Throws rather than returning a default when used outside the provider. A silent fallback here
 * would render a component in the wrong theme with no indication of why.
 */
export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}
