import type { TextareaHTMLAttributes } from 'react'

interface Props extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean
}

export default function Textarea({ invalid, className = '', ...props }: Props) {
  return (
    <textarea
      className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary ${
        invalid ? 'border-danger' : 'border-black/15'
      } ${className}`}
      {...props}
    />
  )
}
