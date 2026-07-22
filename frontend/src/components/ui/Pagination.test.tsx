import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import Pagination from './Pagination'

describe('Pagination', () => {
  it('renders nothing when there is only one page', () => {
    const { container } = render(
      <Pagination page={1} totalPages={1} total={5} pageSize={15} onPage={vi.fn()} />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('shows the current range and total', () => {
    render(<Pagination page={2} totalPages={3} total={40} pageSize={15} onPage={vi.fn()} label="members" />)
    expect(screen.getByText('16–30 of 40 members')).toBeTruthy()
  })

  it('disables previous on the first page and next on the last page', () => {
    const { rerender } = render(
      <Pagination page={1} totalPages={3} total={40} pageSize={15} onPage={vi.fn()} />,
    )
    const buttons = screen.getAllByRole('button')
    expect(buttons[0]).toBeDisabled()

    rerender(<Pagination page={3} totalPages={3} total={40} pageSize={15} onPage={vi.fn()} />)
    const lastButtons = screen.getAllByRole('button')
    expect(lastButtons[lastButtons.length - 1]).toBeDisabled()
  })

  it('calls onPage with the clicked page number', () => {
    const onPage = vi.fn()
    render(<Pagination page={1} totalPages={3} total={40} pageSize={15} onPage={onPage} />)
    fireEvent.click(screen.getByText('2'))
    expect(onPage).toHaveBeenCalledWith(2)
  })

  it('renders an ellipsis when pages are skipped', () => {
    render(<Pagination page={1} totalPages={10} total={150} pageSize={15} onPage={vi.fn()} />)
    expect(screen.getByText('…')).toBeTruthy()
  })

  it('calls onPage with the previous and next page numbers', () => {
    const onPage = vi.fn()
    render(<Pagination page={2} totalPages={3} total={40} pageSize={15} onPage={onPage} />)
    const buttons = screen.getAllByRole('button')
    fireEvent.click(buttons[0])
    fireEvent.click(buttons[buttons.length - 1])
    expect(onPage).toHaveBeenCalledWith(1)
    expect(onPage).toHaveBeenCalledWith(3)
  })
})
