package org.chama.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
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
    @PositiveOrZero BigDecimal approvalThreshold,
    // Null means no lifetime savings goal is set.
    @PositiveOrZero BigDecimal savingsTarget,

    @Size(max = 255) String postalAddress,
    @Size(max = 255) String physicalAddress,
    @Size(max = 32) String contactPhone,
    @Email @Size(max = 255) String contactEmail,
    @Size(max = 64) String registrationNumber) {
}
