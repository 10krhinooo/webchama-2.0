package org.chama.repository;

import io.quarkus.hibernate.orm.panache.PanacheRepository;
import jakarta.enterprise.context.ApplicationScoped;
import org.chama.domain.model.KeycloakSecurityEvent;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@ApplicationScoped
public class KeycloakSecurityEventRepository implements PanacheRepository<KeycloakSecurityEvent> {

    /** The sync watermark: nothing older than this has been ingested yet. */
    public Optional<Instant> findMaxEventTime() {
        Instant max = getEntityManager()
            .createQuery("select max(e.eventTime) from KeycloakSecurityEvent e", Instant.class)
            .getSingleResult();
        return Optional.ofNullable(max);
    }

    public boolean existsByDedupeKey(String dedupeKey) {
        return count("dedupeKey", dedupeKey) > 0;
    }

    /**
     * All filters are optional (null skips that clause), ANDed together, newest first. Only
     * clauses for a supplied filter are added to the query, an unreferenced named parameter would
     * make Hibernate throw, so nothing is bound unless its clause is actually present.
     */
    public List<KeycloakSecurityEvent> search(String type, String error, String keycloakUserId, int limit) {
        List<String> clauses = new ArrayList<>();
        Map<String, Object> params = new HashMap<>();
        if (type != null) {
            clauses.add("type = :type");
            params.put("type", type);
        }
        if (error != null) {
            clauses.add("error = :error");
            params.put("error", error);
        }
        if (keycloakUserId != null) {
            clauses.add("keycloakUserId = :keycloakUserId");
            params.put("keycloakUserId", keycloakUserId);
        }

        String query = clauses.isEmpty() ? "order by eventTime desc"
            : String.join(" and ", clauses) + " order by eventTime desc";
        return find(query, params).page(0, limit).list();
    }
}
