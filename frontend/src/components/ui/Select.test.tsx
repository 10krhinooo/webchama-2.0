import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import Select from './Select'

describe('Select', () => {
  it('renders its options', () => {
    render(
      <Select value="b" onChange={vi.fn()} aria-label="Choice">
        <option value="a">A</option>
        <option value="b">B</option>
      </Select>,
    )
    expect((screen.getByLabelText('Choice') as HTMLSelectElement).value).toBe('b')
  })

  it('fires onChange', () => {
    const onChange = vi.fn()
    render(
      <Select value="a" onChange={onChange} aria-label="Choice">
        <option value="a">A</option>
        <option value="b">B</option>
      </Select>,
    )
    fireEvent.change(screen.getByLabelText('Choice'), { target: { value: 'b' } })
    expect(onChange).toHaveBeenCalled()
  })

  it('applies the invalid border when invalid', () => {
    render(
      <Select value="a" onChange={vi.fn()} aria-label="Choice" invalid>
        <option value="a">A</option>
      </Select>,
    )
    expect(screen.getByLabelText('Choice').className).toContain('border-danger')
  })
})
