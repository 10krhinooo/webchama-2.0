import { Monitor, Moon, Sun } from 'lucide-react'
import { useTheme } from '../../theme/useTheme'
import { nextPreference, type ThemePreference } from '../../theme/theme'

const LABELS: Record<ThemePreference, string> = {
  light: 'Light',
  dark: 'Dark',
  system: 'System',
}

const ICONS: Record<ThemePreference, typeof Sun> = {
  light: Sun,
  dark: Moon,
  system: Monitor,
}

/**
 * Cycles light to dark to system.
 *
 * The accessible name states both the current setting and what activating it will do, because the
 * icon alone cannot convey that a third state exists.
 */
export default function ThemeToggle({ className = '' }: { className?: string }) {
  const { preference, setPreference } = useTheme()
  const Icon = ICONS[preference]
  const next = nextPreference(preference)

  return (
    <button
      type="button"
      data-testid="theme-toggle"
      onClick={() => setPreference(next)}
      title={`Theme: ${LABELS[preference]}`}
      aria-label={`Theme: ${LABELS[preference]}. Switch to ${LABELS[next].toLowerCase()}.`}
      className={`inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted transition-colors hover:bg-paper-dim hover:text-ink ${className}`}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
    </button>
  )
}
