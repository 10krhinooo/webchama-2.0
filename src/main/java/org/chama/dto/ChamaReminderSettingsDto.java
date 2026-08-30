package org.chama.dto;

import org.chama.domain.model.ChamaReminderSettings;

public record ChamaReminderSettingsDto(
    Long chamaId,
    boolean enabled,
    int daysBeforeDue,
    int overdueEveryDays,
    int sendHour) {

    public static ChamaReminderSettingsDto from(ChamaReminderSettings settings) {
        return new ChamaReminderSettingsDto(
            settings.chama.id,
            settings.enabled,
            settings.daysBeforeDue,
            settings.overdueEveryDays,
            settings.sendHour);
    }
}
