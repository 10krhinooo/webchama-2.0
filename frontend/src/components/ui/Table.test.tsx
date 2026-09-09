import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  type TableColumn,
} from './Table'

/**
 * Renders as if on a narrow screen.
 *
 * Table mounts the card stack or the table, never both, so the branch is chosen by matchMedia
 * rather than by CSS the test environment does not apply. jsdom answers `false` to every query,
 * which is what keeps the wide layout the default everywhere else; a test that wants the cards
 * says so here.
 */
function renderCompact(ui: React.ReactElement) {
  vi.stubGlobal(
    'matchMedia',
    (query: string) =>
      ({
        matches: true,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }) as unknown as MediaQueryList,
  )
  return render(ui)
}

// Top level, not inside one describe: the compact stub must be cleared for every test in the
// file, including those in the second describe block, or a stubbed narrow viewport leaks into
// tests that expect the table.
afterEach(() => {
  vi.unstubAllGlobals()
})

describe('Table', () => {
  it('renders a semantic table with header and body rows', () => {
    render(
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>Jane Doe</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    )
    expect(screen.getByRole('table')).toBeTruthy()
    expect(screen.getByRole('columnheader', { name: 'Name' })).toBeTruthy()
    expect(screen.getByRole('cell', { name: 'Jane Doe' })).toBeTruthy()
  })

  it('merges a passed-in className with the default styling', () => {
    render(
      <Table className="custom-table">
        <TableBody>
          <TableRow>
            <TableCell>X</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    )
    expect(screen.getByRole('table').className).toContain('custom-table')
  })
})

describe('Table with columns and rows', () => {
  interface Row {
    id: number
    name: string
    phone: string
    role: string
    joined: string
  }

  const columns: TableColumn<Row>[] = [
    { key: 'name', header: 'Name', render: (row) => row.name, priority: 1 },
    { key: 'phone', header: 'Phone', render: (row) => row.phone },
    { key: 'role', header: 'Role', render: (row) => row.role, priority: 2 },
    { key: 'joined', header: 'Joined', render: (row) => row.joined, priority: 3 },
  ]

  const rows: Row[] = [
    { id: 1, name: 'Jane Doe', phone: '0712 000001', role: 'TREASURER', joined: '2024-01-05' },
    { id: 2, name: 'John Ouma', phone: '0712 000002', role: 'MEMBER', joined: '2024-02-10' },
  ]

  const rowKey = (row: Row) => row.id

  it('renders every column and row as regular table markup', () => {
    render(<Table columns={columns} rows={rows} rowKey={rowKey} />)
    const table = screen.getByRole('table')
    for (const header of ['Name', 'Phone', 'Role', 'Joined']) {
      expect(within(table).getByRole('columnheader', { name: header })).toBeTruthy()
    }
    expect(within(table).getByRole('cell', { name: 'Jane Doe' })).toBeTruthy()
    expect(within(table).getByRole('cell', { name: '0712 000002' })).toBeTruthy()
    expect(within(table).getByRole('cell', { name: '2024-01-05' })).toBeTruthy()
    expect(within(table).getAllByRole('row')).toHaveLength(3)
  })

  it('renders the same rows as a card stack list', () => {
    renderCompact(<Table columns={columns} rows={rows} rowKey={rowKey} />)
    const list = screen.getByRole('list')
    const cards = within(list).getAllByRole('listitem')
    expect(cards).toHaveLength(2)
    expect(within(cards[0]).getByText('Jane Doe')).toBeTruthy()
    expect(within(cards[1]).getByText('John Ouma')).toBeTruthy()
  })

  it('puts priority-1 columns in the card header line, not the label/value rows', () => {
    renderCompact(<Table columns={columns} rows={rows} rowKey={rowKey} />)
    const card = within(screen.getByRole('list')).getAllByRole('listitem')[0]
    // The value renders in the bold header line, outside the dl, and without its column label.
    expect(within(card).getByText('Jane Doe').closest('dl')).toBeNull()
    expect(within(card).queryByText('Name')).toBeNull()
  })

  it('renders columns without an explicit priority as label/value rows', () => {
    renderCompact(<Table columns={columns} rows={rows} rowKey={rowKey} />)
    const card = within(screen.getByRole('list')).getAllByRole('listitem')[0]
    expect(within(card).getByText('Phone').closest('dl')).not.toBeNull()
    expect(within(card).getByText('0712 000001').closest('dl')).not.toBeNull()
    expect(within(card).getByText('Role')).toBeTruthy()
    expect(within(card).getByText('TREASURER')).toBeTruthy()
  })

  it('omits priority-3 columns from the card stack', () => {
    renderCompact(<Table columns={columns} rows={rows} rowKey={rowKey} />)
    const list = screen.getByRole('list')
    expect(within(list).queryByText('Joined')).toBeNull()
    expect(within(list).queryByText('2024-01-05')).toBeNull()
  })

  it('keeps priority-3 columns in the table', () => {
    render(<Table columns={columns} rows={rows} rowKey={rowKey} />)
    expect(within(screen.getByRole('table')).getByRole('cell', { name: '2024-01-05' })).toBeTruthy()
  })

  it('skips the card header line when no column has priority 1', () => {
    const plain: TableColumn<Row>[] = [
      { key: 'phone', header: 'Phone', render: (row) => row.phone },
    ]
    renderCompact(<Table columns={plain} rows={rows} rowKey={rowKey} />)
    const card = within(screen.getByRole('list')).getAllByRole('listitem')[0]
    expect(within(card).getByText('0712 000001').closest('dl')).not.toBeNull()
    expect(card.querySelector('dl')?.className).not.toContain('mt-2')
  })

  it('skips the label/value list when every column has priority 1', () => {
    const headerOnly: TableColumn<Row>[] = [
      { key: 'name', header: 'Name', render: (row) => row.name, priority: 1 },
    ]
    renderCompact(<Table columns={headerOnly} rows={rows} rowKey={rowKey} />)
    const card = within(screen.getByRole('list')).getAllByRole('listitem')[0]
    expect(within(card).getByText('Jane Doe')).toBeTruthy()
    expect(card.querySelector('dl')).toBeNull()
  })

  it('renders no data rows or cards when rows is empty', () => {
    render(<Table columns={columns} rows={[]} rowKey={rowKey} />)
    expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(1)
    expect(screen.queryAllByRole('listitem')).toHaveLength(0)
  })

  it('merges a passed-in className into the table markup', () => {
    render(<Table className="custom-table" columns={columns} rows={rows} rowKey={rowKey} />)
    expect(screen.getByRole('table').className).toContain('custom-table')
  })
})
