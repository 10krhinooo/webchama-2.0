import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline'

interface Props {
  page: number
  totalPages: number
  total: number
  pageSize: number
  onPage: (p: number) => void
  label?: string
}

export default function Pagination({ page, totalPages, total, pageSize, onPage, label = 'items' }: Props) {
  if (totalPages <= 1) return null

  const from = (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)

  const pages = Array.from({ length: totalPages }, (_, i) => i + 1)
    .filter((n) => n === 1 || n === totalPages || Math.abs(n - page) <= 1)
    .reduce<(number | '…')[]>((acc, n, i, arr) => {
      if (i > 0 && n - (arr[i - 1] as number) > 1) acc.push('…')
      acc.push(n)
      return acc
    }, [])

  return (
    <div className="flex items-center justify-between pt-2">
      <p className="text-xs text-muted">
        {from}–{to} of {total} {label}
      </p>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPage(page - 1)}
          disabled={page === 1}
          className="p-1.5 rounded-lg border border-black/10 text-muted hover:bg-paper-dim disabled:opacity-40"
        >
          <ChevronLeftIcon className="w-4 h-4" />
        </button>
        {pages.map((n, i) =>
          n === '…' ? (
            <span key={`e${i}`} className="px-1 text-muted text-xs">…</span>
          ) : (
            <button
              key={n}
              onClick={() => onPage(n as number)}
              className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                page === n ? 'bg-primary text-white' : 'border border-black/10 text-ink/70 hover:bg-paper-dim'
              }`}
            >
              {n}
            </button>
          )
        )}
        <button
          onClick={() => onPage(page + 1)}
          disabled={page === totalPages}
          className="p-1.5 rounded-lg border border-black/10 text-muted hover:bg-paper-dim disabled:opacity-40"
        >
          <ChevronRightIcon className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
