import type { ButtonHTMLAttributes } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50',
  {
    variants: {
      variant: {
        // Every variant reads through semantic tokens, so the same class works in both themes.
        // `bg-primary` is the fill token, which stays dark enough to carry white text in dark mode
        // rather than inverting; `text-brand` is its text-safe counterpart, which does invert.
        primary: 'bg-primary text-white hover:bg-primary-dark',
        secondary: 'bg-paper-dim text-ink hover:bg-border',
        danger: 'bg-danger text-white hover:bg-danger/90',
        ghost: 'bg-transparent text-brand hover:bg-primary-light',
      },
    },
    defaultVariants: {
      variant: 'primary',
    },
  }
)

export type ButtonVariant = VariantProps<typeof buttonVariants>['variant']

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
}

export default function Button({ variant = 'primary', className, type = 'button', ...props }: Props) {
  return (
    <button type={type} className={cn(buttonVariants({ variant }), className)} {...props} />
  )
}
