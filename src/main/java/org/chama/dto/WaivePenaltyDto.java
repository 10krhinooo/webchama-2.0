package org.chama.dto;

import jakarta.validation.constraints.NotBlank;

public record WaivePenaltyDto(@NotBlank String reason) {
}
