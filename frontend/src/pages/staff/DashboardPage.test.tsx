import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import DashboardPage from './DashboardPage'

vi.mock('../../api/chamas', () => ({
  getChama: vi.fn(),
}))
vi.mock('../../api/members', () => ({
  getMembers: vi.fn(),
}))
vi.mock('../../api/contributions', () => ({
  getContributions: vi.fn(),
  getMyContributions: vi.fn(),
}))
vi.mock('../../hooks/useMyMembership', () => ({
  useMyMembership: vi.fn(),
}))

import { getChama } from '../../api/chamas'
import { getMembers } from '../../api/members'
import { getContributions, getMyContributions } from '../../api/contributions'
import { useMyMembership } from '../../hooks/useMyMembership'

const mockGetChama = getChama as ReturnType<typeof vi.fn>
const mockGetMembers = getMembers as ReturnType<typeof vi.fn>
const mockGetContributions = getContributions as ReturnType<typeof vi.fn>
const mockGetMyContributions = getMyContributions as ReturnType<typeof vi.fn>
const mockUseMyMembership = useMyMembership as ReturnType<typeof vi.fn>

const chama = { id: 3, name: 'Tumaini Chama', currency: 'KES' }
const members = [{ id: 1 }, { id: 2 }, { id: 3 }]

function contribution(amountDue: number, amountPaid: number, status: string) {
  return { id: Math.random(), chamaId: 3, memberId: 1, memberName: 'X', period: '2026-07', amountDue, amountPaid, paymentMethod: null, status, paidAt: null }
}

function renderAt(path = '/chamas/3/dashboard') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/chamas/:chamaId/dashboard" element={<DashboardPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('DashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetChama.mockResolvedValue(chama)
    mockGetMembers.mockResolvedValue(members)
  })

  it('shows the chama-wide collection progress for a chairperson/treasurer', async () => {
    mockUseMyMembership.mockReturnValue({ isChairperson: true, isTreasurer: false, loading: false })
    mockGetContributions.mockResolvedValue([contribution(1000, 1000, 'PAID'), contribution(1000, 500, 'PARTIAL')])

    renderAt()

    await waitFor(() => expect(screen.getByText('Tumaini Chama')).toBeTruthy())
    expect(mockGetContributions).toHaveBeenCalledWith(3)
    expect(mockGetMyContributions).not.toHaveBeenCalled()
    expect(screen.getByText('This cycle across all members')).toBeTruthy()
    expect(screen.getByText('3')).toBeTruthy()
    expect(screen.getByText('1')).toBeTruthy()
  })

  it("shows only the member's own contribution progress for a plain member", async () => {
    mockUseMyMembership.mockReturnValue({ isChairperson: false, isTreasurer: false, loading: false })
    mockGetMyContributions.mockResolvedValue([contribution(1000, 400, 'PARTIAL')])

    renderAt()

    await waitFor(() => expect(screen.getByText('Tumaini Chama')).toBeTruthy())
    expect(mockGetMyContributions).toHaveBeenCalledWith(3)
    expect(mockGetContributions).not.toHaveBeenCalled()
    expect(screen.getByText('Your contribution this cycle')).toBeTruthy()
  })

  it('shows an error notice when loading fails', async () => {
    mockUseMyMembership.mockReturnValue({ isChairperson: true, isTreasurer: false, loading: false })
    mockGetContributions.mockRejectedValue(new Error('network down'))

    renderAt()

    await waitFor(() => expect(screen.getByText('network down')).toBeTruthy())
  })

  it('waits for the role check before fetching', () => {
    mockUseMyMembership.mockReturnValue({ isChairperson: false, isTreasurer: false, loading: true })

    renderAt()

    expect(mockGetChama).not.toHaveBeenCalled()
  })
})
