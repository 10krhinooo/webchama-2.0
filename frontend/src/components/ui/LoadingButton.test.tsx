import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import LoadingButton from './LoadingButton'

describe('LoadingButton', () => {
  it('renders children and defaults to type="button"', () => {
    render(<LoadingButton>Save</LoadingButton>)
    const button = screen.getByRole('button', { name: 'Save' })
    expect(button.getAttribute('type')).toBe('button')
  })

  it('shows the loading text and spinner while loading, and disables the button', () => {
    render(<LoadingButton loading loadingText="Saving…">Save</LoadingButton>)
    expect(screen.getByText('Saving…')).toBeTruthy()
    expect(screen.getByRole('button')).toBeDisabled()
  })

  it('falls back to children when loading with no loadingText', () => {
    render(<LoadingButton loading>Save</LoadingButton>)
    expect(screen.getByText('Save')).toBeTruthy()
  })

  it('fires onClick when not loading or disabled', () => {
    const onClick = vi.fn()
    render(<LoadingButton onClick={onClick}>Save</LoadingButton>)
    fireEvent.click(screen.getByRole('button'))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('respects an explicit disabled prop even when not loading', () => {
    render(<LoadingButton disabled>Save</LoadingButton>)
    expect(screen.getByRole('button')).toBeDisabled()
  })

  it('respects an explicit type prop', () => {
    render(<LoadingButton type="submit">Save</LoadingButton>)
    expect(screen.getByRole('button').getAttribute('type')).toBe('submit')
  })
})
