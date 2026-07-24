package org.chama.dto;

import org.chama.domain.enums.ActivityEventType;
import org.chama.domain.model.ActivityLog;

import java.time.Instant;

public record ActivityLogDto(
    Long id,
    Long chamaId,
    ActivityEventType eventType,
    String description,
    Instant createdAt) {

    public static ActivityLogDto from(ActivityLog log) {
        return new ActivityLogDto(log.id, log.chama.id, log.eventType, log.description, log.createdAt);
    }
}
