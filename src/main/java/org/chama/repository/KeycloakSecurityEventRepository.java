package org.chama.repository;

import io.quarkus.hibernate.orm.panache.PanacheRepository;
import jakarta.enterprise.context.ApplicationScoped;
import org.chama.domain.model.KeycloakSecurityEvent;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

@ApplicationScoped
public class KeycloakSecurityEventRepository implements PanacheRepository<KeycloakSecurityEvent> {

    /** The sync watermark: nothing older than this has been ingested yet. */
    public Optional<Instant> findMaxEventTime() {
        Instant max = getEntityManager()
            .createQuery("select max(e.eventTime) from KeycloakSecurityEvent e", Instant.class)
            .getSingleResult();
        return Optional.ofNullable(max);
    }

    /**
     * Which of these dedupe keys have already been ingested, as a single batched lookup rather
     * than one exists-check per candidate row. A poll can carry up to a few thousand candidate
     * events (see KeycloakAdminService's page size), and checking each individually against the DB
     * turned the sync into an N+1 query storm that scaled worst during exactly the load spike
     * (a login burst) this ingestion exists to observe.
     */
    public Set<String> findExistingDedupeKeys(Collection<String> dedupeKeys) {
        if (dedupeKeys.isEmpty()) {
            return Set.of();
        }
        List<String> found = getEntityManager()
            .createQuery("select e.dedupeKey from KeycloakSecurityEvent e where e.dedupeKey in :keys", String.class)
            .setParameter("keys", dedupeKeys)
            .getResultList();
        return new HashSet<>(found);
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
