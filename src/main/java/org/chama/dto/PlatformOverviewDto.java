package org.chama.dto;

import java.math.BigDecimal;

/** Platform-wide KPIs for the SUPER_ADMIN overview, aggregated across every chama, not scoped to one tenant. */
public record PlatformOverviewDto(
    long totalChamas,
    long activeChamas,
    long newChamasThisMonth,
    long totalMemberships,
    long activeMemberships,
    BigDecimal totalContributionsCollected,
    BigDecimal contributionsCollectedThisMonth,
    long overdueContributions,
    long outstandingLoans,
    BigDecimal outstandingLoanPrincipal,
    long mpesaPaymentsSucceeded,
    long mpesaPaymentsFailed,
    long cardPaymentsSucceeded,
    long cardPaymentsFailed) {
}
