import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import SignOffTrail from './SignOffTrail'

describe('SignOffTrail', () => {
  it('shows the requester and an awaiting stamp before a first sign-off', () => {
    render(<SignOffTrail requestedByName="Peter Treasurer" firstApproverName={null} />)
    expect(screen.getByText('Peter Treasurer')).toBeTruthy()
    expect(screen.getByText('Awaiting')).toBeTruthy()
  })

  it('shows the first approver name once signed', () => {
    render(<SignOffTrail requestedByName="Peter Treasurer" firstApproverName="Grace Chairperson" />)
    expect(screen.getByText('Peter Treasurer')).toBeTruthy()
    expect(screen.getByText('Grace Chairperson')).toBeTruthy()
    expect(screen.queryByText('Awaiting')).toBeNull()
  })
})
