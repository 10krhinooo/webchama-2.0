package org.chama.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.PositiveOrZero;
import org.chama.domain.enums.ChamaType;
import org.chama.domain.enums.ContributionFrequency;

import java.math.BigDecimal;

public record UpdateChamaDto(
    @NotBlank String name,
    String description,
    @NotNull ChamaType type,
    String currency,
    @NotNull ContributionFrequency contributionFrequency,
    @NotNull @Positive BigDecimal contributionAmount,
    String meetingDay,
    @PositiveOrZero BigDecimal approvalThreshold) {
}
