import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import ErrorScreen from './ErrorScreen'

describe('ErrorScreen', () => {
  it('announces itself, since it replaces the page the reader asked for', () => {
    render(<ErrorScreen title="Page not found" description="It has moved." />)
    expect(screen.getByRole('alert')).toBeTruthy()
  })

  it('names what happened as a heading', () => {
    render(<ErrorScreen title="Page not found" description="It has moved." />)
    expect(screen.getByRole('heading', { name: 'Page not found' })).toBeTruthy()
    expect(screen.getByText('It has moved.')).toBeTruthy()
  })

  it('shows the status code when there is one', () => {
    render(<ErrorScreen code="404" title="Page not found" description="It has moved." />)
    expect(screen.getByText('404')).toBeTruthy()
  })

  it('omits the code when there is not', () => {
    render(<ErrorScreen title="Something went wrong" description="Try again." />)
    expect(screen.queryByText(/^\d{3}$/)).toBeNull()
  })

  it('offers a way out', () => {
    render(
      <ErrorScreen
        title="Page not found"
        description="It has moved."
        actions={<a href="/">Back to the homepage</a>}
      />,
    )
    expect(screen.getByRole('link', { name: 'Back to the homepage' })).toBeTruthy()
  })

  it('marks the mark as dangerous only when told to', () => {
    const { container, rerender } = render(<ErrorScreen title="A" description="B" />)
    expect(container.querySelector('.text-brand')).toBeTruthy()

    rerender(<ErrorScreen title="A" description="B" tone="danger" />)
    expect(container.querySelector('.text-danger')).toBeTruthy()
  })
})
