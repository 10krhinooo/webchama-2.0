import type {
  HTMLAttributes,
  ReactNode,
  TdHTMLAttributes,
  ThHTMLAttributes,
} from 'react'
import { cn } from '@/lib/utils'

/**
 * One column of a data-driven Table.
 *
 * `priority` decides what happens to the column on a phone, where the table collapses into a
 * card stack: 1 renders in the card's bold header line, 2 (the default) renders as a
 * label/value row, and 3 is omitted on mobile entirely.
 */
export interface TableColumn<T> {
  key: string
  header: ReactNode
  render: (row: T) => ReactNode
  priority?: 1 | 2 | 3
}

interface TableDataProps<T> {
  columns: TableColumn<T>[]
  rows: T[]
  rowKey: (row: T) => string | number
}

type TableProps<T> =
  | (HTMLAttributes<HTMLTableElement> & {
      columns?: undefined
      rows?: undefined
      rowKey?: undefined
    })
  | (HTMLAttributes<HTMLTableElement> & TableDataProps<T>)

/**
 * The one table primitive.
 *
 * Two ways to use it. The legacy way passes `TableHeader`/`TableBody` children and gets the
 * original horizontally-scrollable table, unchanged. The data-driven way passes `columns`,
 * `rows` and `rowKey` and additionally gets a mobile rendering: at `md` and up the exact same
 * table markup, below `md` a card per row instead of a sideways scroll.
 *
 * The responsive split is pure CSS (`hidden md:block` / `md:hidden`) rather than a matchMedia
 * hook: both renderings always exist in the DOM, so tests are deterministic and there is no
 * resize listener to keep in sync with Tailwind's breakpoints.
 */
export function Table<T>(props: TableProps<T>) {
  if (props.columns) {
    const { columns, rows, rowKey, className, ...rest } = props
    // On a phone, priority-1 columns become the card's header line, priority-2 its
    // label/value rows, and priority-3 columns are table-only.
    const headerColumns = columns.filter((column) => (column.priority ?? 2) === 1)
    const bodyColumns = columns.filter((column) => (column.priority ?? 2) === 2)
    return (
      <>
        <div className="hidden overflow-x-auto rounded-2xl bg-surface shadow-card md:block">
          <table className={cn('w-full text-sm', className)} {...rest}>
            <TableHeader>
              <TableRow>
                {columns.map((column) => (
                  <TableHead key={column.key}>{column.header}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={rowKey(row)}>
                  {columns.map((column) => (
                    <TableCell key={column.key}>{column.render(row)}</TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </table>
        </div>
        <ul className="space-y-3 md:hidden">
          {rows.map((row) => (
            <li key={rowKey(row)} className="rounded-2xl bg-surface p-4 shadow-card">
              {headerColumns.length > 0 && (
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 font-heading text-sm font-semibold text-ink">
                  {headerColumns.map((column) => (
                    <span key={column.key}>{column.render(row)}</span>
                  ))}
                </div>
              )}
              {bodyColumns.length > 0 && (
                <dl className={cn('space-y-1.5', headerColumns.length > 0 && 'mt-2')}>
                  {bodyColumns.map((column) => (
                    <div key={column.key} className="flex items-baseline justify-between gap-4">
                      <dt className="text-xs text-muted">{column.header}</dt>
                      <dd className="text-right text-sm text-ink">{column.render(row)}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </li>
          ))}
        </ul>
      </>
    )
  }
  const { className, ...rest } = props
  return (
    <div className="overflow-x-auto rounded-2xl bg-surface shadow-card">
      <table className={cn('w-full text-sm', className)} {...rest} />
    </div>
  )
}

export function TableHeader({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn('border-b border-border bg-paper-dim', className)} {...props} />
}

export function TableBody({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn('divide-y divide-border', className)} {...props} />
}

export function TableRow({ className, ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={cn('hover:bg-paper-dim/30', className)} {...props} />
}

export function TableHead({ className, ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return <th className={cn('px-4 py-3 text-left font-medium text-ink/80', className)} {...props} />
}

export function TableCell({ className, ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn('px-4 py-3', className)} {...props} />
}
