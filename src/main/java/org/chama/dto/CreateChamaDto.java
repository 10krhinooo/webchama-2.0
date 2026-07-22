package org.chama.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import org.chama.domain.enums.ChamaType;
import org.chama.domain.enums.ContributionFrequency;

import java.math.BigDecimal;

public record CreateChamaDto(
    @NotBlank String name,
    String description,
    @NotNull ChamaType type,
    String currency,
    @NotNull ContributionFrequency contributionFrequency,
    @NotNull @Positive BigDecimal contributionAmount,
    String meetingDay,
    // The creator becomes this chama's chairperson, so their own member
    // profile is created in the same transaction as the chama itself.
    @NotBlank String creatorFullName,
    @NotBlank String creatorPhone) {
}
