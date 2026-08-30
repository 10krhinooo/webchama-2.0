import type { TextareaHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

interface Props extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean
}

export default function Textarea({ invalid, className, ...props }: Props) {
  return (
    <textarea
      className={cn(
        'w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-50',
        invalid ? 'border-danger' : 'border-border-strong',
        className
      )}
      {...props}
    />
  )
}
