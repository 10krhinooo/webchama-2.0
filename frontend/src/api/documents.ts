import { client } from './client'

export type DocumentType =
  | 'CONTRIBUTION_RECEIPT'
  | 'LOAN_STATEMENT'
  | 'PAYOUT_RECEIPT'
  | 'CUSTOM_INVOICE'
  | 'CUSTOM_RECEIPT'
  | 'AGM_STATEMENT'
export type DeliveryStatus = 'PENDING' | 'SENT' | 'FAILED'

export interface DocumentLineItem {
  description: string
  amount: number
}

export interface GeneratedDocument {
  id: number
  chamaId: number
  memberId: number
  documentType: DocumentType
  documentNumber: string
  memberName: string
  memberEmail: string | null
  memberPhone: string | null
  lineItems: DocumentLineItem[]
  totalAmount: number
  billingPeriod: string | null
  notes: string | null
  emailStatus: DeliveryStatus | null
  whatsappStatus: DeliveryStatus | null
  createdAt: string
  pdfBase64: string | null
}

export interface CustomDocumentLineItemRequest {
  description: string
  quantity: number
  unitPrice: number
}

export interface GenerateCustomDocumentRequest {
  documentType: 'CUSTOM_INVOICE' | 'CUSTOM_RECEIPT'
  memberId: number
  billingPeriod?: string
  notes?: string
  lineItems: CustomDocumentLineItemRequest[]
}

export async function getDocuments(chamaId: number, page = 0, size = 20): Promise<GeneratedDocument[]> {
  const { data } = await client.get<GeneratedDocument[]>(`/chamas/${chamaId}/documents`, { params: { page, size } })
  return data
}

export async function generateCustomDocument(
  chamaId: number,
  payload: GenerateCustomDocumentRequest,
): Promise<GeneratedDocument> {
  const { data } = await client.post<GeneratedDocument>(`/chamas/${chamaId}/documents/generate`, payload)
  return data
}

export async function sendDocumentEmail(chamaId: number, id: number): Promise<GeneratedDocument> {
  const { data } = await client.post<GeneratedDocument>(`/chamas/${chamaId}/documents/${id}/send/email`, {})
  return data
}

/** One-click AGM/auditor annual financial statement export (issue #66) for a given period. */
export async function generateAgmStatement(chamaId: number, from: string, to: string): Promise<GeneratedDocument> {
  const { data } = await client.post<GeneratedDocument>(
    `/chamas/${chamaId}/documents/agm-statement`,
    {},
    { params: { from, to } },
  )
  return data
}
