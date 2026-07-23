import type { InputHTMLAttributes } from 'react'

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean
}

export default function Input({ invalid, className = '', ...props }: Props) {
  return (
    <input
      className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary ${
        invalid ? 'border-danger' : 'border-black/15'
      } ${className}`}
      {...props}
    />
  )
}
