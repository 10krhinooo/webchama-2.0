package org.chama.dto;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * The aggregated numbers behind a bank-ready AGM/auditor annual financial statement (issue #66),
 * before they are turned into PDF line items. Inflows are contributions, loan repayments, and
 * approved penalties; outflows are loan disbursements and member payouts. closingBalance carries
 * forward as the next period's openingBalance.
 */
public record AgmStatementDto(
    Long chamaId,
    String chamaName,
    String currency,
    LocalDate periodStart,
    LocalDate periodEnd,
    BigDecimal openingBalance,
    BigDecimal totalContributionsReceived,
    BigDecimal totalLoanRepaymentsReceived,
    BigDecimal totalPenaltiesCollected,
    BigDecimal totalLoansDisbursed,
    BigDecimal totalPayoutsDisbursed,
    BigDecimal closingBalance) {
}
