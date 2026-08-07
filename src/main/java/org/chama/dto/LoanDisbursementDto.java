package org.chama.dto;

import org.chama.domain.enums.LoanDisbursementStatus;
import org.chama.domain.model.LoanDisbursement;

import java.math.BigDecimal;
import java.time.Instant;

// conversationId is deliberately not exposed here: it's the only credential a forged B2C
// callback needs, and handing it to the same TREASURER/CHAIRPERSON who can trigger a
// disbursement would let them fabricate their own "payout succeeded" callback.
public record LoanDisbursementDto(
    Long id,
    Long loanId,
    String targetPhone,
    BigDecimal amount,
    LoanDisbursementStatus status,
    String resultCode,
    String resultDescription,
    String transactionId,
    Instant requestedAt,
    Instant disbursedAt) {

    public static LoanDisbursementDto from(LoanDisbursement disbursement) {
        return new LoanDisbursementDto(
            disbursement.id,
            disbursement.loan.id,
            disbursement.targetPhone,
            disbursement.amount,
            disbursement.status,
            disbursement.resultCode,
            disbursement.resultDescription,
            disbursement.transactionId,
            disbursement.requestedAt,
            disbursement.disbursedAt);
    }
}
