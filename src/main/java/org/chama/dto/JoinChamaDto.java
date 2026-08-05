package org.chama.dto;

import jakarta.validation.constraints.NotBlank;

public record JoinChamaDto(
    @NotBlank String joinCode,
    @NotBlank String fullName,
    @NotBlank String phone,
    String nationalId,
    String nextOfKin) {
}
