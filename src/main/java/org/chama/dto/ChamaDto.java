package org.chama.dto;

import org.chama.domain.enums.ChamaStatus;
import org.chama.domain.enums.ChamaType;
import org.chama.domain.enums.ContributionFrequency;
import org.chama.domain.model.Chama;

import java.math.BigDecimal;
import java.time.Instant;

public record ChamaDto(
    Long id,
    String name,
    String description,
    ChamaType type,
    String currency,
    ContributionFrequency contributionFrequency,
    BigDecimal contributionAmount,
    String meetingDay,
    BigDecimal approvalThreshold,
    BigDecimal savingsTarget,
    ChamaStatus status,
    boolean autoPushEnabled,
    int autoPushRetryHours,
    Instant createdAt) {

    public static ChamaDto from(Chama chama) {
        return new ChamaDto(
            chama.id,
            chama.name,
            chama.description,
            chama.type,
            chama.currency,
            chama.contributionFrequency,
            chama.contributionAmount,
            chama.meetingDay,
            chama.approvalThreshold,
            chama.savingsTarget,
            chama.status,
            chama.autoPushEnabled,
            chama.autoPushRetryHours,
            chama.createdAt);
    }
}
