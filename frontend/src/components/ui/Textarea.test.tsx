import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import Textarea from './Textarea'

describe('Textarea', () => {
  it('renders and accepts a value', () => {
    render(<Textarea value="hello" onChange={vi.fn()} aria-label="Description" />)
    expect((screen.getByLabelText('Description') as HTMLTextAreaElement).value).toBe('hello')
  })

  it('fires onChange', () => {
    const onChange = vi.fn()
    render(<Textarea value="" onChange={onChange} aria-label="Description" />)
    fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'a' } })
    expect(onChange).toHaveBeenCalled()
  })

  it('applies the invalid border when invalid', () => {
    render(<Textarea value="" onChange={vi.fn()} aria-label="Description" invalid />)
    expect(screen.getByLabelText('Description').className).toContain('border-danger')
  })
})
