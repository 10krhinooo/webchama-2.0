package org.chama.dto;

import org.chama.domain.enums.PaymentMethod;
import org.chama.domain.enums.WelfareContributionStatus;
import org.chama.domain.model.WelfareContribution;

import java.math.BigDecimal;
import java.time.Instant;

public record WelfareContributionDto(
    Long id,
    Long chamaId,
    Long memberId,
    String memberName,
    BigDecimal amount,
    PaymentMethod paymentMethod,
    WelfareContributionStatus status,
    Instant paidAt,
    Instant createdAt) {

    public static WelfareContributionDto from(WelfareContribution contribution) {
        return new WelfareContributionDto(
            contribution.id,
            contribution.chama.id,
            contribution.member.id,
            contribution.member.fullName,
            contribution.amount,
            contribution.paymentMethod,
            contribution.status,
            contribution.paidAt,
            contribution.createdAt);
    }
}
