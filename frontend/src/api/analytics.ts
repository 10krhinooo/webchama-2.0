import { client } from './client'

export type HealthBand = 'INSUFFICIENT_HISTORY' | 'AT_RISK' | 'FAIR' | 'GOOD' | 'THRIVING'

export interface HealthComponent {
  code: string
  label: string
  /** The component's own result, 0 to 1. */
  rate: number
  /** Its share of the score after redistribution, so the weights always add to 1. */
  weight: number
}

export interface ChamaHealth {
  chamaId: number
  /** Null when the band is INSUFFICIENT_HISTORY. There is no honest number for a blank record. */
  score: number | null
  band: HealthBand
  /** Only the components the chama actually has evidence for. */
  components: HealthComponent[]
  activeMembers: number
  membersInArrears: number
  totalContributed: string
  totalOutstandingArrears: string
  outstandingLoanPrincipal: string
}

export interface ContributionTrendPoint {
  /** ISO year and month, for example "2026-05". */
  month: string
  expected: string
  collected: string
  collectionRate: number
}

export interface ArrearsBucket {
  bucket: string
  members: number
  amount: string
}

export interface LoanPortfolioSlice {
  status: string
  loans: number
  principal: string
  outstanding: string
}

export const HEALTH_BAND_LABELS: Record<HealthBand, string> = {
  INSUFFICIENT_HISTORY: 'Not enough history',
  AT_RISK: 'At risk',
  FAIR: 'Fair',
  GOOD: 'Good',
  THRIVING: 'Thriving',
}

export async function getChamaHealth(chamaId: number): Promise<ChamaHealth> {
  const { data } = await client.get<ChamaHealth>(`/chamas/${chamaId}/analytics/health`)
  return data
}

export async function getContributionTrend(
  chamaId: number,
  months = 12,
): Promise<ContributionTrendPoint[]> {
  const { data } = await client.get<ContributionTrendPoint[]>(
    `/chamas/${chamaId}/analytics/contribution-trend`,
    { params: { months } },
  )
  return data
}

export async function getArrears(chamaId: number): Promise<ArrearsBucket[]> {
  const { data } = await client.get<ArrearsBucket[]>(`/chamas/${chamaId}/analytics/arrears`)
  return data
}

export async function getLoanPortfolio(chamaId: number): Promise<LoanPortfolioSlice[]> {
  const { data } = await client.get<LoanPortfolioSlice[]>(`/chamas/${chamaId}/analytics/loan-portfolio`)
  return data
}
