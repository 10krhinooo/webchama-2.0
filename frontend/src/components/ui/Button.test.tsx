import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import Button from './Button'

describe('Button', () => {
  it('defaults to type="button" and the primary variant', () => {
    render(<Button>Save</Button>)
    const button = screen.getByRole('button', { name: 'Save' })
    expect(button.getAttribute('type')).toBe('button')
    expect(button.className).toContain('bg-primary')
  })

  it.each(['primary', 'secondary', 'danger', 'ghost'] as const)('applies %s variant classes', (variant) => {
    render(<Button variant={variant}>X</Button>)
    expect(screen.getByRole('button').className.length).toBeGreaterThan(0)
  })

  it('fires onClick', () => {
    const onClick = vi.fn()
    render(<Button onClick={onClick}>Save</Button>)
    fireEvent.click(screen.getByRole('button'))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('respects an explicit type prop', () => {
    render(<Button type="submit">Save</Button>)
    expect(screen.getByRole('button').getAttribute('type')).toBe('submit')
  })

  it('merges a passed-in className with the variant classes', () => {
    render(<Button className="w-full">Save</Button>)
    expect(screen.getByRole('button').className).toContain('w-full')
  })
})
