import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import Badge from './Badge'

describe('Badge', () => {
  it('renders the label', () => {
    render(<Badge label="ACTIVE" variant="success" />)
    expect(screen.getByText('ACTIVE')).toBeTruthy()
  })

  // The text class is not derivable from the variant name. A badge sits on a surface, so the
  // primary variant uses the text-safe brand token rather than the fill token, which is what lets
  // it stay legible in dark mode.
  const textClassFor = {
    success: 'text-success',
    danger: 'text-danger',
    warning: 'text-warning',
    primary: 'text-brand',
    muted: 'text-muted',
  } as const

  it.each(['success', 'danger', 'warning', 'primary', 'muted'] as const)(
    'applies variant classes for %s',
    (variant) => {
      render(<Badge label="X" variant={variant} />)
      expect(screen.getByText('X').className).toContain(textClassFor[variant])
    },
  )
})
