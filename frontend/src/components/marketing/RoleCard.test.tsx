import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import RoleCard from './RoleCard'

describe('RoleCard', () => {
  it('renders the role name and every permission item', () => {
    render(<RoleCard role="Treasurer" items={['Record contributions', 'Request payouts']} />)
    expect(screen.getByText('Treasurer')).toBeTruthy()
    expect(screen.getByText('Record contributions')).toBeTruthy()
    expect(screen.getByText('Request payouts')).toBeTruthy()
  })
})
