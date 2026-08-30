import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import LoadFailed from './LoadFailed'

describe('LoadFailed', () => {
  it('says what could not be loaded', () => {
    render(<LoadFailed what="your chamas" />)
    expect(screen.getByText('Could not load your chamas.')).toBeTruthy()
  })

  it('announces itself, since it replaces content the reader was waiting for', () => {
    render(<LoadFailed what="your chamas" />)
    expect(screen.getByRole('alert')).toBeTruthy()
  })

  it('repeats the server explanation when there is one', () => {
    render(<LoadFailed what="payouts" detail="You are not a member of this chama." />)
    expect(screen.getByText('You are not a member of this chama.')).toBeTruthy()
  })

  it('omits the detail line when there is nothing to say', () => {
    render(<LoadFailed what="payouts" detail={null} />)
    expect(screen.getByTestId('load-failed').textContent).toBe('Could not load payouts.')
  })

  it('offers a retry when one is given', () => {
    const onRetry = vi.fn()
    render(<LoadFailed what="payouts" onRetry={onRetry} />)
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('offers no retry when none is given', () => {
    render(<LoadFailed what="payouts" />)
    expect(screen.queryByRole('button')).toBeNull()
  })
})
