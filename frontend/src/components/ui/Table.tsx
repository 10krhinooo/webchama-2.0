import type {
  HTMLAttributes,
  ReactNode,
  TdHTMLAttributes,
  ThHTMLAttributes,
} from 'react'
import { cn } from '@/lib/utils'
import { useIsCompact } from '../../hooks/useMediaQuery'

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
  /**
   * Per-row emphasis, applied to the table row and to the card alike so a row that matters does
   * not stop mattering on a phone. Payouts uses it to pick out the reader's own turn.
   */
  rowClassName?: (row: T) => string | undefined
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
 * Only one of the two renderings is mounted at a time, chosen by `useIsCompact`. The first
 * version of this component rendered both and hid one with `hidden md:block`, which is simpler in
 * the component and expensive everywhere else: jsdom applies no CSS, so every value appeared in
 * the document twice and any `getByText` in a page test became ambiguous. Converting a single page
 * broke 22 of its 38 tests on that alone. Mounting one also halves the DOM on a phone, which is
 * the device this is for.
 *
 * The trade is that `matchMedia` decides the branch, so a test wanting the card stack has to stub
 * it. That is one explicit line in the few tests that care, rather than a scoping wrapper around
 * every assertion in every test that does not.
 */
export function Table<T>(props: TableProps<T>) {
  const isCompact = useIsCompact()

  if (props.columns) {
    const { columns, rows, rowKey, rowClassName, className, ...rest } = props
    // On a phone, priority-1 columns become the card's header line, priority-2 its
    // label/value rows, and priority-3 columns are table-only.
    const headerColumns = columns.filter((column) => (column.priority ?? 2) === 1)
    const bodyColumns = columns.filter((column) => (column.priority ?? 2) === 2)
    if (isCompact) {
      return (
        <ul className="space-y-3">
          {rows.map((row) => (
            <li key={rowKey(row)} className={cn('rounded-2xl bg-surface p-4 shadow-card', rowClassName?.(row))}>
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
      )
    }

    return (
      <div className="overflow-x-auto rounded-2xl bg-surface shadow-card">
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
              <TableRow key={rowKey(row)} className={rowClassName?.(row)}>
                {columns.map((column) => (
                  <TableCell key={column.key}>{column.render(row)}</TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </table>
      </div>
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
