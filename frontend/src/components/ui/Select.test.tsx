import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import Select from './Select'

describe('Select', () => {
  it('renders the selected option label as the trigger value', () => {
    render(
      <Select value="b" onChange={vi.fn()} aria-label="Choice">
        <option value="a">A</option>
        <option value="b">B</option>
      </Select>,
    )
    expect(screen.getByLabelText('Choice')).toHaveTextContent('B')
  })

  it('shows the empty-value option as placeholder text instead of a pickable item', () => {
    render(
      <Select value="" onChange={vi.fn()} aria-label="Choice">
        <option value="" disabled>Select a member</option>
        <option value="a">A</option>
      </Select>,
    )
    expect(screen.getByLabelText('Choice')).toHaveTextContent('Select a member')
  })

  it('fires onChange with the picked value', () => {
    const onChange = vi.fn()
    render(
      <Select value="a" onChange={onChange} aria-label="Choice">
        <option value="a">A</option>
        <option value="b">B</option>
      </Select>,
    )
    fireEvent.click(screen.getByLabelText('Choice'))
    fireEvent.click(screen.getByText('B'))
    expect(onChange).toHaveBeenCalledWith('b')
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
