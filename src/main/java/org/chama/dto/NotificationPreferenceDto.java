package org.chama.dto;

import jakarta.validation.constraints.NotNull;
import org.chama.domain.enums.NotificationEventFamily;
import org.chama.domain.model.NotificationPreference;

public record NotificationPreferenceDto(
    @NotNull NotificationEventFamily eventFamily,
    boolean inAppEnabled,
    boolean emailEnabled) {

    public static NotificationPreferenceDto from(NotificationPreference preference) {
        return new NotificationPreferenceDto(
            preference.eventFamily,
            preference.inAppEnabled,
            preference.emailEnabled);
    }
}
