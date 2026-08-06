import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useReducedMotion } from '../../hooks/useReducedMotion'

interface RevealProps {
  children: ReactNode
  /** fade-up: rises + fades in (default). fade: opacity only. scale: grows + fades in. */
  variant?: 'fade-up' | 'fade' | 'scale'
  delayMs?: number
  className?: string
  /** Reveal immediately on mount instead of waiting for scroll (e.g. above-the-fold content). */
  eager?: boolean
  /** Wrapper element tag, for when the wrapped content needs to keep its semantic landmark (e.g. `section`). */
  as?: 'div' | 'section'
}

const HIDDEN_TRANSFORM: Record<NonNullable<RevealProps['variant']>, string> = {
  'fade-up': 'translateY(16px)',
  fade: 'none',
  scale: 'scale(0.96)',
}

/**
 * Reveal-once-on-scroll, generalized from StampApproval's IntersectionObserver pattern so every
 * section on the marketing page and every dashboard panel shares one entrance choreography instead
 * of each hand-rolling its own observer.
 */
export default function Reveal({ children, variant = 'fade-up', delayMs = 0, className, eager = false, as = 'div' }: RevealProps) {
  const ref = useRef<HTMLElement>(null)
  const [visible, setVisible] = useState(eager)
  const reduceMotion = useReducedMotion()

  useEffect(() => {
    if (eager) return
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true)
          observer.disconnect()
        }
      },
      { threshold: 0.2 },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [eager])

  const Tag = as
  return (
    <Tag
      ref={ref as never}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'none' : HIDDEN_TRANSFORM[variant],
        transition: reduceMotion ? 'none' : `opacity 0.6s ease-out ${delayMs}ms, transform 0.6s cubic-bezier(0.16, 1, 0.3, 1) ${delayMs}ms`,
      }}
    >
      {children}
    </Tag>
  )
}
