package org.chama.dto;

import org.chama.domain.enums.KeycloakEventSource;
import org.chama.domain.model.KeycloakSecurityEvent;

import java.time.Instant;

public record SecurityEventDto(
    Long id,
    KeycloakEventSource source,
    Instant eventTime,
    String type,
    String keycloakUserId,
    String ipAddress,
    String clientId,
    String error,
    String resourceType,
    String resourcePath) {

    public static SecurityEventDto from(KeycloakSecurityEvent event) {
        return new SecurityEventDto(
            event.id,
            event.source,
            event.eventTime,
            event.type,
            event.keycloakUserId,
            event.ipAddress,
            event.clientId,
            event.error,
            event.resourceType,
            event.resourcePath);
    }
}
