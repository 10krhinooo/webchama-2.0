import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import LedgerRow from './LedgerRow'

describe('LedgerRow', () => {
  it('renders the title and description', () => {
    const { getByText } = render(
      <LedgerRow title="Zamu, automated" description="The payout order is set once and kept fair." />,
    )
    expect(getByText('Zamu, automated')).toBeTruthy()
    expect(getByText('The payout order is set once and kept fair.')).toBeTruthy()
  })

  it('draws a divider between entries by default', () => {
    const { container } = render(<LedgerRow title="A" description="B" />)
    expect(container.firstChild).toHaveClass('border-b')
  })

  it('omits the divider on the last entry', () => {
    const { container } = render(<LedgerRow title="A" description="B" isLast />)
    expect(container.firstChild).not.toHaveClass('border-b')
  })
})
