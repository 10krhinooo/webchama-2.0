import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import FormField from './FormField'
import Input from './Input'
import { vi } from 'vitest'

describe('FormField', () => {
  it('renders the label linked to the control', () => {
    render(
      <FormField label="Name" htmlFor="name">
        <Input id="name" value="" onChange={vi.fn()} />
      </FormField>,
    )
    expect(screen.getByLabelText('Name')).toBeTruthy()
  })

  it('marks a required field visually and for screen readers', () => {
    render(
      <FormField label="Name" htmlFor="name" required>
        <Input id="name" value="" onChange={vi.fn()} />
      </FormField>,
    )
    // The asterisk is decorative and hidden from assistive technology; the word "required" is
    // what actually gets announced, since an asterisk on its own means nothing when read aloud.
    const label = screen.getByText('Name', { exact: false }).closest('label')!
    expect(label.textContent).toContain('*')
    expect(label.textContent).toContain('(required)')
    expect(label.querySelector('[aria-hidden="true"]')?.textContent).toContain('*')
  })

  it('renders a hint when there is no error', () => {
    render(
      <FormField label="Name" htmlFor="name" hint="As it appears on your ID">
        <Input id="name" value="" onChange={vi.fn()} />
      </FormField>,
    )
    expect(screen.getByText('As it appears on your ID')).toBeTruthy()
  })

  it('renders an error instead of the hint when both are given', () => {
    render(
      <FormField label="Name" htmlFor="name" hint="As it appears on your ID" error="Required">
        <Input id="name" value="" onChange={vi.fn()} />
      </FormField>,
    )
    expect(screen.getByText('Required')).toBeTruthy()
    expect(screen.queryByText('As it appears on your ID')).toBeNull()
  })

  it('links an error to its control, so it is announced as part of the field', () => {
    render(
      <FormField label="Name" htmlFor="name" error="Name is required">
        <Input id="name" value="" onChange={vi.fn()} />
      </FormField>,
    )
    const input = screen.getByRole('textbox')
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input).toHaveAttribute('aria-describedby', 'name-error')
    expect(screen.getByRole('alert')).toHaveTextContent('Name is required')
  })

  it('links a hint to its control when there is no error', () => {
    render(
      <FormField label="Phone" htmlFor="phone" hint="Include the country code">
        <Input id="phone" value="" onChange={vi.fn()} />
      </FormField>,
    )
    const input = screen.getByRole('textbox')
    expect(input).toHaveAttribute('aria-describedby', 'phone-hint')
    expect(input).not.toHaveAttribute('aria-invalid')
  })

  it('leaves a caller-supplied aria-describedby alone', () => {
    render(
      <FormField label="Name" htmlFor="name" error="Bad">
        <Input id="name" aria-describedby="custom" value="" onChange={vi.fn()} />
      </FormField>,
    )
    expect(screen.getByRole('textbox')).toHaveAttribute('aria-describedby', 'custom')
  })

  it('renders a non-element child without attempting to clone it', () => {
    render(
      <FormField label="Raw" htmlFor="raw" error="Oops">
        raw text child
      </FormField>,
    )
    expect(screen.getByText('raw text child')).toBeTruthy()
    expect(screen.getByRole('alert')).toHaveTextContent('Oops')
  })
})
