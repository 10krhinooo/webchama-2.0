import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import FormError from './FormError'

describe('FormError', () => {
  it('renders the message as an alert, so a failed submit is announced', () => {
    render(<FormError message="Something went wrong" />)
    expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong')
  })

  it('renders nothing when there is no message', () => {
    const { container } = render(<FormError message={null} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders nothing for an empty string, so a cleared error disappears', () => {
    const { container } = render(<FormError message="" />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders nothing when the message is omitted entirely', () => {
    const { container } = render(<FormError />)
    expect(container).toBeEmptyDOMElement()
  })

  it('accepts an extra className for spacing at the call site', () => {
    render(<FormError message="Bad" className="mb-4" />)
    expect(screen.getByTestId('form-error').className).toContain('mb-4')
  })
})
