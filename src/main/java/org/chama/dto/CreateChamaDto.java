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

public record CreateChamaDto(
    @NotBlank String name,
    String description,
    @NotNull ChamaType type,
    String currency,
    @NotNull ContributionFrequency contributionFrequency,
    @NotNull @Positive BigDecimal contributionAmount,
    String meetingDay,
    // Null means no lifetime savings goal is set.
    @PositiveOrZero BigDecimal savingsTarget,
    // The creator becomes this chama's chairperson, so their own member
    // profile is created in the same transaction as the chama itself.
    @NotBlank String creatorFullName,
    @NotBlank String creatorPhone,

    @Size(max = 255) String postalAddress,
    @Size(max = 255) String physicalAddress,
    @Size(max = 32) String contactPhone,
    @Email @Size(max = 255) String contactEmail,
    @Size(max = 64) String registrationNumber) {
}
