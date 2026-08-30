package org.chama.service;

import io.quarkus.scheduler.Scheduled;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.event.Event;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import org.chama.domain.enums.NotificationEventFamily;
import org.chama.domain.model.Chama;
import org.chama.domain.model.Notification;
import org.chama.domain.model.NotificationPreference;
import org.chama.repository.ChamaRepository;
import org.chama.repository.NotificationPreferenceRepository;
import org.chama.repository.NotificationRepository;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.jboss.logging.Logger;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;

/**
 * Writes to a user's in-app inbox and answers whether they still want the matching email.
 *
 * The email services call this, so one event produces both an inbox row and a message, and a user
 * who has switched a family off gets neither. Keeping the decision here rather than in each sender
 * means there is one place that knows what a preference means.
 */
@ApplicationScoped
public class NotificationService {

    private static final Logger LOG = Logger.getLogger(NotificationService.class);

    @Inject
    NotificationRepository notificationRepository;

    @Inject
    NotificationPreferenceRepository preferenceRepository;

    @Inject
    ChamaRepository chamaRepository;

    @Inject
    Event<Notification> notificationEvent;

    @ConfigProperty(name = "notification.retention-days", defaultValue = "90")
    int retentionDays;

    /**
     * Records a notification, unless the user has switched this family off in app.
     *
     * Joins the caller's transaction rather than opening its own, exactly like
     * {@link ActivityLogService}: the notification commits with the change that caused it, so a
     * rolled back action cannot leave someone told about something that did not happen.
     *
     * @return the persisted notification, or null when the user has muted this family in app.
     */
    @Transactional
    public Notification record(String keycloakUserId, Long chamaId, NotificationEventFamily family,
                               String title, String body, String link) {
        if (keycloakUserId == null || keycloakUserId.isBlank()) {
            return null;
        }
        if (!inAppEnabled(keycloakUserId, family)) {
            return null;
        }

        Notification notification = new Notification();
        notification.keycloakUserId = keycloakUserId;
        notification.eventFamily = family;
        notification.title = title;
        notification.body = body;
        notification.link = link;
        if (chamaId != null) {
            notification.chama = chamaRepository.findById(chamaId);
        }
        notificationRepository.persist(notification);

        // Observed AFTER_SUCCESS by NotificationBroadcaster, so nothing is streamed to a browser
        // before the row it describes has committed.
        notificationEvent.fire(notification);
        return notification;
    }

    /** Whether the matching email should still be sent. Consulted by the notification services. */
    public boolean emailEnabled(String keycloakUserId, NotificationEventFamily family) {
        return preferenceRepository.find(keycloakUserId, family)
            .map(preference -> preference.emailEnabled)
            .orElse(true);
    }

    private boolean inAppEnabled(String keycloakUserId, NotificationEventFamily family) {
        return preferenceRepository.find(keycloakUserId, family)
            .map(preference -> preference.inAppEnabled)
            .orElse(true);
    }

    public List<NotificationPreference> preferencesFor(String keycloakUserId) {
        return preferenceRepository.findForUser(keycloakUserId);
    }

    /**
     * Upserts one family's preference for a user.
     *
     * Written rather than deleted when it matches the default, so an explicit "yes, keep emailing
     * me" survives a later change to what the default is.
     */
    @Transactional
    public NotificationPreference updatePreference(String keycloakUserId, NotificationEventFamily family,
                                                   boolean inAppEnabled, boolean emailEnabled) {
        NotificationPreference preference = preferenceRepository.find(keycloakUserId, family)
            .orElseGet(() -> {
                NotificationPreference created = new NotificationPreference();
                created.keycloakUserId = keycloakUserId;
                created.eventFamily = family;
                preferenceRepository.persist(created);
                return created;
            });
        preference.inAppEnabled = inAppEnabled;
        preference.emailEnabled = emailEnabled;
        return preference;
    }

    public List<Notification> list(String keycloakUserId, boolean unreadOnly, int page, int size) {
        return unreadOnly
            ? notificationRepository.findUnreadForUser(keycloakUserId, page, size)
            : notificationRepository.findForUser(keycloakUserId, page, size);
    }

    public long unreadCount(String keycloakUserId) {
        return notificationRepository.countUnreadForUser(keycloakUserId);
    }

    /** @return false when the notification does not exist or belongs to someone else. */
    @Transactional
    public boolean markRead(String keycloakUserId, Long id) {
        return notificationRepository.markRead(keycloakUserId, id, Instant.now()) > 0;
    }

    @Transactional
    public int markAllRead(String keycloakUserId) {
        return notificationRepository.markAllRead(keycloakUserId, Instant.now());
    }

    /**
     * Drops notifications past the retention window.
     *
     * An inbox is not an audit trail; activity_log already keeps the permanent record, and this
     * table exists to be read once and cleared. Non-overlapping, like every other sweep here.
     */
    @Scheduled(every = "24h", identity = "notification-retention",
        concurrentExecution = Scheduled.ConcurrentExecution.SKIP)
    @Transactional
    public void pruneOldNotifications() {
        Instant cutoff = Instant.now().minus(retentionDays, ChronoUnit.DAYS);
        long removed = notificationRepository.deleteOlderThan(cutoff);
        if (removed > 0) {
            LOG.infof("Pruned %d notifications older than %d days", removed, retentionDays);
        }
    }
}
