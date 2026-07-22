import { useMemo, useState } from 'react'

const PAGE_SIZE = 10

/** Client-side pagination over an in-memory list, resetting to page 1 whenever the list changes size. */
export function usePagination<T>(items: T[], pageSize = PAGE_SIZE) {
  const [page, setPage] = useState(1)
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize))
  const clampedPage = Math.min(page, totalPages)

  const pageItems = useMemo(
    () => items.slice((clampedPage - 1) * pageSize, clampedPage * pageSize),
    [items, clampedPage, pageSize],
  )

  return {
    page: clampedPage,
    totalPages,
    total: items.length,
    pageSize,
    pageItems,
    setPage,
  }
}
