package org.chama.dto;

import org.chama.domain.enums.PenaltyReason;
import org.chama.domain.enums.PenaltyStatus;
import org.chama.domain.model.Penalty;

import java.math.BigDecimal;
import java.time.Instant;

public record PenaltyDto(
    Long id,
    Long chamaId,
    Long memberId,
    String memberName,
    PenaltyReason reason,
    BigDecimal amount,
    PenaltyStatus status,
    Long decidedByMemberId,
    String decidedByName,
    Instant decidedAt,
    String waiverReason,
    Instant imposedAt) {

    public static PenaltyDto from(Penalty penalty) {
        return new PenaltyDto(
            penalty.id,
            penalty.chama.id,
            penalty.member.id,
            penalty.member.fullName,
            penalty.reason,
            penalty.amount,
            penalty.status,
            penalty.decidedBy != null ? penalty.decidedBy.id : null,
            penalty.decidedBy != null ? penalty.decidedBy.fullName : null,
            penalty.decidedAt,
            penalty.waiverReason,
            penalty.imposedAt);
    }
}
