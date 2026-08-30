import { useEffect, useState } from 'react'

/**
 * Resolves design tokens to concrete colours for a charting library.
 *
 * Everywhere else a colour is applied with a Tailwind class and the theme takes care of itself.
 * Recharts cannot use that for two of the three places it needs a colour: the legend swatch and a
 * slice label are drawn from the `fill` *prop*, not from the element's class, so a series styled
 * only with `className` renders correctly and is then listed against a black square. SVG
 * presentation attributes do not accept `var()` either, so the token has to be read out here.
 *
 * Watches the document element's class rather than subscribing to the theme context. The class is
 * what actually decides which values the tokens resolve to, so reading it directly keeps this
 * usable in any tree, including a test that renders a page without a provider around it.
 */
export function useChartColors<T extends string>(tokens: readonly T[]): Record<T, string> {
  const [colors, setColors] = useState<Record<T, string>>(() => resolve(tokens))

  useEffect(() => {
    if (typeof MutationObserver === 'undefined') return

    const observer = new MutationObserver(() => setColors(resolve(tokens)))
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    // The class may already have changed between the first render and this effect.
    setColors(resolve(tokens))
    return () => observer.disconnect()
    // `tokens` is a literal at every call site, so re-subscribing on identity changes would mean
    // tearing down and rebuilding the observer on every render for no benefit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return colors
}

function resolve<T extends string>(tokens: readonly T[]): Record<T, string> {
  const styles = typeof window === 'undefined' ? null : getComputedStyle(document.documentElement)
  const entries = tokens.map((token) => {
    const triple = styles?.getPropertyValue(`--color-${token}`).trim()
    // The tokens are stored as "R G B" so they can compose with an alpha channel elsewhere.
    return [token, triple ? `rgb(${triple})` : 'currentColor'] as const
  })
  return Object.fromEntries(entries) as Record<T, string>
}
