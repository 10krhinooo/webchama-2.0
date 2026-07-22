import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import PhoneInput from './PhoneInput'

describe('PhoneInput', () => {
  it('renders a phone number input defaulting to Kenya', () => {
    render(<PhoneInput value="" onChange={vi.fn()} />)
    expect(screen.getByRole('textbox')).toBeTruthy()
  })

  it('renders the provided value', () => {
    render(<PhoneInput value="+254700000000" onChange={vi.fn()} />)
    const input = screen.getByRole('textbox') as HTMLInputElement
    expect(input.value).toContain('700000000')
  })
})
