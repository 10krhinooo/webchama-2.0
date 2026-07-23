import { client } from './client'

export type InterestMethod = 'FLAT' | 'REDUCING_BALANCE'
export type LoanStatus = 'REQUESTED' | 'APPROVED' | 'DISBURSED' | 'REPAYING' | 'CLOSED' | 'DEFAULTED'
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
