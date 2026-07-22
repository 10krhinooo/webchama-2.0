import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('keycloak-js', () => ({
  default: vi.fn().mockImplementation(function FakeKeycloak() {
    return { token: undefined, updateToken: vi.fn() }
  }),
}))

vi.mock('@react-keycloak/web', () => ({
  ReactKeycloakProvider: ({ children }: { children: React.ReactNode }) => children,
}))

import App from './App'

describe('App', () => {
  it('renders the home page at the root route', () => {
    render(<App />)
    expect(screen.getByText('Webchama')).toBeTruthy()
  })
})
