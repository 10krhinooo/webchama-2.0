package org.chama.dto;

import jakarta.validation.constraints.NotBlank;

public record UpdateMeetingMinutesDto(@NotBlank String minutes) {
}
