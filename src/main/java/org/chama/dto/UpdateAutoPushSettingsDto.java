package org.chama.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

public record UpdateAutoPushSettingsDto(
    @NotNull Boolean autoPushEnabled,
    // Bounded to 1-168 hours (one week): below an hour is finer than the sweep itself runs, above
    // a week stops being a meaningful "retry" and should just be turned off instead.
    @NotNull @Min(1) @Max(168) Integer autoPushRetryHours) {
}
