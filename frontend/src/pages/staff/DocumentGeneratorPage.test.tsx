import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import DocumentGeneratorPage from './DocumentGeneratorPage'
import { selectOption } from '../../test-utils/selectOption'

vi.mock('../../api/documents', () => ({
  getDocuments: vi.fn(),
  generateCustomDocument: vi.fn(),
  generateAgmStatement: vi.fn(),
  sendDocumentEmail: vi.fn(),
}))
vi.mock('../../api/members', () => ({
  getMembers: vi.fn(),
}))
vi.mock('../../hooks/useMyMembership', () => ({
  useMyMembership: vi.fn(),
}))

import { getDocuments, generateCustomDocument, generateAgmStatement, sendDocumentEmail } from '../../api/documents'
import { getMembers } from '../../api/members'
import { useMyMembership } from '../../hooks/useMyMembership'

const mockGetDocuments = getDocuments as ReturnType<typeof vi.fn>
const mockGenerateCustomDocument = generateCustomDocument as ReturnType<typeof vi.fn>
const mockGenerateAgmStatement = generateAgmStatement as ReturnType<typeof vi.fn>
const mockSendDocumentEmail = sendDocumentEmail as ReturnType<typeof vi.fn>
const mockGetMembers = getMembers as ReturnType<typeof vi.fn>
const mockUseMyMembership = useMyMembership as ReturnType<typeof vi.fn>

const member = { id: 5, fullName: 'Jane Doe', status: 'ACTIVE' }

const document = {
  id: 9,
  chamaId: 3,
  memberId: 5,
  documentType: 'CUSTOM_INVOICE' as const,
  documentNumber: 'CI-2026-07-0009',
  memberName: 'Jane Doe',
  memberEmail: 'jane@example.com',
  memberPhone: '254700000000',
  lineItems: [{ description: 'Registration fee', amount: 300 }],
  totalAmount: 300,
  billingPeriod: 'July 2026',
  notes: null,
  emailStatus: null,
  whatsappStatus: null,
  createdAt: '2026-07-01T00:00:00Z',
  pdfBase64: 'AAAA',
}

const agmDocument = {
  id: 42,
  chamaId: 3,
  memberId: 5,
  documentType: 'AGM_STATEMENT' as const,
  documentNumber: 'AGM-2026-07-0042',
  memberName: 'Annual General Meeting',
  memberEmail: null,
  memberPhone: '254700000501',
  lineItems: [{ description: 'Opening balance as at 1 Jan 2026', amount: 0 }],
  totalAmount: 15000,
  billingPeriod: '1 Jan 2026 to 31 Dec 2026',
  notes: 'Prepared for AGM/auditor review by Treasurer One.',
  emailStatus: null,
  whatsappStatus: null,
  createdAt: '2026-07-01T00:00:00Z',
  pdfBase64: 'BBBB',
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/chamas/3/documents']}>
      <Routes>
        <Route path="/chamas/:chamaId/documents" element={<DocumentGeneratorPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('DocumentGeneratorPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetMembers.mockResolvedValue([member])
  })

  it('shows a restricted message for a plain member', async () => {
    mockUseMyMembership.mockReturnValue({ isTreasurer: false, isChairperson: false, loading: false })
    renderPage()

    await waitFor(() => expect(screen.getByText(/only treasurers and chairpersons/i)).toBeTruthy())
    expect(mockGetDocuments).not.toHaveBeenCalled()
  })

  it('lists previously generated documents for a treasurer', async () => {
    mockUseMyMembership.mockReturnValue({ isTreasurer: true, isChairperson: false, loading: false })
    mockGetDocuments.mockResolvedValue([document])
    renderPage()

    await waitFor(() => expect(screen.getByText('CI-2026-07-0009')).toBeTruthy())
    expect(screen.getByText('Jane Doe')).toBeTruthy()
  })

  it('shows an empty state when there are no documents yet', async () => {
    mockUseMyMembership.mockReturnValue({ isTreasurer: true, isChairperson: false, loading: false })
    mockGetDocuments.mockResolvedValue([])
    renderPage()

    await waitFor(() => expect(screen.getByText(/no documents generated yet/i)).toBeTruthy())
  })

  it('walks through the wizard and generates a custom invoice', async () => {
    mockUseMyMembership.mockReturnValue({ isTreasurer: true, isChairperson: false, loading: false })
    mockGetDocuments.mockResolvedValue([])
    mockGenerateCustomDocument.mockResolvedValue(document)
    renderPage()

    await waitFor(() => expect(screen.getByText(/no documents generated yet/i)).toBeTruthy())
    fireEvent.click(screen.getByText('+ New Document'))

    // Step 0: Setup
    await waitFor(() => expect(screen.getByLabelText(/member/i)).toBeTruthy())
    expect(screen.getByText('Next')).toHaveProperty('disabled', true)
    selectOption(/member/i, 'Jane Doe')
    fireEvent.click(screen.getByText('Next'))

    // Step 1: Line Items
    await waitFor(() => expect(screen.getByLabelText('Description')).toBeTruthy())
    expect(screen.getByText('Next')).toHaveProperty('disabled', true)
    fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'Registration fee' } })
    fireEvent.change(screen.getByLabelText('Unit price'), { target: { value: '300' } })
    fireEvent.click(screen.getByText('Next'))

    // Step 2: Details
    await waitFor(() => expect(screen.getByLabelText('Billing period')).toBeTruthy())
    fireEvent.change(screen.getByLabelText('Billing period'), { target: { value: 'July 2026' } })
    fireEvent.click(screen.getByText('Generate'))

    // Step 3: Preview & Send
    await waitFor(() =>
      expect(mockGenerateCustomDocument).toHaveBeenCalledWith(3, {
        documentType: 'CUSTOM_INVOICE',
        memberId: 5,
        billingPeriod: 'July 2026',
        notes: undefined,
        lineItems: [{ description: 'Registration fee', quantity: 1, unitPrice: 300 }],
      }),
    )
    await waitFor(() => expect(screen.getByText('CI-2026-07-0009')).toBeTruthy())
    expect(screen.getByTitle('Document preview')).toBeTruthy()
  })

  it('shows the backend error message when generation fails', async () => {
    mockUseMyMembership.mockReturnValue({ isTreasurer: true, isChairperson: false, loading: false })
    mockGetDocuments.mockResolvedValue([])
    mockGenerateCustomDocument.mockRejectedValue(new Error('At least one line item is required'))
    renderPage()

    await waitFor(() => expect(screen.getByText(/no documents generated yet/i)).toBeTruthy())
    fireEvent.click(screen.getByText('+ New Document'))
    await waitFor(() => expect(screen.getByLabelText(/member/i)).toBeTruthy())
    selectOption(/member/i, 'Jane Doe')
    fireEvent.click(screen.getByText('Next'))

    await waitFor(() => expect(screen.getByLabelText('Description')).toBeTruthy())
    fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'Fee' } })
    fireEvent.change(screen.getByLabelText('Unit price'), { target: { value: '100' } })
    fireEvent.click(screen.getByText('Next'))

    await waitFor(() => expect(screen.getByLabelText('Billing period')).toBeTruthy())
    fireEvent.click(screen.getByText('Generate'))

    await waitFor(() => expect(screen.getByText('At least one line item is required')).toBeTruthy())
  })

  it('sends the generated document by email', async () => {
    mockUseMyMembership.mockReturnValue({ isTreasurer: true, isChairperson: false, loading: false })
    mockGetDocuments.mockResolvedValue([])
    mockGenerateCustomDocument.mockResolvedValue(document)
    mockSendDocumentEmail.mockResolvedValue({ ...document, emailStatus: 'SENT' })
    renderPage()

    await waitFor(() => expect(screen.getByText(/no documents generated yet/i)).toBeTruthy())
    fireEvent.click(screen.getByText('+ New Document'))
    await waitFor(() => expect(screen.getByLabelText(/member/i)).toBeTruthy())
    selectOption(/member/i, 'Jane Doe')
    fireEvent.click(screen.getByText('Next'))
    await waitFor(() => expect(screen.getByLabelText('Description')).toBeTruthy())
    fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'Fee' } })
    fireEvent.change(screen.getByLabelText('Unit price'), { target: { value: '300' } })
    fireEvent.click(screen.getByText('Next'))
    await waitFor(() => expect(screen.getByLabelText('Billing period')).toBeTruthy())
    fireEvent.click(screen.getByText('Generate'))

    await waitFor(() => expect(screen.getByText('CI-2026-07-0009')).toBeTruthy())
    fireEvent.click(screen.getByText('Send Email'))

    await waitFor(() => expect(mockSendDocumentEmail).toHaveBeenCalledWith(3, 9))
    await waitFor(() => expect(screen.getByText('Email: SENT')).toBeTruthy())

    fireEvent.click(screen.getByText('Done'))
    await waitFor(() => expect(screen.getByText('Document emailed.')).toBeTruthy())
  })

  it('adds and removes line item rows', async () => {
    mockUseMyMembership.mockReturnValue({ isTreasurer: true, isChairperson: false, loading: false })
    mockGetDocuments.mockResolvedValue([])
    renderPage()

    await waitFor(() => expect(screen.getByText(/no documents generated yet/i)).toBeTruthy())
    fireEvent.click(screen.getByText('+ New Document'))
    await waitFor(() => expect(screen.getByLabelText(/member/i)).toBeTruthy())
    selectOption(/member/i, 'Jane Doe')
    fireEvent.click(screen.getByText('Next'))

    await waitFor(() => expect(screen.getAllByLabelText('Description')).toHaveLength(1))
    fireEvent.click(screen.getByText('+ Add line item'))
    expect(screen.getAllByLabelText('Description')).toHaveLength(2)

    fireEvent.click(screen.getAllByText('Remove')[0])
    expect(screen.getAllByLabelText('Description')).toHaveLength(1)
  })

  it('generates an AGM statement for the selected period', async () => {
    mockUseMyMembership.mockReturnValue({ isTreasurer: true, isChairperson: false, loading: false })
    mockGetDocuments.mockResolvedValue([])
    mockGenerateAgmStatement.mockResolvedValue(agmDocument)
    renderPage()

    await waitFor(() => expect(screen.getByText('AGM / Auditor Export')).toBeTruthy())
    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-01-01' } })
    fireEvent.change(screen.getByLabelText('To'), { target: { value: '2026-12-31' } })
    fireEvent.click(screen.getByText('Generate AGM Statement'))

    await waitFor(() => expect(mockGenerateAgmStatement).toHaveBeenCalledWith(3, '2026-01-01', '2026-12-31'))
    await waitFor(() => expect(screen.getByText('AGM-2026-07-0042')).toBeTruthy())
    expect(screen.getByText(/Closing balance: KES 15,000/)).toBeTruthy()
    expect(screen.getByTitle('AGM statement preview')).toBeTruthy()

    fireEvent.click(screen.getByText('Dismiss'))
    expect(screen.queryByText('AGM-2026-07-0042')).toBeNull()
  })

  it('shows the backend error message when AGM statement generation fails', async () => {
    mockUseMyMembership.mockReturnValue({ isTreasurer: true, isChairperson: false, loading: false })
    mockGetDocuments.mockResolvedValue([])
    mockGenerateAgmStatement.mockRejectedValue(new Error('Period end must not be before period start'))
    renderPage()

    await waitFor(() => expect(screen.getByText('AGM / Auditor Export')).toBeTruthy())
    fireEvent.click(screen.getByText('Generate AGM Statement'))

    await waitFor(() => expect(screen.getByText('Period end must not be before period start')).toBeTruthy())
  })

  it('distinguishes a failed load from an empty list', async () => {
    mockUseMyMembership.mockReturnValue({ isTreasurer: true, isChairperson: false, loading: false })
    mockGetDocuments.mockRejectedValue(new Error('Service unavailable'))
    renderPage()

    expect(await screen.findByTestId('load-failed')).toBeTruthy()
    expect(screen.getByText('Service unavailable')).toBeTruthy()
    // A request that failed is not an account with nothing in it. Saying the second when the first
    // happened states something false and then invites the reader to act on it.
    expect(screen.queryByTestId('empty-state')).toBeNull()
  })
})
