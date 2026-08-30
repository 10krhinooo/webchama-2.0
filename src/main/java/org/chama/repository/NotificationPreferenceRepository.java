package org.chama.repository;

import io.quarkus.hibernate.orm.panache.PanacheRepository;
import jakarta.enterprise.context.ApplicationScoped;
import org.chama.domain.enums.NotificationEventFamily;
import org.chama.domain.model.NotificationPreference;

import java.util.List;
import java.util.Optional;

@ApplicationScoped
public class NotificationPreferenceRepository implements PanacheRepository<NotificationPreference> {

    public List<NotificationPreference> findForUser(String keycloakUserId) {
        return list("keycloakUserId", keycloakUserId);
    }

    public Optional<NotificationPreference> find(String keycloakUserId, NotificationEventFamily family) {
        return find("keycloakUserId = ?1 and eventFamily = ?2", keycloakUserId, family).firstResultOptional();
    }
}
