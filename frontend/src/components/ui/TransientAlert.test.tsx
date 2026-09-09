import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import TransientAlert from './TransientAlert'

describe('TransientAlert', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders nothing when message is null', () => {
    const { container } = render(<TransientAlert variant="success" message={null} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders a success message', () => {
    render(<TransientAlert variant="success" message="Saved." />)
    expect(screen.getByText('Saved.')).toBeTruthy()
    expect(screen.getByRole('status')).toBeTruthy()
  })

  it('renders an error message', () => {
    render(<TransientAlert variant="error" message="Something broke." />)
    expect(screen.getByText('Something broke.')).toBeTruthy()
  })

  // An error is the only record of why an operation failed. A success can fade; this cannot.
  it('announces an error assertively rather than politely', () => {
    render(<TransientAlert variant="error" message="Something broke." />)
    const alert = screen.getByRole('alert')
    expect(alert).toHaveAttribute('aria-live', 'assertive')
  })

  it('keeps an error on screen past the duration a success would have faded at', () => {
    const onDismiss = vi.fn()
    render(<TransientAlert variant="error" message="Something broke." durationMs={1000} onDismiss={onDismiss} />)
    vi.advanceTimersByTime(10_000)
    expect(onDismiss).not.toHaveBeenCalled()
    expect(screen.getByText('Something broke.')).toBeTruthy()
  })

  it('lets the user dismiss an error themselves, since it will not go on its own', () => {
    const onDismiss = vi.fn()
    render(<TransientAlert variant="error" message="Something broke." onDismiss={onDismiss} />)
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss error' }))
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('offers no dismiss button on a success, which clears itself', () => {
    render(<TransientAlert variant="success" message="Saved." />)
    expect(screen.queryByRole('button', { name: 'Dismiss error' })).toBeNull()
  })

  it('calls onDismiss after the configured duration', () => {
    const onDismiss = vi.fn()
    render(<TransientAlert variant="success" message="Saved." durationMs={1000} onDismiss={onDismiss} />)
    expect(onDismiss).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1000)
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })
})
