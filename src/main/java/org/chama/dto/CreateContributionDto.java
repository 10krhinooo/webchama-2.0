package org.chama.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

import java.math.BigDecimal;
import java.time.LocalDate;

public record CreateContributionDto(
    @NotNull Long memberId,
    @NotNull LocalDate period,
    @NotNull @Positive BigDecimal amountDue) {
}
