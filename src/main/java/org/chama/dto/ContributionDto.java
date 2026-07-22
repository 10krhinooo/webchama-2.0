package org.chama.dto;

import org.chama.domain.enums.ContributionStatus;
import org.chama.domain.enums.PaymentMethod;
import org.chama.domain.model.Contribution;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

public record ContributionDto(
    Long id,
    Long chamaId,
    Long memberId,
    String memberName,
    LocalDate period,
    BigDecimal amountDue,
    BigDecimal amountPaid,
    PaymentMethod paymentMethod,
    ContributionStatus status,
    Instant paidAt) {

    public static ContributionDto from(Contribution contribution) {
        return new ContributionDto(
            contribution.id,
            contribution.chama.id,
            contribution.member.id,
            contribution.member.fullName,
            contribution.period,
            contribution.amountDue,
            contribution.amountPaid,
            contribution.paymentMethod,
            contribution.status,
            contribution.paidAt);
    }
}
