package org.chama.dto;

import org.chama.domain.enums.InterestMethod;
import org.chama.domain.enums.LoanStatus;
import org.chama.domain.model.Loan;

import java.math.BigDecimal;
import java.time.Instant;

public record LoanDto(
    Long id,
    Long chamaId,
    Long memberId,
    String memberName,
    BigDecimal principal,
    BigDecimal interestRate,
    InterestMethod interestMethod,
    Integer termMonths,
    LoanStatus status,
    Long approvedByMemberId,
    String approvedByName,
    Instant requestedAt,
    Instant approvedAt,
    Instant disbursedAt) {

    public static LoanDto from(Loan loan) {
        return new LoanDto(
            loan.id,
            loan.chama.id,
            loan.member.id,
            loan.member.fullName,
            loan.principal,
            loan.interestRate,
            loan.interestMethod,
            loan.termMonths,
            loan.status,
            loan.approvedBy != null ? loan.approvedBy.id : null,
            loan.approvedBy != null ? loan.approvedBy.fullName : null,
            loan.requestedAt,
            loan.approvedAt,
            loan.disbursedAt);
    }
}
