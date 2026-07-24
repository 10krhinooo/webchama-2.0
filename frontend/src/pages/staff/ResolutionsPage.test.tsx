import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import ResolutionsPage from './ResolutionsPage'

vi.mock('../../api/resolutions', () => ({
  getResolutions: vi.fn(),
  openResolution: vi.fn(),
  castResolutionVote: vi.fn(),
  closeResolution: vi.fn(),
}))
vi.mock('../../api/meetings', () => ({
  getMeetings: vi.fn(),
}))
vi.mock('../../hooks/useMyMembership', () => ({
  useMyMembership: vi.fn(),
}))

import { getResolutions, openResolution, castResolutionVote, closeResolution } from '../../api/resolutions'
import { getMeetings } from '../../api/meetings'
import { useMyMembership } from '../../hooks/useMyMembership'

const mockGetResolutions = getResolutions as ReturnType<typeof vi.fn>
const mockOpenResolution = openResolution as ReturnType<typeof vi.fn>
const mockCastResolutionVote = castResolutionVote as ReturnType<typeof vi.fn>
const mockCloseResolution = closeResolution as ReturnType<typeof vi.fn>
const mockGetMeetings = getMeetings as ReturnType<typeof vi.fn>
const mockUseMyMembership = useMyMembership as ReturnType<typeof vi.fn>

const resolution = {
  id: 1,
  chamaId: 3,
  meetingId: 7,
  title: 'Approve loan for Jane Doe',
  description: 'Show of hands',
  status: 'OPEN' as const,
  openedByMemberId: 2,
  openedByName: 'Secretary One',
  openedAt: '2026-07-01T00:00:00Z',
  closedAt: null,
  forVotes: 0,
  againstVotes: 0,
  abstainVotes: 0,
}

const meeting = { id: 7, chamaId: 3, meetingDate: '2026-08-15', agenda: 'Discuss Q3 contributions', minutes: null, createdAt: '2026-07-01T00:00:00Z' }

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/chamas/3/resolutions']}>
      <Routes>
        <Route path="/chamas/:chamaId/resolutions" element={<ResolutionsPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('ResolutionsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetMeetings.mockResolvedValue([meeting])
  })

  it('lists resolutions for a member', async () => {
    mockUseMyMembership.mockReturnValue({ isSecretary: false, isChairperson: false, loading: false })
    mockGetResolutions.mockResolvedValue([resolution])
    renderPage()

    await waitFor(() => expect(screen.getByText('Approve loan for Jane Doe')).toBeTruthy())
    expect(screen.getByText('Show of hands')).toBeTruthy()
    expect(screen.getByText('Secretary One')).toBeTruthy()
    expect(mockGetMeetings).not.toHaveBeenCalled()
  })

  it('shows an empty state when there are no resolutions', async () => {
    mockUseMyMembership.mockReturnValue({ isSecretary: false, isChairperson: false, loading: false })
    mockGetResolutions.mockResolvedValue([])
    renderPage()

    await waitFor(() => expect(screen.getByText(/no resolutions yet/i)).toBeTruthy())
  })

  it('does not offer "Open Resolution" to a plain member', async () => {
    mockUseMyMembership.mockReturnValue({ isSecretary: false, isChairperson: false, loading: false })
    mockGetResolutions.mockResolvedValue([])
    renderPage()

    await waitFor(() => expect(screen.getByText(/no resolutions yet/i)).toBeTruthy())
    expect(screen.queryByText('+ Open Resolution')).toBeNull()
  })

  it('lets a secretary open a resolution against a meeting', async () => {
    mockUseMyMembership.mockReturnValue({ isSecretary: true, isChairperson: false, loading: false })
    mockGetResolutions.mockResolvedValue([])
    mockOpenResolution.mockResolvedValue({ ...resolution, id: 2 })
    renderPage()

    await waitFor(() => expect(screen.getByText(/no resolutions yet/i)).toBeTruthy())
    fireEvent.click(screen.getByText('+ Open Resolution'))
    fireEvent.change(screen.getByLabelText(/meeting/i), { target: { value: '7' } })
    fireEvent.change(screen.getByLabelText(/title/i), { target: { value: 'Approve loan for Jane Doe' } })
    fireEvent.change(screen.getByLabelText(/description/i), { target: { value: 'Show of hands' } })
    fireEvent.click(screen.getByText('Open Resolution', { selector: 'button[type="submit"]' }))

    await waitFor(() => expect(mockOpenResolution).toHaveBeenCalledWith(3, {
      meetingId: 7,
      title: 'Approve loan for Jane Doe',
      description: 'Show of hands',
    }))
  })

  it('shows the backend error message when opening a resolution fails', async () => {
    mockUseMyMembership.mockReturnValue({ isSecretary: true, isChairperson: false, loading: false })
    mockGetResolutions.mockResolvedValue([])
    mockOpenResolution.mockRejectedValue(new Error('meeting not found'))
    renderPage()

    await waitFor(() => expect(screen.getByText(/no resolutions yet/i)).toBeTruthy())
    fireEvent.click(screen.getByText('+ Open Resolution'))
    fireEvent.change(screen.getByLabelText(/meeting/i), { target: { value: '7' } })
    fireEvent.change(screen.getByLabelText(/title/i), { target: { value: 'Approve loan for Jane Doe' } })
    fireEvent.click(screen.getByText('Open Resolution', { selector: 'button[type="submit"]' }))

    await waitFor(() => expect(screen.getByText('meeting not found')).toBeTruthy())
  })

  it('lets a member cast a vote on an open resolution', async () => {
    mockUseMyMembership.mockReturnValue({ isSecretary: false, isChairperson: false, loading: false })
    mockGetResolutions.mockResolvedValue([resolution])
    mockCastResolutionVote.mockResolvedValue({ ...resolution, forVotes: 1 })
    renderPage()

    await waitFor(() => expect(screen.getByText('Approve loan for Jane Doe')).toBeTruthy())
    fireEvent.click(screen.getByText('For'))

    await waitFor(() => expect(mockCastResolutionVote).toHaveBeenCalledWith(3, 1, 'FOR'))
  })

  it('shows an error notice when casting a duplicate vote fails', async () => {
    mockUseMyMembership.mockReturnValue({ isSecretary: false, isChairperson: false, loading: false })
    mockGetResolutions.mockResolvedValue([resolution])
    mockCastResolutionVote.mockRejectedValue(new Error('You have already voted on this resolution'))
    renderPage()

    await waitFor(() => expect(screen.getByText('Approve loan for Jane Doe')).toBeTruthy())
    fireEvent.click(screen.getByText('Against'))

    await waitFor(() => expect(screen.getByText('You have already voted on this resolution')).toBeTruthy())
  })

  it('lets a secretary close an open resolution', async () => {
    mockUseMyMembership.mockReturnValue({ isSecretary: true, isChairperson: false, loading: false })
    mockGetResolutions.mockResolvedValue([resolution])
    mockCloseResolution.mockResolvedValue({ ...resolution, status: 'PASSED' })
    renderPage()

    await waitFor(() => expect(screen.getByText('Approve loan for Jane Doe')).toBeTruthy())
    fireEvent.click(screen.getByText('Close'))

    await waitFor(() => expect(mockCloseResolution).toHaveBeenCalledWith(3, 1))
    await waitFor(() => expect(screen.getByText(/closed as PASSED/i)).toBeTruthy())
  })

  it('does not offer Close to a plain member', async () => {
    mockUseMyMembership.mockReturnValue({ isSecretary: false, isChairperson: false, loading: false })
    mockGetResolutions.mockResolvedValue([resolution])
    renderPage()

    await waitFor(() => expect(screen.getByText('Approve loan for Jane Doe')).toBeTruthy())
    expect(screen.queryByText('Close')).toBeNull()
  })

  it('does not offer vote or close actions once a resolution is no longer OPEN', async () => {
    mockUseMyMembership.mockReturnValue({ isSecretary: true, isChairperson: false, loading: false })
    mockGetResolutions.mockResolvedValue([{ ...resolution, status: 'PASSED', forVotes: 2, againstVotes: 1 }])
    renderPage()

    await waitFor(() => expect(screen.getByText('Approve loan for Jane Doe')).toBeTruthy())
    expect(screen.queryByText('For')).toBeNull()
    expect(screen.queryByText('Against')).toBeNull()
    expect(screen.queryByText('Abstain')).toBeNull()
    expect(screen.queryByText('Close')).toBeNull()
  })
})
