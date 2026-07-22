import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import WhatsAppQuote from './WhatsAppQuote'

describe('WhatsAppQuote', () => {
  it('renders the quote, name, and role', () => {
    render(<WhatsAppQuote quote="Everyone can see it now." name="Grace W." role="Chairlady" />)
    expect(screen.getByText('Everyone can see it now.')).toBeTruthy()
    expect(screen.getByText('Grace W.')).toBeTruthy()
    expect(screen.getByText(/Chairlady/)).toBeTruthy()
  })
})
