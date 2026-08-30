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
    fireEvent.keyDown(last, { key: 'Tab' })
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
    const closeButton = screen.getByLabelText('Close')
    closeButton.focus()
    fireEvent.keyDown(closeButton, { key: 'Tab', shiftKey: true })
    expect(screen.getByText('Last')).toBe(document.activeElement)
  })

  it('is centred by layout rather than by a transform', () => {
    // jsdom does no layout, so this asserts the mechanism rather than the position. It is worth
    // pinning: the open and close animations set `transform` themselves and override a static
    // translate, so a translate-centred dialog sits at 50% of the viewport instead of in the
    // middle of it, and on a narrow screen it hangs off the right edge.
    render(
      <Modal title="Add Member" onClose={vi.fn()}>
        <p>Body</p>
      </Modal>,
    )

    const dialog = screen.getByRole('dialog')
    expect(dialog.className).not.toMatch(/translate-x-1\/2|left-1\/2/)

    const wrapper = dialog.parentElement
    expect(wrapper?.className).toContain('flex')
    expect(wrapper?.className).toContain('items-center')
    expect(wrapper?.className).toContain('justify-center')
  })

  it('lets a click beside the dialog through to the overlay behind it', () => {
    render(
      <Modal title="Add Member" onClose={vi.fn()}>
        <p>Body</p>
      </Modal>,
    )

    // The centring wrapper spans the viewport, so it would otherwise swallow every click meant
    // for the overlay and the dialog could never be dismissed by clicking outside it.
    const wrapper = screen.getByRole('dialog').parentElement
    expect(wrapper?.className).toContain('pointer-events-none')
    expect(screen.getByRole('dialog').className).toContain('pointer-events-auto')
  })
})
