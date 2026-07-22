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

  it('appends a required marker', () => {
    render(
      <FormField label="Name" htmlFor="name" required>
        <Input id="name" value="" onChange={vi.fn()} />
      </FormField>,
    )
    expect(screen.getByText('Name *')).toBeTruthy()
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
})
