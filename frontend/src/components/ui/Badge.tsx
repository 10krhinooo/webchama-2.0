interface Props {
  label: string
  variant: 'success' | 'danger' | 'warning' | 'primary' | 'muted'
  /**
   * Explains a label that is too terse to stand alone, such as a bare number. Rendered for screen
   * readers as well as in the tooltip, because a title attribute alone is announced inconsistently
   * and is unreachable without a pointer.
   */
  description?: string
}

const variants = {
  success: 'bg-success/10 text-success ring-1 ring-success/25',
  danger: 'bg-danger/10 text-danger ring-1 ring-danger/25',
  warning: 'bg-warning/10 text-warning ring-1 ring-warning/25',
  primary: 'bg-primary/10 text-brand ring-1 ring-primary/25',
  muted: 'bg-muted/10 text-muted ring-1 ring-muted/25',
}

export default function Badge({ label, variant, description }: Props) {
  return (
    <span
      title={description}
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${variants[variant]}`}
    >
      {label}
      {description && <span className="sr-only">, {description}</span>}
    </span>
  )
}
