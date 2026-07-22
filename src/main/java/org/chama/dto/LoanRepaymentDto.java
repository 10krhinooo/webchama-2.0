package org.chama.dto;

import org.chama.domain.enums.LoanRepaymentStatus;
import org.chama.domain.model.LoanRepayment;

import java.math.BigDecimal;
import java.time.LocalDate;

public record LoanRepaymentDto(
    Long id,
    Long loanId,
    Integer installmentNumber,
    LocalDate scheduledDate,
    BigDecimal amountDue,
    BigDecimal amountPaid,
    LoanRepaymentStatus status) {

    public static LoanRepaymentDto from(LoanRepayment repayment) {
        return new LoanRepaymentDto(
            repayment.id,
            repayment.loan.id,
            repayment.installmentNumber,
            repayment.scheduledDate,
            repayment.amountDue,
            repayment.amountPaid,
            repayment.status);
    }
}
