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

  it('carries a description to screen readers as well as the tooltip', () => {
    const { container } = render(<Badge label="82" variant="success" description="Good, based on 12 contributions" />)

    // A title attribute alone is announced inconsistently and needs a pointer to reach, so the
    // same text is also rendered for assistive technology.
    expect(container.querySelector('[title="Good, based on 12 contributions"]')).toBeTruthy()
    expect(screen.getByText(/Good, based on 12 contributions/)).toBeTruthy()
  })

  it('renders nothing extra when there is no description', () => {
    const { container } = render(<Badge label="ACTIVE" variant="success" />)
    expect(container.querySelector('.sr-only')).toBeNull()
    expect(container.querySelector('[title]')).toBeNull()
  })
})
