package org.chama.domain.enums;

public enum LoanStatus {
    REQUESTED,
    APPROVED,
    REJECTED,
    /** Disbursement claimed (B2C call initiated or in flight); prevents a second disburse call. */
    DISBURSEMENT_PENDING,
    DISBURSED,
    REPAYING,
    CLOSED,
    DEFAULTED
}
