package org.chama.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import org.chama.domain.enums.ApprovalTargetType;

import java.math.BigDecimal;

public record RequestApprovalDto(
    @NotNull ApprovalTargetType targetType,
    @NotNull Long targetId,
    @NotNull Long memberId,
    @NotNull @Positive BigDecimal amount,
    String reason) {
}
