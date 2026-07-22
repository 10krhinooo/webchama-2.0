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
