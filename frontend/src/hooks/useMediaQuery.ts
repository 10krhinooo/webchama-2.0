import { useEffect, useState } from 'react'

/**
 * Whether a CSS media query currently matches. Re-evaluates if the viewport changes mid-session.
 *
 * Shaped like `useReducedMotion`, which does the same job for one fixed query.
 *
 * The default when `matchMedia` is missing is `false`, which is what makes this safe in tests: a
 * component asking "am I on a narrow screen" gets "no" under jsdom and renders its wide layout.
 * A test that wants the narrow branch says so explicitly by stubbing `window.matchMedia`, rather
 * than every other test having to work around a layout it never asked for.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(
    () => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(query).matches,
  )

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    const list = window.matchMedia(query)
    const onChange = () => setMatches(list.matches)
    setMatches(list.matches)
    list.addEventListener('change', onChange)
    return () => list.removeEventListener('change', onChange)
  }, [query])

  return matches
}

/**
 * True below Tailwind's `md` breakpoint, the width at which the data tables stop being tables.
 *
 * Stated once here because it has to agree with `md` in tailwind.config.js, and a disagreement
 * between the two is invisible until someone resizes a window onto the seam.
 */
export function useIsCompact(): boolean {
  return useMediaQuery('(max-width: 767px)')
}
