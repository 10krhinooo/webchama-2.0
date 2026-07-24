import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import ChamasPage from './ChamasPage'

vi.mock('../../api/chamas', () => ({
  getChamas: vi.fn(),
  createChama: vi.fn(),
  updateChama: vi.fn(),
  deleteChama: vi.fn(),
}))

import { getChamas, createChama, updateChama, deleteChama } from '../../api/chamas'

const mockGetChamas = getChamas as ReturnType<typeof vi.fn>
const mockCreateChama = createChama as ReturnType<typeof vi.fn>
const mockUpdateChama = updateChama as ReturnType<typeof vi.fn>
const mockDeleteChama = deleteChama as ReturnType<typeof vi.fn>

const chama = {
  id: 1,
  name: 'Tumaini',
  description: null,
  type: 'MERRY_GO_ROUND' as const,
  currency: 'KES',
  contributionFrequency: 'MONTHLY' as const,
  contributionAmount: 500,
  meetingDay: null,
  savingsTarget: null,
  status: 'ACTIVE' as const,
  createdAt: '2026-01-01T00:00:00Z',
}

function renderPage() {
  return render(
    <MemoryRouter>
      <ChamasPage />
    </MemoryRouter>,
  )
}

describe('ChamasPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetChamas.mockResolvedValue([chama])
  })

  it('lists the chamas the user belongs to', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByText('Tumaini')).toBeTruthy())
    expect(screen.getByText('ACTIVE')).toBeTruthy()
  })

  it('shows an empty state when the user belongs to no chama', async () => {
    mockGetChamas.mockResolvedValue([])
    renderPage()
    await waitFor(() => expect(screen.getByText(/not part of any chama/i)).toBeTruthy())
  })

  it('creates a new chama through the modal and refreshes the list', async () => {
    mockCreateChama.mockResolvedValue({ ...chama, id: 2, name: 'Upya' })
    renderPage()
    await waitFor(() => expect(screen.getByText('Tumaini')).toBeTruthy())

    fireEvent.click(screen.getByText('+ New Chama'))
    fireEvent.change(screen.getByLabelText(/^name \*/i), { target: { value: 'Upya' } })
    fireEvent.change(screen.getByLabelText(/contribution amount/i), { target: { value: '1000' } })
    fireEvent.change(screen.getByLabelText(/your full name/i), { target: { value: 'Jane' } })
    fireEvent.click(screen.getByText('Create Chama'))

    await waitFor(() => expect(mockCreateChama).toHaveBeenCalled())
    expect(mockCreateChama.mock.calls[0][0]).toMatchObject({ name: 'Upya', contributionAmount: 1000, creatorFullName: 'Jane' })
  })

  it('shows the backend error message when creation fails', async () => {
    mockCreateChama.mockRejectedValue(new Error('name already taken'))
    renderPage()
    await waitFor(() => expect(screen.getByText('Tumaini')).toBeTruthy())

    fireEvent.click(screen.getByText('+ New Chama'))
    fireEvent.change(screen.getByLabelText(/^name \*/i), { target: { value: 'Upya' } })
    fireEvent.change(screen.getByLabelText(/contribution amount/i), { target: { value: '1000' } })
    fireEvent.change(screen.getByLabelText(/your full name/i), { target: { value: 'Jane' } })
    fireEvent.click(screen.getByText('Create Chama'))

    await waitFor(() => expect(screen.getByText('name already taken')).toBeTruthy())
  })

  it('edits an existing chama without asking for creator details', async () => {
    mockUpdateChama.mockResolvedValue({ ...chama, name: 'Tumaini Renamed' })
    renderPage()
    await waitFor(() => expect(screen.getByText('Tumaini')).toBeTruthy())

    fireEvent.click(screen.getByText('Edit'))
    expect(screen.queryByLabelText(/your full name/i)).toBeNull()
    fireEvent.change(screen.getByLabelText(/^name \*/i), { target: { value: 'Tumaini Renamed' } })
    fireEvent.click(screen.getByText('Save Changes'))

    await waitFor(() => expect(mockUpdateChama).toHaveBeenCalledWith(1, expect.objectContaining({ name: 'Tumaini Renamed' })))
  })

  it('deletes a chama after confirmation', async () => {
    mockDeleteChama.mockResolvedValue(undefined)
    renderPage()
    await waitFor(() => expect(screen.getByText('Tumaini')).toBeTruthy())

    fireEvent.click(screen.getByText('Delete'))
    const dialog = screen.getByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(mockDeleteChama).toHaveBeenCalledWith(1))
  })

  it('does not delete when the confirmation is dismissed', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByText('Tumaini')).toBeTruthy())

    fireEvent.click(screen.getByText('Delete'))
    const dialog = screen.getByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    expect(mockDeleteChama).not.toHaveBeenCalled()
  })

  it('shows the muted badge variant for an inactive chama', async () => {
    mockGetChamas.mockResolvedValue([{ ...chama, status: 'INACTIVE' as const }])
    renderPage()
    await waitFor(() => expect(screen.getByText('INACTIVE')).toBeTruthy())
  })

  it('submits description, type, frequency and currency edits', async () => {
    mockCreateChama.mockResolvedValue({ ...chama, id: 2 })
    renderPage()
    await waitFor(() => expect(screen.getByText('Tumaini')).toBeTruthy())

    fireEvent.click(screen.getByText('+ New Chama'))
    fireEvent.change(screen.getByLabelText(/^name \*/i), { target: { value: 'Upya' } })
    fireEvent.change(screen.getByLabelText(/description/i), { target: { value: 'A savings group' } })
    fireEvent.change(screen.getByLabelText(/^type/i), { target: { value: 'TABLE_BANKING' } })
    fireEvent.change(screen.getByLabelText(/frequency/i), { target: { value: 'WEEKLY' } })
    fireEvent.change(screen.getByLabelText(/currency/i), { target: { value: 'USD' } })
    fireEvent.change(screen.getByLabelText(/meeting day/i), { target: { value: 'Fridays' } })
    fireEvent.change(screen.getByLabelText(/contribution amount/i), { target: { value: '1000' } })
    fireEvent.change(screen.getByLabelText(/your full name/i), { target: { value: 'Jane' } })
    fireEvent.click(screen.getByText('Create Chama'))

    await waitFor(() => expect(mockCreateChama).toHaveBeenCalled())
    expect(mockCreateChama.mock.calls[0][0]).toMatchObject({
      description: 'A savings group',
      type: 'TABLE_BANKING',
      contributionFrequency: 'WEEKLY',
      currency: 'USD',
      meetingDay: 'Fridays',
    })
  })

  it('submits a savings target when set', async () => {
    mockCreateChama.mockResolvedValue({ ...chama, id: 2 })
    renderPage()
    await waitFor(() => expect(screen.getByText('Tumaini')).toBeTruthy())

    fireEvent.click(screen.getByText('+ New Chama'))
    fireEvent.change(screen.getByLabelText(/^name \*/i), { target: { value: 'Upya' } })
    fireEvent.change(screen.getByLabelText(/contribution amount/i), { target: { value: '1000' } })
    fireEvent.change(screen.getByLabelText(/savings target/i), { target: { value: '500000' } })
    fireEvent.change(screen.getByLabelText(/your full name/i), { target: { value: 'Jane' } })
    fireEvent.click(screen.getByText('Create Chama'))

    await waitFor(() => expect(mockCreateChama).toHaveBeenCalled())
    expect(mockCreateChama.mock.calls[0][0]).toMatchObject({ savingsTarget: 500000 })
  })

  it('leaves the savings target unset when the field is left blank', async () => {
    mockCreateChama.mockResolvedValue({ ...chama, id: 2 })
    renderPage()
    await waitFor(() => expect(screen.getByText('Tumaini')).toBeTruthy())

    fireEvent.click(screen.getByText('+ New Chama'))
    fireEvent.change(screen.getByLabelText(/^name \*/i), { target: { value: 'Upya' } })
    fireEvent.change(screen.getByLabelText(/contribution amount/i), { target: { value: '1000' } })
    fireEvent.change(screen.getByLabelText(/your full name/i), { target: { value: 'Jane' } })
    fireEvent.click(screen.getByText('Create Chama'))

    await waitFor(() => expect(mockCreateChama).toHaveBeenCalled())
    expect(mockCreateChama.mock.calls[0][0].savingsTarget).toBeUndefined()
  })

  it('preloads the savings target when editing a chama that already has one', async () => {
    mockGetChamas.mockResolvedValue([{ ...chama, savingsTarget: 250000 }])
    renderPage()
    await waitFor(() => expect(screen.getByText('Tumaini')).toBeTruthy())

    fireEvent.click(screen.getByText('Edit'))
    expect(screen.getByLabelText(/savings target/i)).toHaveValue(250000)
  })
})
