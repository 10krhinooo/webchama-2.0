import type { ButtonHTMLAttributes } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50',
  {
    variants: {
      variant: {
        primary: 'bg-primary text-white hover:bg-primary-dark',
        secondary: 'bg-paper-dim text-ink hover:bg-black/10',
        danger: 'bg-danger text-white hover:bg-danger/90',
        ghost: 'bg-transparent text-primary hover:bg-primary-light',
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
