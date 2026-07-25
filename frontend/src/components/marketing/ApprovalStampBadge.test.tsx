import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import ApprovalStampBadge from './ApprovalStampBadge'

describe('ApprovalStampBadge', () => {
  it('renders a dashed pending stamp', () => {
    render(<ApprovalStampBadge status="PENDING" />)
    const badge = screen.getByText('Pending')
    expect(badge.className).toContain('border-dashed')
    expect(badge.className).toContain('border-warning')
  })

  it('renders a solid approved stamp', () => {
    render(<ApprovalStampBadge status="APPROVED" />)
    const badge = screen.getByText('Approved')
    expect(badge.className).toContain('border-solid')
    expect(badge.className).toContain('border-success')
  })

  it('renders a solid rejected stamp', () => {
    render(<ApprovalStampBadge status="REJECTED" />)
    const badge = screen.getByText('Rejected')
    expect(badge.className).toContain('border-solid')
    expect(badge.className).toContain('border-danger')
  })
})
