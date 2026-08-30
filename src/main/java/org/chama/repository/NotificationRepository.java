package org.chama.repository;

import io.quarkus.hibernate.orm.panache.PanacheRepository;
import jakarta.enterprise.context.ApplicationScoped;
import org.chama.domain.model.Notification;

import java.time.Instant;
import java.util.List;

/**
 * Every query here is scoped to one Keycloak user, and deliberately takes that id rather than
 * offering an unscoped variant. There is no second authorisation check behind this: the scoping
 * is the check.
 */
@ApplicationScoped
public class NotificationRepository implements PanacheRepository<Notification> {

    public List<Notification> findForUser(String keycloakUserId, int page, int size) {
        return find("keycloakUserId = ?1 order by createdAt desc", keycloakUserId)
            .page(page, size)
            .list();
    }

    public List<Notification> findUnreadForUser(String keycloakUserId, int page, int size) {
        return find("keycloakUserId = ?1 and readAt is null order by createdAt desc", keycloakUserId)
            .page(page, size)
            .list();
    }

    public long countUnreadForUser(String keycloakUserId) {
        return count("keycloakUserId = ?1 and readAt is null", keycloakUserId);
    }

    /**
     * Marks one notification read.
     *
     * The user id is part of the predicate rather than checked afterwards, so a request for
     * someone else's notification updates nothing and is reported as not found. Returns the number
     * of rows affected, which the resource uses to tell those two cases apart.
     */
    public int markRead(String keycloakUserId, Long id, Instant readAt) {
        return update("readAt = ?1 where id = ?2 and keycloakUserId = ?3 and readAt is null",
            readAt, id, keycloakUserId);
    }

    public int markAllRead(String keycloakUserId, Instant readAt) {
        return update("readAt = ?1 where keycloakUserId = ?2 and readAt is null", readAt, keycloakUserId);
    }

    /** Used by the retention sweep. Read and unread alike: an inbox is not an archive. */
    public long deleteOlderThan(Instant cutoff) {
        return delete("createdAt < ?1", cutoff);
    }
}
