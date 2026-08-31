import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./client', () => ({
  client: {
    get: vi.fn(),
    post: vi.fn(),
  },
}))

import { client } from './client'
import {
  getDocuments,
  generateCustomDocument,
  generateAgmStatement,
  sendDocumentEmail,
  type GenerateCustomDocumentRequest,
  getMyDocuments,
  getDocumentWithPdf,
  receiptForContribution,
  statementForLoan,
  receiptForPayout,
} from './documents'

const mockGet = client.get as ReturnType<typeof vi.fn>
const mockPost = client.post as ReturnType<typeof vi.fn>

describe('documents api', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('getDocuments fetches the paged list with default paging and unwraps data', async () => {
    mockGet.mockResolvedValue({ data: [{ id: 1 }] })
    const result = await getDocuments(3)
    expect(mockGet).toHaveBeenCalledWith('/chamas/3/documents', { params: { page: 0, size: 20 } })
    expect(result).toEqual([{ id: 1 }])
  })

  it('getDocuments forwards explicit paging', async () => {
    mockGet.mockResolvedValue({ data: [] })
    await getDocuments(3, 2, 10)
    expect(mockGet).toHaveBeenCalledWith('/chamas/3/documents', { params: { page: 2, size: 10 } })
  })

  it('generateCustomDocument posts the packet and unwraps data', async () => {
    const payload: GenerateCustomDocumentRequest = {
      documentType: 'CUSTOM_INVOICE',
      memberId: 5,
      lineItems: [{ description: 'Fee', quantity: 1, unitPrice: 100 }],
    }
    mockPost.mockResolvedValue({ data: { id: 9, documentNumber: 'CI-2026-07-0009' } })
    const result = await generateCustomDocument(3, payload)
    expect(mockPost).toHaveBeenCalledWith('/chamas/3/documents/generate', payload)
    expect(result).toEqual({ id: 9, documentNumber: 'CI-2026-07-0009' })
  })

  it('sendDocumentEmail posts and unwraps data', async () => {
    mockPost.mockResolvedValue({ data: { id: 9, emailStatus: 'SENT' } })
    const result = await sendDocumentEmail(3, 9)
    expect(mockPost).toHaveBeenCalledWith('/chamas/3/documents/9/send/email', {})
    expect(result).toEqual({ id: 9, emailStatus: 'SENT' })
  })

  it('generateAgmStatement posts the period as query params and unwraps data', async () => {
    mockPost.mockResolvedValue({ data: { id: 42, documentNumber: 'AGM-2026-07-0042' } })
    const result = await generateAgmStatement(3, '2026-01-01', '2026-12-31')
    expect(mockPost).toHaveBeenCalledWith(
      '/chamas/3/documents/agm-statement',
      {},
      { params: { from: '2026-01-01', to: '2026-12-31' } },
    )
    expect(result).toEqual({ id: 42, documentNumber: 'AGM-2026-07-0042' })
  })

  it('getMyDocuments reads the member-scoped list', async () => {
    mockGet.mockResolvedValue({ data: [{ id: 7 }] })
    const result = await getMyDocuments(3)
    expect(mockGet).toHaveBeenCalledWith('/chamas/3/documents/mine')
    expect(result).toEqual([{ id: 7 }])
  })

  it('getDocumentWithPdf asks for the bytes the list omits', async () => {
    mockGet.mockResolvedValue({ data: { id: 7, pdfBase64: 'JVBERi0=' } })
    const result = await getDocumentWithPdf(3, 7)
    expect(mockGet).toHaveBeenCalledWith('/chamas/3/documents/7', { params: { pdf: true } })
    expect(result).toEqual({ id: 7, pdfBase64: 'JVBERi0=' })
  })

  it('the record-derived generators post to their own record', async () => {
    mockPost.mockResolvedValue({ data: { id: 7 } })

    await receiptForContribution(3, 11)
    expect(mockPost).toHaveBeenCalledWith('/chamas/3/contributions/11/documents/receipt', {})

    await statementForLoan(3, 12)
    expect(mockPost).toHaveBeenCalledWith('/chamas/3/loans/12/documents/statement', {})

    await receiptForPayout(3, 13)
    expect(mockPost).toHaveBeenCalledWith('/chamas/3/payouts/13/documents/receipt', {})
  })
})
