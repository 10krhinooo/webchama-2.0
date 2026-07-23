package org.chama.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;

public record CreateMeetingDto(@NotNull LocalDate meetingDate, @NotBlank String agenda) {
}
