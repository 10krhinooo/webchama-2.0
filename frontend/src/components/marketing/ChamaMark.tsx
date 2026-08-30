interface ChamaMarkProps {
  className?: string
}

/**
 * The Webchama mark: two ticks, the second confirming the first.
 *
 * It draws the maker-checker rule the whole product is built on, that no single treasurer moves
 * money alone. Chosen over the woven-basket and rotation concepts because its meaning survives as
 * two strokes, which is what a favicon reduces it to. The alternatives are kept in design/logos/.
 *
 * The first tick takes `currentColor` so the mark inherits whatever it sits on, which is what lets
 * the same component work in the dark sidebar, on the paper footer, and in the danger tone of an
 * error screen. Only the confirming tick is fixed to the accent.
 */
export default function ChamaMark({ className }: ChamaMarkProps) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <rect x="2" y="2" width="28" height="28" rx="6" fill="none" stroke="currentColor" strokeOpacity={0.3} strokeWidth={1.5} />
      <path
        d="M7 16.5 L11.5 21 L19.5 11"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M13.5 20 L17 23.5 L25.5 12.5"
        fill="none"
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="stroke-accent"
      />
    </svg>
  )
}
