import type { InputHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean
}

export default function Input({ invalid, className, ...props }: Props) {
  return (
    <input
      className={cn(
        'w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-50',
        invalid ? 'border-danger' : 'border-black/15',
        className
      )}
      {...props}
    />
  )
}
