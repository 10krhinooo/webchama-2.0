import { client } from './client'

export interface PlatformOverview {
  totalChamas: number
  activeChamas: number
  newChamasThisMonth: number
  totalMemberships: number
  activeMemberships: number
  totalContributionsCollected: number
  contributionsCollectedThisMonth: number
  overdueContributions: number
  outstandingLoans: number
  outstandingLoanPrincipal: number
  mpesaPaymentsSucceeded: number
  mpesaPaymentsFailed: number
  cardPaymentsSucceeded: number
  cardPaymentsFailed: number
}

export async function getPlatformOverview(): Promise<PlatformOverview> {
  const { data } = await client.get<PlatformOverview>('/admin/overview')
  return data
}
