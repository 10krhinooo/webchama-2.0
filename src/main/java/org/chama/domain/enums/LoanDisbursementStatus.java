package org.chama.domain.enums;

public enum LoanDisbursementStatus {
    /** Row claimed and persisted, Safaricom's paymentrequest call not yet acknowledged. */
    INITIATING,
    PENDING,
    COMPLETED,
    FAILED
}
