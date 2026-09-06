import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('keycloak-js', () => ({
  default: vi.fn().mockImplementation(function FakeKeycloak() {
    return { token: undefined, updateToken: vi.fn() }
  }),
}))

vi.mock('@react-keycloak/web', () => ({
  ReactKeycloakProvider: ({ children }: { children: React.ReactNode }) => children,
  useKeycloak: () => ({
    initialized: true,
    keycloak: {
      authenticated: true,
      register: vi.fn(),
      login: vi.fn(),
      logout: vi.fn(),
      updateToken: vi.fn(),
      hasRealmRole: () => true,
      tokenParsed: { name: 'Test User' },
    },
  }),
}))

// The staff pages are stubbed so this file can prove the routing, that each path resolves its own
// lazy chunk, without re-mocking every page's API surface; each page's real behaviour is covered by
// its own colocated test. The layout is stubbed down to its outlet for the same reason.
vi.mock('./components/layout/StaffLayout', async () => {
  const { Outlet } = await import('react-router-dom')
  return { default: () => <Outlet /> }
})
vi.mock('./pages/staff/ChamasPage', () => ({ default: () => <p>ChamasPage stub</p> }))
vi.mock('./pages/staff/MyChamasPage', () => ({ default: () => <p>MyChamasPage stub</p> }))
vi.mock('./pages/staff/DashboardPage', () => ({ default: () => <p>DashboardPage stub</p> }))
vi.mock('./pages/staff/MembersPage', () => ({ default: () => <p>MembersPage stub</p> }))
vi.mock('./pages/staff/ContributionsPage', () => ({ default: () => <p>ContributionsPage stub</p> }))
vi.mock('./pages/staff/MyMoneyPage', () => ({ default: () => <p>MyMoneyPage stub</p> }))
vi.mock('./pages/staff/ContributionPaymentResultPage', () => ({
  default: () => <p>ContributionPaymentResultPage stub</p>,
}))
vi.mock('./pages/staff/LoansPage', () => ({ default: () => <p>LoansPage stub</p> }))
vi.mock('./pages/staff/PenaltiesPage', () => ({ default: () => <p>PenaltiesPage stub</p> }))
vi.mock('./pages/staff/PayoutsPage', () => ({ default: () => <p>PayoutsPage stub</p> }))
vi.mock('./pages/staff/ApprovalsPage', () => ({ default: () => <p>ApprovalsPage stub</p> }))
vi.mock('./pages/staff/MeetingsPage', () => ({ default: () => <p>MeetingsPage stub</p> }))
vi.mock('./pages/staff/ResolutionsPage', () => ({ default: () => <p>ResolutionsPage stub</p> }))
vi.mock('./pages/staff/WelfareFundPage', () => ({ default: () => <p>WelfareFundPage stub</p> }))
vi.mock('./pages/staff/DocumentGeneratorPage', () => ({
  default: () => <p>DocumentGeneratorPage stub</p>,
}))
vi.mock('./pages/staff/NotificationPreferencesPage', () => ({
  default: () => <p>NotificationPreferencesPage stub</p>,
}))
vi.mock('./pages/staff/ProfilePage', () => ({ default: () => <p>ProfilePage stub</p> }))
vi.mock('./pages/staff/AdminOverviewPage', () => ({ default: () => <p>AdminOverviewPage stub</p> }))
vi.mock('./pages/staff/SecurityEventsPage', () => ({
  default: () => <p>SecurityEventsPage stub</p>,
}))

import App from './App'

/** Renders App at the given path; the router reads it from the real (jsdom) history. */
function renderAt(path: string) {
  window.history.pushState({}, '', path)
  return render(<App />)
}

// The pages are lazy chunks now, and in this suite the first render of one also pays for
// transforming its module graph, so the waits are far above the library default.
const CHUNK_WAIT = { timeout: 15_000 }

describe('App', () => {
  it('renders the home page at the root route', async () => {
    renderAt('/')
    // The home page is a lazy chunk now, so it appears a tick after the first render.
    expect(
      await screen.findByText('Every shilling lands in the kiondo.', undefined, CHUNK_WAIT),
    ).toBeTruthy()
  }, 20_000)

  it('shows the not-found screen for a path no route claims', async () => {
    renderAt('/definitely-not-a-page')
    expect(await screen.findByText('Page not found', undefined, CHUNK_WAIT)).toBeTruthy()
  }, 20_000)

  it('resolves every staff route to its own lazily loaded page', async () => {
    const routes: Array<[string, string]> = [
      ['/my-chamas', 'MyChamasPage stub'],
      ['/profile', 'ProfilePage stub'],
      ['/notification-preferences', 'NotificationPreferencesPage stub'],
      ['/chamas', 'ChamasPage stub'],
      ['/chamas/1/dashboard', 'DashboardPage stub'],
      ['/chamas/1/members', 'MembersPage stub'],
      ['/chamas/1/my-money', 'MyMoneyPage stub'],
      ['/chamas/1/contributions', 'ContributionsPage stub'],
      ['/chamas/1/loans', 'LoansPage stub'],
      ['/chamas/1/penalties', 'PenaltiesPage stub'],
      ['/chamas/1/payouts', 'PayoutsPage stub'],
      ['/chamas/1/approvals', 'ApprovalsPage stub'],
      ['/chamas/1/meetings', 'MeetingsPage stub'],
      ['/chamas/1/resolutions', 'ResolutionsPage stub'],
      ['/chamas/1/welfare-fund', 'WelfareFundPage stub'],
      ['/chamas/1/documents', 'DocumentGeneratorPage stub'],
      ['/admin/overview', 'AdminOverviewPage stub'],
      ['/admin/security-events', 'SecurityEventsPage stub'],
      ['/contribution-payment-result', 'ContributionPaymentResultPage stub'],
    ]

    for (const [path, label] of routes) {
      const { unmount } = renderAt(path)
      expect(await screen.findByText(label, undefined, CHUNK_WAIT)).toBeTruthy()
      unmount()
    }
  }, 60_000)
})
