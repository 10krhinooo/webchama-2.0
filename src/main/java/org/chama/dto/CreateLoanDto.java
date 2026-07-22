package org.chama.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.PositiveOrZero;
import org.chama.domain.enums.InterestMethod;

import java.math.BigDecimal;

public record CreateLoanDto(
    @NotNull Long memberId,
    @NotNull @Positive BigDecimal principal,
    @NotNull @PositiveOrZero BigDecimal interestRate,
    @NotNull InterestMethod interestMethod,
    @NotNull @Min(1) @Max(360) Integer termMonths) {
}
