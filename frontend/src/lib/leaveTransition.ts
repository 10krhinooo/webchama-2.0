import { animate, utils } from 'animejs'

/** Long enough to read as a hand-off, short enough not to sit between a tap and the next page. */
const DURATION_MS = 220

/**
 * A safety net. If the navigation never happens, the tab is left blank with no way back, so the
 * page restores itself well after any real hand-off would have taken it away.
 */
const RESTORE_AFTER_MS = 1500

/**
 * Fades the page out, then does the thing that navigates away.
 *
 * Signing in and out leaves this document entirely: Keycloak is a different origin, so nothing can
 * animate across the navigation itself. What can be done is the half on this side, so a tap on
 * "Sign in" hands over rather than cutting to a white flash.
 *
 * Reduced motion skips straight to the action; the point is the navigation, not the fade.
 */
export function leaveThen(action: () => void, reducedMotion: boolean): void {
  if (reducedMotion || typeof document === 'undefined') {
    action()
    return
  }

  animate(document.body, {
    opacity: 0,
    duration: DURATION_MS,
    ease: 'in(2)',
    onComplete: () => {
      action()
      window.setTimeout(() => utils.set(document.body, { opacity: 1 }), RESTORE_AFTER_MS)
    },
  })
}
