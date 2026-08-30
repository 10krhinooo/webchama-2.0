interface Props {
  label: string
  variant: 'success' | 'danger' | 'warning' | 'primary' | 'muted'
}

const variants = {
  success: 'bg-success/10 text-success ring-1 ring-success/25',
  danger: 'bg-danger/10 text-danger ring-1 ring-danger/25',
  warning: 'bg-warning/10 text-warning ring-1 ring-warning/25',
  primary: 'bg-primary/10 text-brand ring-1 ring-primary/25',
  muted: 'bg-muted/10 text-muted ring-1 ring-muted/25',
}

export default function Badge({ label, variant }: Props) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${variants[variant]}`}>
      {label}
    </span>
  )
}
