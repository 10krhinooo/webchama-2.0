import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import Modal from './Modal'

describe('Modal', () => {
  it('renders the title and children', () => {
    render(<Modal title="Add Member" onClose={vi.fn()}><p>Body content</p></Modal>)
    expect(screen.getByText('Add Member')).toBeTruthy()
    expect(screen.getByText('Body content')).toBeTruthy()
    expect(screen.getByRole('dialog')).toBeTruthy()
  })

  it('calls onClose when the close button is clicked', () => {
    const onClose = vi.fn()
    render(<Modal title="Add Member" onClose={onClose}><p>Body</p></Modal>)
    fireEvent.click(screen.getByLabelText('Close'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('ignores keys other than Escape and Tab', () => {
    const onClose = vi.fn()
    render(<Modal title="Add Member" onClose={onClose}><p>Body</p></Modal>)
    fireEvent.keyDown(document, { key: 'a' })
    expect(onClose).not.toHaveBeenCalled()
  })

  it('calls onClose when Escape is pressed', () => {
    const onClose = vi.fn()
    render(<Modal title="Add Member" onClose={onClose}><p>Body</p></Modal>)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('wraps Tab focus from the last focusable element back to the first (the close button)', () => {
    const onClose = vi.fn()
    render(
      <Modal title="Add Member" onClose={onClose}>
        <button>First</button>
        <button>Last</button>
      </Modal>,
    )
    const last = screen.getByText('Last')
    last.focus()
    fireEvent.keyDown(document, { key: 'Tab' })
    expect(screen.getByLabelText('Close')).toBe(document.activeElement)
  })

  it('wraps Shift+Tab focus from the first focusable element (the close button) back to the last', () => {
    const onClose = vi.fn()
    render(
      <Modal title="Add Member" onClose={onClose}>
        <button>First</button>
        <button>Last</button>
      </Modal>,
    )
    screen.getByLabelText('Close').focus()
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })
    expect(screen.getByText('Last')).toBe(document.activeElement)
  })
})
