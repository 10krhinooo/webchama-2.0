import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import Badge from './Badge'

describe('Badge', () => {
  it('renders the label', () => {
    render(<Badge label="ACTIVE" variant="success" />)
    expect(screen.getByText('ACTIVE')).toBeTruthy()
  })

  it.each(['success', 'danger', 'warning', 'primary', 'muted'] as const)(
    'applies variant classes for %s',
    (variant) => {
      render(<Badge label="X" variant={variant} />)
      expect(screen.getByText('X').className).toContain(variant === 'muted' ? 'text-muted' : `text-${variant}`)
    },
  )
})
