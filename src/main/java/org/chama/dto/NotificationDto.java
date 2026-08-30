package org.chama.dto;

import org.chama.domain.enums.NotificationEventFamily;
import org.chama.domain.model.Notification;

import java.time.Instant;

/**
 * A notification as a client sees it.
 *
 * Deliberately carries no recipient. A client only ever receives its own notifications, so the id
 * would add nothing, and leaving it out means a mistake in the stream's filter cannot disclose who
 * else exists.
 */
public record NotificationDto(
    Long id,
    Long chamaId,
    NotificationEventFamily eventFamily,
    String title,
    String body,
    String link,
    Instant readAt,
    Instant createdAt) {

    public static NotificationDto from(Notification notification) {
        return new NotificationDto(
            notification.id,
            notification.chama != null ? notification.chama.id : null,
            notification.eventFamily,
            notification.title,
            notification.body,
            notification.link,
            notification.readAt,
            notification.createdAt);
    }
}
