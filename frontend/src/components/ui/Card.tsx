import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

/**
 * The raised surface every panel on a page sits on.
 *
 * Exists so elevation is decided once. Writing the surface, radius and shadow inline at each call
 * site is what let cards drift apart, and it hard-codes `bg-white`, which is only correct in one
 * theme.
 */
export default function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('rounded-2xl bg-surface p-6 shadow-card', className)} {...props} />
}
