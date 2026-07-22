interface WhatsAppQuoteProps {
  quote: string
  name: string
  role: string
}

/**
 * Testimonials rendered as a WhatsApp message, since WhatsApp is the channel
 * a chama actually coordinates in, not a generic quote card.
 */
export default function WhatsAppQuote({ quote, name, role }: WhatsAppQuoteProps) {
  return (
    <div className="mx-auto max-w-md">
      <div className="relative rounded-2xl rounded-tl-sm bg-success px-5 py-4 text-paper shadow-card">
        <p className="text-[15px] leading-relaxed">{quote}</p>
        <div className="mt-2 flex items-center justify-end gap-1 text-xs text-paper/70">
          <span>9:41 PM</span>
          <svg viewBox="0 0 16 11" className="h-3 w-4" fill="none" aria-hidden="true">
            <path d="M1 5.5L4.5 9L10.5 1" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" />
            <path d="M5.5 5.5L9 9L15 1" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>
      <p className="mt-3 text-center text-sm text-muted">
        <span className="font-semibold text-ink">{name}</span>, {role}
      </p>
    </div>
  )
}
