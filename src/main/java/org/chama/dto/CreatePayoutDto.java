package org.chama.dto;

import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;

public record CreatePayoutDto(@NotNull LocalDate scheduledDate) {
}
