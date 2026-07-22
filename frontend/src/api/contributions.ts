import { client } from './client'

export type PaymentMethod = 'MPESA' | 'CARD' | 'CASH' | 'BANK'
export type ContributionStatus = 'PENDING' | 'PARTIAL' | 'PAID' | 'OVERDUE'

export interface Contribution {
  id: number
  chamaId: number
  memberId: number
  memberName: string
  period: string
  amountDue: number
  amountPaid: number
  paymentMethod: PaymentMethod | null
  status: ContributionStatus
  paidAt: string | null
}

export interface CreateContributionRequest {
  memberId: number
  period: string
  amountDue: number
}

export async function getContributions(chamaId: number): Promise<Contribution[]> {
  const { data } = await client.get<Contribution[]>(`/chamas/${chamaId}/contributions`)
  return data
}

export async function getMyContributions(chamaId: number): Promise<Contribution[]> {
  const { data } = await client.get<Contribution[]>(`/chamas/${chamaId}/contributions/mine`)
  return data
}

export async function createContribution(chamaId: number, payload: CreateContributionRequest): Promise<Contribution> {
  const { data } = await client.post<Contribution>(`/chamas/${chamaId}/contributions`, payload)
  return data
}

export async function recordPayment(
  chamaId: number,
  id: number,
  amount: number,
  method: PaymentMethod,
): Promise<Contribution> {
  const { data } = await client.put<Contribution>(`/chamas/${chamaId}/contributions/${id}/payment`, { amount, method })
  return data
}

export async function deleteContribution(chamaId: number, id: number): Promise<void> {
  await client.delete(`/chamas/${chamaId}/contributions/${id}`)
}

export type PaymentPurpose = 'CONTRIBUTION' | 'LOAN_REPAYMENT' | 'PENALTY'
export type PaymentStatus = 'PENDING' | 'SUCCESS' | 'FAILED'

export interface Payment {
  id: number
  chamaId: number
  memberId: number
  contributionId: number | null
  purpose: PaymentPurpose
  amount: number
  method: PaymentMethod
  status: PaymentStatus
  providerReference: string | null
  mpesaReceiptNumber: string | null
  paidAt: string | null
  createdAt: string
}

/** Self-service: pays the contribution's remaining balance via M-Pesa STK push. */
export async function payContributionWithMpesa(chamaId: number, id: number): Promise<Payment> {
  const { data } = await client.post<Payment>(`/chamas/${chamaId}/contributions/${id}/pay/mpesa`)
  return data
}

export interface CardPaymentInit {
  paymentLink: string
  txRef: string
}

/** Self-service: starts a Flutterwave card checkout for the contribution's remaining balance. */
export async function initiateCardPayment(chamaId: number, id: number, email: string): Promise<CardPaymentInit> {
  const { data } = await client.post<CardPaymentInit>(`/chamas/${chamaId}/contributions/${id}/pay/card`, { email })
  return data
}

/** Re-verifies a card payment server-to-server after the Flutterwave checkout redirect returns. */
export async function verifyCardPayment(
  chamaId: number,
  id: number,
  txRef: string,
  transactionId: number,
): Promise<boolean> {
  const { data } = await client.get<{ paid: boolean }>(`/chamas/${chamaId}/contributions/${id}/pay/card/verify`, {
    params: { txRef, transactionId },
  })
  return data.paid
}
