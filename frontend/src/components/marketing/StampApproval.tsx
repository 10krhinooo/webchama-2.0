import { useEffect, useRef, useState } from "react"

interface StampProps {
  label: string
  sublabel: string
  visible: boolean
  delayMs: number
  rotate: string
  reduceMotion: boolean
}

function Stamp({ label, sublabel, visible, delayMs, rotate, reduceMotion }: StampProps) {
  return (
    <div
      className="flex flex-col items-center justify-center rounded-lg border-4 border-paper px-6 py-5 text-center"
      style={{
        transform: visible ? `rotate(${rotate})` : `rotate(${rotate}) scale(0.6)`,
        opacity: visible ? 1 : 0,
        transition: reduceMotion ? "none" : `opacity 0.4s ease-out ${delayMs}ms, transform 0.4s ease-out ${delayMs}ms`,
      }}
    >
      <span className="font-mono text-2xl font-bold uppercase tracking-wide text-paper">{label}</span>
      <span className="mt-1 font-mono text-xs uppercase tracking-widest text-paper/70">{sublabel}</span>
    </div>
  )
}

/**
 * Visualizes maker-checker approval, the single feature chama treasurers
 * and chairs care about most, as two ink stamps landing on a ledger entry.
 * Reveals once when the section scrolls into view, not on every scroll.
 */
export default function StampApproval() {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  const [reduceMotion, setReduceMotion] = useState(false)

  useEffect(() => {
    setReduceMotion(window.matchMedia("(prefers-reduced-motion: reduce)").matches)

    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true)
          observer.disconnect()
        }
      },
      { threshold: 0.4 },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={ref} className="flex flex-col items-center gap-6 sm:flex-row sm:justify-center">
      <Stamp
        label="Requested"
        sublabel="Treasurer"
        visible={visible}
        delayMs={0}
        rotate="-6deg"
        reduceMotion={reduceMotion}
      />
      <svg viewBox="0 0 24 24" className="h-6 w-6 rotate-90 text-paper/50 sm:rotate-0" aria-hidden="true">
        <path d="M4 12h16m0 0l-6-6m6 6l-6 6" stroke="currentColor" strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <Stamp
        label="Approved"
        sublabel="Chairperson"
        visible={visible}
        delayMs={reduceMotion ? 0 : 500}
        rotate="4deg"
        reduceMotion={reduceMotion}
      />
    </div>
  )
}
