package org.chama.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

/**
 * Bounds mirror the check constraints in V42. Without them a typo could schedule a reminder ninety
 * days ahead of a monthly contribution, or set the send hour to 3am.
 */
public record UpdateChamaReminderSettingsDto(
    @NotNull Boolean enabled,
    @NotNull @Min(1) @Max(30) Integer daysBeforeDue,
    @NotNull @Min(1) @Max(30) Integer overdueEveryDays,
    @NotNull @Min(0) @Max(23) Integer sendHour) {
}
