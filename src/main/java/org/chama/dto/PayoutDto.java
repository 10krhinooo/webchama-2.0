package org.chama.dto;

import org.chama.domain.enums.PayoutStatus;
import org.chama.domain.model.Payout;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

public record PayoutDto(
    Long id,
    Long chamaId,
    Long memberId,
    String memberName,
    Integer roundNumber,
    LocalDate scheduledDate,
    BigDecimal amount,
    PayoutStatus status,
    Instant disbursedAt,
    Instant createdAt) {

    public static PayoutDto from(Payout payout) {
        return new PayoutDto(
            payout.id,
            payout.chama.id,
            payout.member.id,
            payout.member.fullName,
            payout.roundNumber,
            payout.scheduledDate,
            payout.amount,
            payout.status,
            payout.disbursedAt,
            payout.createdAt);
    }
}
