import { SkeletonLine, SkeletonBlock } from './Skeleton'

export function TablePageSkeleton({
  rows = 8,
  withButton = true,
  withFilter = true,
}: {
  rows?: number
  withButton?: boolean
  withFilter?: boolean
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <SkeletonLine className="h-7 w-48" />
        {withButton && <SkeletonBlock className="h-9 w-28 rounded-lg" />}
      </div>
      {withFilter && (
        <div className="flex gap-3">
          <SkeletonBlock className="h-9 w-56 rounded-lg" />
          <SkeletonBlock className="h-9 w-32 rounded-lg" />
        </div>
      )}
      <div className="bg-white rounded-2xl shadow-card overflow-hidden">
        <div className="flex items-center gap-6 px-4 py-3 bg-paper-dim border-b border-black/10">
          <SkeletonLine className="h-3.5 w-24" />
          <SkeletonLine className="h-3.5 w-32" />
          <SkeletonLine className="h-3.5 w-20" />
          <SkeletonLine className="h-3.5 w-16" />
        </div>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-6 px-4 py-3.5 border-b border-black/5 last:border-0">
            <SkeletonLine className="h-4 w-28" />
            <SkeletonLine className="h-4 w-40" />
            <SkeletonBlock className="h-5 w-16 rounded-full" />
            <SkeletonLine className="h-4 w-20" />
            <div className="ml-auto flex gap-2">
              <SkeletonBlock className="h-7 w-16 rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
