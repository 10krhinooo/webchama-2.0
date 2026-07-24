import { client } from './client'

export type PaymentMethod = 'MPESA' | 'CARD' | 'CASH' | 'BANK'
export type WelfareContributionStatus = 'PENDING' | 'PAID'

export interface WelfareFund {
  chamaId: number
  balance: number
}

export interface WelfareContribution {
  id: number
  chamaId: number
  memberId: number
  memberName: string
  amount: number
  paymentMethod: PaymentMethod | null
  status: WelfareContributionStatus
  paidAt: string | null
  createdAt: string
}

export interface WelfareWithdrawal {
  id: number
  chamaId: number
  amount: number
  reason: string
  disbursedByMemberId: number
  disbursedByName: string
  disbursedAt: string
}

export interface RecordWelfareContributionRequest {
  memberId: number
  amount: number
  method: PaymentMethod
}

export interface CreateWelfareWithdrawalRequest {
  amount: number
  reason: string
}

export async function getWelfareFund(chamaId: number): Promise<WelfareFund> {
  const { data } = await client.get<WelfareFund>(`/chamas/${chamaId}/welfare-fund`)
  return data
}

export async function getWelfareContributions(chamaId: number): Promise<WelfareContribution[]> {
  const { data } = await client.get<WelfareContribution[]>(`/chamas/${chamaId}/welfare-fund/contributions`)
  return data
}

export async function getMyWelfareContributions(chamaId: number): Promise<WelfareContribution[]> {
  const { data } = await client.get<WelfareContribution[]>(`/chamas/${chamaId}/welfare-fund/contributions/mine`)
  return data
}

export async function recordWelfareContribution(
  chamaId: number,
  payload: RecordWelfareContributionRequest,
): Promise<WelfareContribution> {
  const { data } = await client.post<WelfareContribution>(`/chamas/${chamaId}/welfare-fund/contributions`, payload)
  return data
}

export async function payWelfareContributionWithMpesa(chamaId: number, amount: number): Promise<void> {
  await client.post(`/chamas/${chamaId}/welfare-fund/contributions/pay/mpesa`, { amount })
}

export async function getWelfareWithdrawals(chamaId: number): Promise<WelfareWithdrawal[]> {
  const { data } = await client.get<WelfareWithdrawal[]>(`/chamas/${chamaId}/welfare-fund/withdrawals`)
  return data
}

export async function createWelfareWithdrawal(
  chamaId: number,
  payload: CreateWelfareWithdrawalRequest,
): Promise<WelfareWithdrawal> {
  const { data } = await client.post<WelfareWithdrawal>(`/chamas/${chamaId}/welfare-fund/withdrawals`, payload)
  return data
}
