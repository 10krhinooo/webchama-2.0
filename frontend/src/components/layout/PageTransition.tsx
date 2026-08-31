import { useEffect, useRef, type ReactNode } from 'react'
import { animate, stagger, utils } from 'animejs'
import { useReducedMotion } from '../../hooks/useReducedMotion'

interface Props {
  children: ReactNode
  className?: string
}

/** Matches the durations already in index.css, so a route change feels like the rest of the app. */
const DURATION_MS = 420
const RISE_PX = 14

/**
 * Fades and lifts a page into place on arrival, staggering whatever sits at its top level so a
 * dashboard of cards assembles rather than blinking into existence.
 *
 * Entrance only. React Router has no exit primitive, and holding the outgoing page long enough to
 * animate it away means keeping the previous route mounted, which is a well known source of stale
 * content and double-fetching. The caller keys this on the pathname so it remounts per route.
 *
 * The starting state is applied here rather than in a stylesheet on purpose. A CSS rule that hides
 * the page and waits for script to reveal it leaves the content permanently invisible if that
 * script never runs; setting it from the same effect that animates it means the page is only ever
 * hidden when something is definitely about to show it again.
 */
export default function PageTransition({ children, className }: Props) {
  const container = useRef<HTMLDivElement>(null)
  const reducedMotion = useReducedMotion()

  useEffect(() => {
    const root = container.current
    if (!root || reducedMotion) return

    const targets = root.children.length > 1 ? Array.from(root.children) : [root]

    // React runs effects twice in development. Without resetting first, the second pass would
    // animate from wherever the first had reached and land somewhere short of the real values.
    utils.set(targets, { opacity: 0, translateY: RISE_PX })

    const animation = animate(targets, {
      opacity: 1,
      translateY: 0,
      duration: DURATION_MS,
      ease: 'out(3)',
      delay: targets.length > 1 ? stagger(45) : 0,
    })

    return () => {
      animation.cancel()
      // Whatever the animation was mid-way through, the page has to be left visible: this unmounts
      // on navigation, and a half-faded page frozen at 0.4 opacity is worse than no animation.
      utils.set(targets, { opacity: 1, translateY: 0 })
    }
  }, [reducedMotion])

  return (
    <div ref={container} className={className} data-testid="page-transition">
      {children}
    </div>
  )
}
