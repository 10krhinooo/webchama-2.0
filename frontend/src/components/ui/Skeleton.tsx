export function SkeletonLine({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-paper-dim rounded ${className}`} />
}

export function SkeletonBlock({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-paper-dim rounded-lg ${className}`} />
}

export function SkeletonCircle({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-paper-dim rounded-full ${className}`} />
}
