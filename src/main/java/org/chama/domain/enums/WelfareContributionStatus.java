package org.chama.domain.enums;

/**
 * Unlike ContributionStatus, there is no PARTIAL/OVERDUE here: a welfare contribution is always
 * for the amount the member chose to pay, never a due schedule, so it is either still waiting on
 * its payment to clear or already credited to the fund.
 */
public enum WelfareContributionStatus {
    PENDING,
    PAID
}
