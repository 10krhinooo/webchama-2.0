import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import AdminOverviewPage from './AdminOverviewPage'

vi.mock('../../api/admin', () => ({
  getPlatformOverview: vi.fn(),
}))

import { getPlatformOverview } from '../../api/admin'

const mockGetPlatformOverview = getPlatformOverview as ReturnType<typeof vi.fn>

const overview = {
  totalChamas: 12,
  activeChamas: 10,
  newChamasThisMonth: 3,
  totalMemberships: 84,
  activeMemberships: 79,
  totalContributionsCollected: 5200000,
  contributionsCollectedThisMonth: 420000,
  overdueContributions: 6,
  outstandingLoans: 4,
  outstandingLoanPrincipal: 180000,
  mpesaPaymentsSucceeded: 40,
  mpesaPaymentsFailed: 2,
  cardPaymentsSucceeded: 5,
  cardPaymentsFailed: 0,
}

function renderPage() {
  return render(<AdminOverviewPage />)
}

describe('AdminOverviewPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders platform-wide KPI tiles once loaded', async () => {
    mockGetPlatformOverview.mockResolvedValue(overview)
    renderPage()

    await waitFor(() => expect(screen.getByText('12')).toBeTruthy())
    expect(screen.getByText('10 active')).toBeTruthy()
    expect(screen.getByText('3')).toBeTruthy()
    expect(screen.getByText('84')).toBeTruthy()
    expect(screen.getByText('79 active')).toBeTruthy()
    expect(screen.getByText('6')).toBeTruthy()
    expect(screen.getByText('KES 5,200,000')).toBeTruthy()
    expect(screen.getByText('KES 420,000')).toBeTruthy()
    expect(screen.getByText('KES 180,000')).toBeTruthy()
  })

  it('shows a payment success rate summary for M-Pesa and card', async () => {
    mockGetPlatformOverview.mockResolvedValue(overview)
    renderPage()

    await waitFor(() => expect(screen.getByText(/95% success \(40 of 42\)/)).toBeTruthy())
    expect(screen.getByText(/100% success \(5 of 5\)/)).toBeTruthy()
  })

  it('shows a no-payments message when a provider has none yet', async () => {
    mockGetPlatformOverview.mockResolvedValue({ ...overview, cardPaymentsSucceeded: 0, cardPaymentsFailed: 0 })
    renderPage()

    await waitFor(() => expect(screen.getByText('No payments yet')).toBeTruthy())
  })

  it('shows the backend error message when the overview fails to load', async () => {
    mockGetPlatformOverview.mockRejectedValue(new Error('Forbidden'))
    renderPage()

    await waitFor(() => expect(screen.getByText('Forbidden')).toBeTruthy())
  })

  it('renders chart sections once loaded', async () => {
    mockGetPlatformOverview.mockResolvedValue(overview)
    renderPage()

    await waitFor(() => expect(screen.getByText('Chamas by status')).toBeTruthy())
    expect(screen.getByText('Memberships by status')).toBeTruthy()
    expect(screen.getByText('Payments by rail')).toBeTruthy()
  })

  it('exports the overview as a CSV download when the export button is clicked', async () => {
    mockGetPlatformOverview.mockResolvedValue(overview)

    const clickSpy = vi.fn()
    const originalCreateElement = document.createElement.bind(document)
    const createElementSpy = vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = originalCreateElement(tag)
      if (tag === 'a') el.click = clickSpy
      return el
    })
    const createObjectUrlSpy = vi.fn().mockReturnValue('blob:mock')
    const revokeObjectUrlSpy = vi.fn()
    URL.createObjectURL = createObjectUrlSpy
    URL.revokeObjectURL = revokeObjectUrlSpy

    renderPage()

    await waitFor(() => expect(screen.getByText('Export CSV')).toBeTruthy())
    fireEvent.click(screen.getByText('Export CSV'))

    expect(createObjectUrlSpy).toHaveBeenCalled()
    expect(clickSpy).toHaveBeenCalled()
    expect(revokeObjectUrlSpy).toHaveBeenCalledWith('blob:mock')

    createElementSpy.mockRestore()
  })
})
