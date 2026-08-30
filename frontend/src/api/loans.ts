import { client } from './client'

export type InterestMethod = 'FLAT' | 'REDUCING_BALANCE'
/**
 * DISBURSEMENT_PENDING is the claim the backend takes before calling the payment provider, so a
 * crash after the provider accepts cannot lose the payout and a second click cannot fire two.
 * The type omitted it while nothing in the UI could reach that state.
 */
export type LoanStatus =
  | 'REQUESTED'
  | 'APPROVED'
  | 'REJECTED'
  | 'DISBURSEMENT_PENDING'
  | 'DISBURSED'
  | 'REPAYING'
  | 'CLOSED'
  | 'DEFAULTED'
export type LoanRepaymentStatus = 'PENDING' | 'PARTIAL' | 'PAID' | 'OVERDUE'

export interface Loan {
  id: number
  chamaId: number
  memberId: number
  memberName: string
  principal: number
  interestRate: number
  interestMethod: InterestMethod
  termMonths: number
  status: LoanStatus
  approvedByMemberId: number | null
  approvedByName: string | null
  requestedAt: string
  approvedAt: string | null
  disbursedAt: string | null
}

export interface LoanRepayment {
  id: number
  loanId: number
  installmentNumber: number
  scheduledDate: string
  amountDue: number
  amountPaid: number
  status: LoanRepaymentStatus
}

export interface CreateLoanRequest {
  memberId: number
  principal: number
  interestRate: number
  interestMethod: InterestMethod
  termMonths: number
}

export async function getLoans(chamaId: number): Promise<Loan[]> {
  const { data } = await client.get<Loan[]>(`/chamas/${chamaId}/loans`)
  return data
}

export async function getMyLoans(chamaId: number): Promise<Loan[]> {
  const { data } = await client.get<Loan[]>(`/chamas/${chamaId}/loans/mine`)
  return data
}

export async function createLoan(chamaId: number, payload: CreateLoanRequest): Promise<Loan> {
  const { data } = await client.post<Loan>(`/chamas/${chamaId}/loans`, payload)
  return data
}

export async function approveLoan(chamaId: number, loanId: number): Promise<Loan> {
  const { data } = await client.put<Loan>(`/chamas/${chamaId}/loans/${loanId}/approve`, {})
  return data
}

export async function rejectLoan(chamaId: number, loanId: number): Promise<Loan> {
  const { data } = await client.put<Loan>(`/chamas/${chamaId}/loans/${loanId}/reject`, {})
  return data
}

export async function getLoanRepayments(chamaId: number, loanId: number): Promise<LoanRepayment[]> {
  const { data } = await client.get<LoanRepayment[]>(`/chamas/${chamaId}/loans/${loanId}/repayments`)
  return data
}

export async function recordLoanRepayment(
  chamaId: number,
  loanId: number,
  repaymentId: number,
  amount: number,
): Promise<LoanRepayment> {
  const { data } = await client.put<LoanRepayment>(
    `/chamas/${chamaId}/loans/${loanId}/repayments/${repaymentId}/payment`,
    { amount },
  )
  return data
}

export type LoanDisbursementStatus = 'INITIATING' | 'PENDING' | 'COMPLETED' | 'FAILED'

/**
 * A payout attempt against a loan.
 *
 * Deliberately carries no provider identifiers: the conversation id that would let a caller forge
 * a callback is never sent to a client.
 */
export interface LoanDisbursement {
  id: number
  loanId: number
  targetPhone: string
  amount: number
  status: LoanDisbursementStatus
  resultCode: string | null
  resultDescription: string | null
  transactionId: string | null
  requestedAt: string
  disbursedAt: string | null
}

/**
 * Sends an approved loan to the member by M-Pesa.
 *
 * Above the chama's approval threshold this is rejected unless a dual sign-off has already
 * cleared. The row is claimed and committed before the provider is called, so the request is
 * safe to lose but not safe to repeat: a second call while one is in flight is refused rather
 * than paying twice.
 */
export async function disburseLoan(chamaId: number, loanId: number): Promise<LoanDisbursement> {
  const { data } = await client.put<LoanDisbursement>(`/chamas/${chamaId}/loans/${loanId}/disburse`, {})
  return data
}
