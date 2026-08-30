package org.chama.service;

import io.smallrye.mutiny.Multi;
import io.smallrye.mutiny.operators.multi.processors.BroadcastProcessor;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.event.Observes;
import jakarta.enterprise.event.TransactionPhase;
import org.chama.domain.model.Notification;
import org.chama.dto.NotificationDto;

/**
 * Streams new notifications to whoever they belong to.
 *
 * Mirrors {@link ActivityFeedBroadcaster}, but partitions by user rather than by chama, because a
 * notification is addressed to a person.
 *
 * <p><strong>The filter in {@link #streamForUser} is the authorisation boundary.</strong> There is
 * no second check behind it, so widening that predicate leaks one user's notifications to another.
 * To make that hard to do by accident, the processor carries an internal envelope holding the
 * recipient, and the recipient is dropped when mapping to the public DTO, so the id cannot reach a
 * client even if the filter were wrong.
 */
@ApplicationScoped
public class NotificationBroadcaster {

    /** Internal only. Never serialised: the public stream emits NotificationDto. */
    private record Envelope(String keycloakUserId, NotificationDto dto) {
    }

    private final BroadcastProcessor<Envelope> processor = BroadcastProcessor.create();

    /**
     * Observed AFTER_SUCCESS so a notification is never streamed before the row it describes has
     * committed. A subscriber that acted on an event from a rolled back transaction would be
     * showing something that never happened.
     */
    public void onNotification(@Observes(during = TransactionPhase.AFTER_SUCCESS) Notification notification) {
        processor.onNext(new Envelope(notification.keycloakUserId, NotificationDto.from(notification)));
    }

    public Multi<NotificationDto> streamForUser(String keycloakUserId) {
        return processor
            .filter(envelope -> keycloakUserId.equals(envelope.keycloakUserId()))
            .map(Envelope::dto);
    }
}
