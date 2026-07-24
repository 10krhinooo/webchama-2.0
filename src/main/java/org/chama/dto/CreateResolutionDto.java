package org.chama.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record CreateResolutionDto(@NotNull Long meetingId, @NotBlank String title, String description) {
}
