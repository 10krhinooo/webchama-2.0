import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import Input from './Input'

describe('Input', () => {
  it('renders and accepts a value', () => {
    render(<Input value="hello" onChange={vi.fn()} aria-label="Name" />)
    expect((screen.getByLabelText('Name') as HTMLInputElement).value).toBe('hello')
  })

  it('fires onChange', () => {
    const onChange = vi.fn()
    render(<Input value="" onChange={onChange} aria-label="Name" />)
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'a' } })
    expect(onChange).toHaveBeenCalled()
  })

  it('applies the invalid border when invalid', () => {
    render(<Input value="" onChange={vi.fn()} aria-label="Name" invalid />)
    expect(screen.getByLabelText('Name').className).toContain('border-danger')
  })
})
