package org.chama.domain.enums;

/**
 * Where a welfare fund withdrawal has reached.
 *
 * <p>A withdrawal below the chama's approval threshold is created DISBURSED in one step, exactly
 * as before. One at or above it is created PENDING_APPROVAL and moves no money until dual sign-off
 * has cleared.
 *
 * <p>There is no rejected state: a rejected approval simply leaves the request unable to disburse,
 * and a fresh request can be opened, which is how payouts behave too.
 */
public enum WelfareWithdrawalStatus {
    PENDING_APPROVAL,
    DISBURSED
}
