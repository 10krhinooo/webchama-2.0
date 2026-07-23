package org.chama.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import org.chama.domain.enums.PenaltyReason;

import java.math.BigDecimal;

public record CreatePenaltyDto(
    @NotNull Long memberId,
    @NotNull PenaltyReason reason,
    @NotNull @Positive BigDecimal amount) {
}
