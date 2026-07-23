package org.chama.dto;

import org.chama.domain.enums.PayoutScheduleEntryStatus;
import org.chama.domain.enums.RotationOrderType;
import org.chama.domain.model.PayoutSchedule;

public record PayoutScheduleEntryDto(
    Long id,
    Long chamaId,
    Long memberId,
    String memberName,
    RotationOrderType rotationOrderType,
    Integer sequencePosition,
    PayoutScheduleEntryStatus status) {

    public static PayoutScheduleEntryDto from(PayoutSchedule entry) {
        return new PayoutScheduleEntryDto(
            entry.id,
            entry.chama.id,
            entry.member.id,
            entry.member.fullName,
            entry.rotationOrderType,
            entry.sequencePosition,
            entry.status);
    }
}
