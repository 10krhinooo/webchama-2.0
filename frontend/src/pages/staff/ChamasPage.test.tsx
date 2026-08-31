import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import ChamasPage from './ChamasPage'
import { selectOption } from '../../test-utils/selectOption'

vi.mock('../../api/chamas', () => ({
  getChamas: vi.fn(),
  createChama: vi.fn(),
  updateChama: vi.fn(),
  deleteChama: vi.fn(),
  uploadChamaLogo: vi.fn(),
  deleteChamaLogo: vi.fn(),
  chamaLogoUrl: (id: number) => `/api/chamas/${id}/logo`,
}))

import { getChamas, createChama, updateChama, deleteChama, uploadChamaLogo, deleteChamaLogo } from '../../api/chamas'

const mockGetChamas = getChamas as ReturnType<typeof vi.fn>
const mockCreateChama = createChama as ReturnType<typeof vi.fn>
const mockUpdateChama = updateChama as ReturnType<typeof vi.fn>
const mockDeleteChama = deleteChama as ReturnType<typeof vi.fn>
const mockUploadLogo = uploadChamaLogo as ReturnType<typeof vi.fn>
const mockDeleteLogo = deleteChamaLogo as ReturnType<typeof vi.fn>

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
  joinCode: 'AB12CD34',
  autoPushEnabled: true,
  autoPushRetryHours: 24,
  postalAddress: null,
  physicalAddress: null,
  contactPhone: null,
  contactEmail: null,
  registrationNumber: null,
  hasLogo: false,
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
    selectOption(/^type/i, 'Table banking')
    selectOption(/frequency/i, 'Weekly')
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

  it('distinguishes a failed load from an empty list', async () => {
    mockGetChamas.mockRejectedValue(new Error('Service unavailable'))
    renderPage()

    expect(await screen.findByTestId('load-failed')).toBeTruthy()
    expect(screen.getByText('Service unavailable')).toBeTruthy()
    // A request that failed is not an account with nothing in it. Saying the second when the first
    // happened states something false and then invites the reader to act on it.
    expect(screen.queryByTestId('empty-state')).toBeNull()
  })

  it('sends the chama details along with the money settings', async () => {
    mockUpdateChama.mockResolvedValue(chama)
    renderPage()
    await waitFor(() => expect(screen.getByText('Tumaini')).toBeTruthy())
    fireEvent.click(screen.getByText('Edit'))

    fireEvent.change(screen.getByLabelText(/postal address/i), {
      target: { value: 'P.O. Box 4021-00100, Nairobi' },
    })
    fireEvent.change(screen.getByLabelText(/registration number/i), {
      target: { value: 'CBO/2019/4021' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }))

    await waitFor(() => expect(mockUpdateChama).toHaveBeenCalled())
    expect(mockUpdateChama.mock.calls[0][1]).toMatchObject({
      postalAddress: 'P.O. Box 4021-00100, Nairobi',
      registrationNumber: 'CBO/2019/4021',
    })
  })

  it('offers no logo upload while creating, since there is nothing to attach one to yet', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByText('Tumaini')).toBeTruthy())
    fireEvent.click(screen.getByText('+ New Chama'))

    expect(screen.queryByLabelText(/^logo$/i)).toBeNull()
  })

  it('uploads a logo and shows it once it is set', async () => {
    mockUploadLogo.mockResolvedValue({ ...chama, hasLogo: true })
    renderPage()
    await waitFor(() => expect(screen.getByText('Tumaini')).toBeTruthy())
    fireEvent.click(screen.getByText('Edit'))

    const input = screen.getByLabelText(/^logo$/i) as HTMLInputElement
    const file = new File(['x'], 'logo.png', { type: 'image/png' })
    fireEvent.change(input, { target: { files: [file] } })

    await waitFor(() => expect(mockUploadLogo).toHaveBeenCalledWith(1, file))
    expect(await screen.findByAltText('Tumaini logo')).toBeTruthy()
  })

  it('shows the backend error message when the logo is rejected', async () => {
    mockUploadLogo.mockRejectedValue(new Error('That file is not a PNG or a JPEG.'))
    renderPage()
    await waitFor(() => expect(screen.getByText('Tumaini')).toBeTruthy())
    fireEvent.click(screen.getByText('Edit'))

    fireEvent.change(screen.getByLabelText(/^logo$/i), {
      target: { files: [new File(['x'], 'not-an-image.txt', { type: 'image/png' })] },
    })

    expect(await screen.findByText('That file is not a PNG or a JPEG.')).toBeTruthy()
  })

  it('removes a logo that is already set', async () => {
    mockGetChamas.mockResolvedValue([{ ...chama, hasLogo: true }])
    mockDeleteLogo.mockResolvedValue({ ...chama, hasLogo: false })
    renderPage()
    await waitFor(() => expect(screen.getByText('Tumaini')).toBeTruthy())
    fireEvent.click(screen.getByText('Edit'))

    fireEvent.click(screen.getByRole('button', { name: 'Remove' }))

    await waitFor(() => expect(mockDeleteLogo).toHaveBeenCalledWith(1))
  })
})
