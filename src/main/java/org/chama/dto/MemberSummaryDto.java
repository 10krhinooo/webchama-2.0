package org.chama.dto;

import org.chama.domain.enums.CreditScoreBand;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * A member's own money in one place.
 *
 * <p>Every figure here was already reachable, spread across the contributions, loans, penalties,
 * payouts and welfare pages, with the member left to find each one and do the arithmetic. Nothing
 * new is exposed: this is the same self-service data, aggregated.
 *
 * <p>Nullable fields mean "there isn't one" rather than zero: no next contribution due, no
 * repayment scheduled, no payout coming. A zero would read as a real amount.
 */
public record MemberSummaryDto(
    Long memberId,
    String fullName,
    String currency,

    BigDecimal contributedTotal,
    BigDecimal contributionsOutstanding,
    int overdueContributionCount,
    LocalDate nextContributionDue,
    BigDecimal nextContributionAmount,
    int onTimeStreak,

    int activeLoanCount,
    BigDecimal loanOutstanding,
    LocalDate nextRepaymentDue,
    BigDecimal nextRepaymentAmount,

    int outstandingPenaltyCount,
    BigDecimal outstandingPenaltyTotal,

    int payoutsReceived,
    Integer nextPayoutRound,
    LocalDate nextPayoutDate,

    BigDecimal welfareContributed,

    /**
     * The member's own score, and null with an INSUFFICIENT_HISTORY band when there is nothing to
     * judge. Their own is theirs to see; the whole chama's, side by side, is treasury information.
     */
    Integer creditScore,
    CreditScoreBand creditScoreBand) {
}
