import type { ReactNode } from 'react'
import ChamaMark from '../marketing/ChamaMark'

interface Props {
  /** The HTTP status, where there is one. Drawn large, as the fastest thing to recognise. */
  code?: string
  title: string
  description: string
  /** Buttons or links out. A dead end with no way forward is the thing this exists to avoid. */
  actions?: ReactNode
  tone?: 'neutral' | 'danger'
}

/**
 * The full-screen dead ends: not found, forbidden, and a render that threw.
 *
 * One component rather than four hand-rolled screens, because these are the pages a person is most
 * likely to meet on a bad day and the least likely to have been looked at. Built from the same
 * marks and tokens as the marketing site, so an error still reads as part of the product rather
 * than as the browser's own default.
 */
export default function ErrorScreen({ code, title, description, actions, tone = 'neutral' }: Props) {
  return (
    <div
      role="alert"
      className="flex min-h-screen flex-col items-center justify-center gap-5 bg-paper px-6 py-16 text-center"
    >
      <ChamaMark className={`h-9 w-9 ${tone === 'danger' ? 'text-danger' : 'text-brand'}`} />

      {code && (
        <p className="font-mono text-6xl font-bold leading-none text-ink/15 sm:text-7xl">{code}</p>
      )}

      <div className="flex max-w-md flex-col gap-2">
        <h1 className="font-display text-2xl font-semibold text-ink sm:text-3xl">{title}</h1>
        <p className="text-ink/70">{description}</p>
      </div>

      {actions && <div className="flex flex-wrap items-center justify-center gap-3">{actions}</div>}
    </div>
  )
}
