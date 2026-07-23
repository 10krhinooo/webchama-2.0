package org.chama.dto;

import org.chama.domain.enums.LoanDisbursementStatus;
import org.chama.domain.model.LoanDisbursement;

import java.math.BigDecimal;
import java.time.Instant;

public record LoanDisbursementDto(
    Long id,
    Long loanId,
    String conversationId,
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
            disbursement.conversationId,
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
