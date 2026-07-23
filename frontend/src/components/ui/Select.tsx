import type { SelectHTMLAttributes } from 'react'

interface Props extends SelectHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean
}

export default function Select({ invalid, className = '', children, ...props }: Props) {
  return (
    <select
      className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary ${
        invalid ? 'border-danger' : 'border-black/15'
      } ${className}`}
      {...props}
    >
      {children}
    </select>
  )
}
