import { client } from './client'

export type PaymentMethod = 'MPESA' | 'CARD' | 'CASH' | 'BANK'
export type WelfareContributionStatus = 'PENDING' | 'PAID'

export interface WelfareFund {
  chamaId: number
  balance: number
  target: number | null
}

export interface UpdateWelfareFundTargetRequest {
  target?: number
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

export type WelfareWithdrawalStatus = 'PENDING_APPROVAL' | 'DISBURSED'

export interface WelfareWithdrawal {
  id: number
  chamaId: number
  amount: number
  reason: string
  status: WelfareWithdrawalStatus
  requestedByMemberId: number
  requestedByName: string
  requestedAt: string
  /** All three are null until the money leaves the fund, which for a large withdrawal is a later step. */
  disbursedByMemberId: number | null
  disbursedByName: string | null
  disbursedAt: string | null
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

export async function updateWelfareFundTarget(
  chamaId: number,
  payload: UpdateWelfareFundTargetRequest,
): Promise<WelfareFund> {
  const { data } = await client.put<WelfareFund>(`/chamas/${chamaId}/welfare-fund/target`, payload)
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

/**
 * Opens a withdrawal. Below the chama's approval threshold it comes back DISBURSED and the money
 * has moved; at or above it, it comes back PENDING_APPROVAL and nothing has left the fund yet.
 */
export async function createWelfareWithdrawal(
  chamaId: number,
  payload: CreateWelfareWithdrawalRequest,
): Promise<WelfareWithdrawal> {
  const { data } = await client.post<WelfareWithdrawal>(`/chamas/${chamaId}/welfare-fund/withdrawals`, payload)
  return data
}

/** Releases a withdrawal whose dual sign-off has cleared. This is where the money moves. */
export async function disburseWelfareWithdrawal(
  chamaId: number,
  withdrawalId: number,
): Promise<WelfareWithdrawal> {
  const { data } = await client.put<WelfareWithdrawal>(
    `/chamas/${chamaId}/welfare-fund/withdrawals/${withdrawalId}/disburse`,
  )
  return data
}
