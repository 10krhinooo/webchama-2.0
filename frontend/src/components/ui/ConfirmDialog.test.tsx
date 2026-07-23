import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ConfirmDialog from './ConfirmDialog'

describe('ConfirmDialog', () => {
  it('renders the title and message', () => {
    render(
      <ConfirmDialog
        title="Delete chama"
        message="This cannot be undone."
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    )
    expect(screen.getByText('Delete chama')).toBeTruthy()
    expect(screen.getByText('This cannot be undone.')).toBeTruthy()
  })

  it('calls onConfirm when the confirm button is clicked', () => {
    const onConfirm = vi.fn()
    render(
      <ConfirmDialog title="Delete chama" message="Sure?" confirmLabel="Delete" onConfirm={onConfirm} onCancel={vi.fn()} />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('calls onCancel when the cancel button is clicked', () => {
    const onCancel = vi.fn()
    render(<ConfirmDialog title="Delete chama" message="Sure?" onConfirm={vi.fn()} onCancel={onCancel} />)
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('disables both buttons while loading', () => {
    render(<ConfirmDialog title="Delete chama" message="Sure?" onConfirm={vi.fn()} onCancel={vi.fn()} loading />)
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()
    expect(screen.getByRole('button', { name: /Confirm/i })).toBeDisabled()
  })
})
