import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
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

  it('calls onDismiss after the configured duration', () => {
    const onDismiss = vi.fn()
    render(<TransientAlert variant="success" message="Saved." durationMs={1000} onDismiss={onDismiss} />)
    expect(onDismiss).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1000)
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })
})
