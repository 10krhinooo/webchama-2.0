import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import MyMoneyPage from './MyMoneyPage'

vi.mock('../../api/members', async () => {
  const actual = await vi.importActual<typeof import('../../api/members')>('../../api/members')
  return { ...actual, getMySummary: vi.fn() }
})

import { getMySummary, type MemberSummary } from '../../api/members'

const mockGetMySummary = getMySummary as ReturnType<typeof vi.fn>

function aSummary(overrides: Partial<MemberSummary> = {}): MemberSummary {
  return {
    memberId: 5,
    fullName: 'Jane Doe',
    currency: 'KES',
    contributedTotal: '12000.00',
    contributionsOutstanding: '0.00',
    overdueContributionCount: 0,
    nextContributionDue: null,
    nextContributionAmount: null,
    onTimeStreak: 0,
    activeLoanCount: 0,
    loanOutstanding: '0.00',
    nextRepaymentDue: null,
    nextRepaymentAmount: null,
    outstandingPenaltyCount: 0,
    outstandingPenaltyTotal: '0.00',
    payoutsReceived: 0,
    nextPayoutRound: null,
    nextPayoutDate: null,
    welfareContributed: '0.00',
    creditScore: null,
    creditScoreBand: 'INSUFFICIENT_HISTORY',
    ...overrides,
  }
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/chamas/3/my-money']}>
      <Routes>
        <Route path="/chamas/:chamaId/my-money" element={<MyMoneyPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mockGetMySummary.mockResolvedValue(aSummary())
})

describe('MyMoneyPage', () => {
  it('leads with what the member owes', async () => {
    mockGetMySummary.mockResolvedValue(aSummary({
      contributionsOutstanding: '1500.00',
      outstandingPenaltyTotal: '200.00',
      overdueContributionCount: 2,
    }))
    renderPage()

    // Contributions and penalties together, because a member owes one amount, not two.
    expect(await screen.findByText('KES 1,700')).toBeTruthy()
    expect(screen.getByText('You owe')).toBeTruthy()
    expect(screen.getByText('2 overdue contributions')).toBeTruthy()
  })

  it('says so plainly when nothing is owed', async () => {
    renderPage()

    expect(await screen.findByText('You are up to date')).toBeTruthy()
    // Several fields legitimately read zero, so scope to the headline figure.
    expect(screen.getAllByText('KES 0').length).toBeGreaterThan(0)
  })

  it('shows an on-time streak when there is one', async () => {
    mockGetMySummary.mockResolvedValue(aSummary({ onTimeStreak: 6 }))
    renderPage()

    expect(await screen.findByText(/6 on-time streak/)).toBeTruthy()
  })

  it('does not show a streak of zero, which is not an achievement', async () => {
    renderPage()
    await screen.findByText('You are up to date')

    expect(screen.queryByText(/on-time streak/)).toBeNull()
  })

  it('shows the next contribution with its date and amount', async () => {
    mockGetMySummary.mockResolvedValue(aSummary({
      nextContributionDue: '2026-09-01',
      nextContributionAmount: '500.00',
      contributionsOutstanding: '500.00',
    }))
    renderPage()

    await screen.findByText('You owe')
    expect(screen.getByText(/KES 500 on/)).toBeTruthy()
  })

  it('says there is nothing outstanding rather than showing a blank date', async () => {
    renderPage()

    expect(await screen.findByText('Nothing outstanding')).toBeTruthy()
  })

  it('hides the loan detail entirely when there are no loans', async () => {
    renderPage()

    expect(await screen.findByText('No loans running.')).toBeTruthy()
    expect(screen.queryByText('Still to repay')).toBeNull()
  })

  it('shows loan figures when a loan is running', async () => {
    mockGetMySummary.mockResolvedValue(aSummary({
      activeLoanCount: 1,
      loanOutstanding: '3600.00',
      nextRepaymentDue: '2026-09-15',
      nextRepaymentAmount: '900.00',
    }))
    renderPage()

    expect(await screen.findByText('KES 3,600')).toBeTruthy()
    expect(screen.getByText(/KES 900 on/)).toBeTruthy()
    expect(screen.queryByText('No loans running.')).toBeNull()
  })

  it('shows the next payout turn, or says it is not scheduled', async () => {
    mockGetMySummary.mockResolvedValue(aSummary({ nextPayoutRound: 4, nextPayoutDate: '2026-11-01', payoutsReceived: 2 }))
    renderPage()

    expect(await screen.findByText(/Round 4 on/)).toBeTruthy()
    expect(screen.getByText('2')).toBeTruthy()
  })

  it('says a payout turn is not scheduled rather than leaving it blank', async () => {
    renderPage()

    expect(await screen.findByText('Not scheduled yet')).toBeTruthy()
  })

  it('shows penalties owed with how many they came from', async () => {
    mockGetMySummary.mockResolvedValue(aSummary({
      outstandingPenaltyCount: 2,
      outstandingPenaltyTotal: '300.00',
    }))
    renderPage()

    // The badge and the headline both read 300 here, which is the point: it is what they owe.
    expect((await screen.findAllByText('KES 300')).length).toBeGreaterThan(0)
    expect(screen.getByText(/across 2 penalties/)).toBeTruthy()
  })

  it('pluralises a single penalty', async () => {
    mockGetMySummary.mockResolvedValue(aSummary({
      outstandingPenaltyCount: 1,
      outstandingPenaltyTotal: '100.00',
    }))
    renderPage()

    expect(await screen.findByText(/across 1 penalty/)).toBeTruthy()
  })

  it('shows a skeleton while loading rather than an empty page', () => {
    mockGetMySummary.mockReturnValue(new Promise(() => {}))
    renderPage()

    expect(screen.getByTestId('my-money-loading')).toBeTruthy()
  })

  it('reports a failure instead of rendering zeros that look real', async () => {
    mockGetMySummary.mockRejectedValue(new Error('offline'))
    renderPage()

    expect(await screen.findByTestId('form-error')).toBeTruthy()
    expect(screen.queryByTestId('page-my-money')).toBeNull()
  })

  it('shows the member their own credit score', async () => {
    mockGetMySummary.mockResolvedValue(aSummary({ creditScore: 78, creditScoreBand: 'GOOD' }))
    renderPage()

    expect(await screen.findByText('78')).toBeTruthy()
    expect(screen.getByText('Good')).toBeTruthy()
  })

  it('says a score cannot be given yet rather than showing a placeholder', async () => {
    renderPage()

    // A number nothing supports would be read as a judgement by the member it is about.
    expect(await screen.findByText(/Not enough history yet to score/)).toBeTruthy()
  })

  it('links out to the full lists rather than duplicating them', async () => {
    renderPage()
    await screen.findByText('You are up to date')

    expect(screen.getAllByText('View all')).toHaveLength(2)
    expect(screen.getByText('View payouts')).toBeTruthy()
  })
})
